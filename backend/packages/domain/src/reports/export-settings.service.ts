import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "./reports.types";
import {
  DEFAULT_EXPORT_SETTINGS,
  exportSettingsResponseSchema,
  exportSettingsSchema,
  PII_DATA_TYPES,
  purgeExpiredResponseSchema,
  retentionImpactResponseSchema,
  type ExportSettings,
  type RetentionImpactQuery,
  type UpdateExportSettingsBody,
} from "./export-settings.dto";
import {
  estimateBytes,
  exportSettingsRepository,
  retentionCutoff,
  retentionLabel,
} from "./export-settings.repository";

const PII_FIELD_META = [
  {
    key: "learner_name" as const,
    label: "Learner name",
    maskExample: "Jane D.",
    exposedByReports: ["learners", "progress", "scores"],
  },
  {
    key: "email" as const,
    label: "Email address",
    maskExample: "p•••@example.com",
    exposedByReports: ["learners", "exports", "payments"],
  },
  {
    key: "phone" as const,
    label: "Phone",
    maskExample: "+1 •••• ••67",
    exposedByReports: ["learners"],
  },
  {
    key: "billing_address" as const,
    label: "Billing address",
    maskExample: "••• Main St",
    exposedByReports: ["payments"],
  },
  {
    key: "tax_id" as const,
    label: "Tax ID",
    maskExample: "••-••••6789",
    exposedByReports: ["payments"],
  },
  {
    key: "ip_address" as const,
    label: "IP address",
    maskExample: null,
    exposedByReports: ["active-devices", "system-logs"],
  },
  {
    key: "device_fingerprint" as const,
    label: "Device fingerprint",
    maskExample: "fp_••••a91c",
    exposedByReports: ["active-devices"],
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseStoredSettings(raw: unknown): ExportSettings {
  const merged = {
    ...DEFAULT_EXPORT_SETTINGS,
    ...asRecord(raw),
    personalDataTreatments: {
      ...DEFAULT_EXPORT_SETTINGS.personalDataTreatments,
      ...asRecord(asRecord(raw)["personalDataTreatments"]),
    },
  };
  return exportSettingsSchema.parse(merged);
}

function retentionMs(value: number, unit: "days" | "hours"): number {
  return unit === "hours" ? value * 3_600_000 : value * 86_400_000;
}

function summarizeAudit(action: string, metadata: unknown): string {
  const meta = asRecord(metadata);
  const summary = typeof meta["summary"] === "string" ? meta["summary"] : null;
  if (summary) return summary;
  if (action === "reports.export_settings.updated") return "Export settings updated";
  if (action === "reports.export_settings.purged") return "Expired export files purged";
  return action.replace(/^reports\.export_settings\./, "").replaceAll("_", " ");
}

function buildChangeSummary(before: ExportSettings, after: ExportSettings): string {
  const parts: string[] = [];
  if (
    before.fileRetentionValue !== after.fileRetentionValue ||
    before.fileRetentionUnit !== after.fileRetentionUnit
  ) {
    parts.push(
      `Retention changed from ${retentionLabel(before.fileRetentionValue, before.fileRetentionUnit)} to ${retentionLabel(after.fileRetentionValue, after.fileRetentionUnit)}`,
    );
  }
  if (before.allowExternalDestinations !== after.allowExternalDestinations) {
    parts.push(
      after.allowExternalDestinations
        ? "External delivery toggle enabled"
        : "External delivery toggle disabled",
    );
  }
  if (before.watermarkExports !== after.watermarkExports) {
    parts.push(
      after.watermarkExports ? "Export watermarking enabled" : "Export watermarking disabled",
    );
  }
  if (before.maxRowsPerExport !== after.maxRowsPerExport) {
    parts.push(`Max rows set to ${after.maxRowsPerExport.toLocaleString()}`);
  }
  if (before.requireReasonForPii !== after.requireReasonForPii) {
    parts.push(
      after.requireReasonForPii
        ? "PII reason requirement enabled"
        : "PII reason requirement disabled",
    );
  }
  for (const key of PII_DATA_TYPES) {
    if (before.personalDataTreatments[key] !== after.personalDataTreatments[key]) {
      const label = PII_FIELD_META.find((f) => f.key === key)?.label ?? key;
      parts.push(
        `Personal-data treatment for ${label} set to ${after.personalDataTreatments[key]}`,
      );
    }
  }
  if (parts.length === 0) return "Export settings updated";
  return parts[0] ?? "Export settings updated";
}

async function buildResponse(tx: TenantTx) {
  const row = await exportSettingsRepository.get(tx);
  const settings = row ? parseStoredSettings(row.settings_json) : DEFAULT_EXPORT_SETTINGS;
  const storage = await exportSettingsRepository.storageStats(tx);
  const roles = await exportSettingsRepository.listRoles(tx);
  const externalDestinationCount = await exportSettingsRepository.countExternalDestinations(tx);
  const auditRows = await exportSettingsRepository.listRecentSettingsAudit(tx, 8);

  return exportSettingsResponseSchema.parse({
    data: {
      settings,
      storage: {
        filesStoredCount: storage.files_stored_count,
        estimatedBytes: estimateBytes(storage.files_stored_count),
        expiringSoonCount: storage.expiring_soon_count,
        expiredCount: storage.expired_count,
        purgeFreesEstimatedBytes: estimateBytes(storage.expired_count),
      },
      availableRoles: roles,
      externalDestinationCount,
      personalDataFields: PII_FIELD_META,
      recentAudit: auditRows.map((entry) => ({
        id: entry.id,
        occurredAt: entry.occurred_at.toISOString(),
        summary: summarizeAudit(entry.action, entry.metadata_json),
        actorName: entry.actor_name,
      })),
      updatedAt: row?.updated_at.toISOString() ?? null,
      updatedByName: row?.updated_by_name ?? null,
    },
  });
}

export async function getExportSettings(tx: TenantTx, ctx: ServiceCtx) {
  void ctx;
  return buildResponse(tx);
}

export async function updateExportSettings(
  tx: TenantTx,
  ctx: ServiceCtx,
  body: UpdateExportSettingsBody,
) {
  const existing = await exportSettingsRepository.get(tx);
  const before = existing ? parseStoredSettings(existing.settings_json) : DEFAULT_EXPORT_SETTINGS;
  const after = body.settings;

  const reducingRetention =
    retentionMs(after.fileRetentionValue, after.fileRetentionUnit) <
    retentionMs(before.fileRetentionValue, before.fileRetentionUnit);

  let purgedByRetention = 0;
  if (reducingRetention) {
    const cutoff = retentionCutoff(after.fileRetentionValue, after.fileRetentionUnit);
    const impactCount = await exportSettingsRepository.countFilesOutsideRetention(tx, cutoff);
    if (impactCount > 0 && !body.acknowledgeRetentionPurge) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: `Reducing retention would delete ${impactCount} file(s) immediately. Confirm acknowledgement to continue.`,
      });
    }
    if (impactCount > 0 && body.acknowledgeRetentionPurge) {
      purgedByRetention = await exportSettingsRepository.purgeFilesOlderThan(tx, cutoff);
    }
  }

  await exportSettingsRepository.upsert(tx, after, ctx.actorMembershipId);

  const summary = buildChangeSummary(before, after);
  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "reports.export_settings.updated",
      target: { type: "report_export_settings", id: ctx.tenantId },
      before,
      after,
      reason: null,
      metadata: {
        summary,
        purgedByRetention,
      },
    },
  );

  return buildResponse(tx);
}

export async function getRetentionImpact(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: RetentionImpactQuery,
) {
  const existing = await exportSettingsRepository.get(tx);
  const current = existing ? parseStoredSettings(existing.settings_json) : DEFAULT_EXPORT_SETTINGS;
  const cutoff = retentionCutoff(query.fileRetentionValue, query.fileRetentionUnit);
  const filesDeletedImmediately = await exportSettingsRepository.countFilesOutsideRetention(
    tx,
    cutoff,
  );

  return retentionImpactResponseSchema.parse({
    data: {
      filesDeletedImmediately,
      estimatedBytesFreed: estimateBytes(filesDeletedImmediately),
      currentRetentionLabel: retentionLabel(current.fileRetentionValue, current.fileRetentionUnit),
      nextRetentionLabel: retentionLabel(query.fileRetentionValue, query.fileRetentionUnit),
    },
  });
}

export async function purgeExpiredExportFiles(tx: TenantTx, ctx: ServiceCtx) {
  const deletedCount = await exportSettingsRepository.purgeExpiredFiles(tx);
  const estimatedBytesFreed = estimateBytes(deletedCount);

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "reports.export_settings.purged",
      target: { type: "report_export_settings", id: ctx.tenantId },
      before: null,
      after: { deletedCount, estimatedBytesFreed },
      reason: null,
      metadata: {
        summary: `Deleted ${deletedCount} expired export file(s)`,
      },
    },
  );

  return purgeExpiredResponseSchema.parse({
    data: { deletedCount, estimatedBytesFreed },
  });
}
