import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "./reports.types";
import { JOB_STATUSES, type JobStatus, type ReportFormat } from "./reports.contract";
import { reportScheduleNotFound } from "./reports.errors";
import { createReportSchedule } from "./reports.service";
import { reportsRepository } from "./reports.repository";
import { cadenceLabel, parseDelivery } from "./schedules-roster.repository";
import {
  duplicateScheduleResponseSchema,
  scheduleDetailResponseSchema,
  type ScheduleDetailQuery,
} from "./schedule-detail.dto";
import { scheduleDetailRepository } from "./schedule-detail.repository";

const AUTO_PAUSE_AFTER_FAILURES = 5;

function pageInfo(totalCount: number, page: number, limit: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  return {
    page,
    pageSize: limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function asFormats(value: unknown): ReportFormat[] {
  if (!Array.isArray(value)) return ["csv"];
  const formats = value.filter(
    (item): item is ReportFormat =>
      item === "csv" || item === "xlsx" || item === "pdf" || item === "json",
  );
  return formats.length > 0 ? formats : ["csv"];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asJobStatus(value: string): JobStatus {
  if ((JOB_STATUSES as readonly string[]).includes(value)) return value as JobStatus;
  return "FAILED";
}

function asFormat(value: string | null): ReportFormat | null {
  if (value === "csv" || value === "xlsx" || value === "pdf" || value === "json") return value;
  return null;
}

function formatDuration(ms: number | null): string | null {
  if (ms == null || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem === 0 ? `${mins}m` : `${mins}m ${rem}s`;
}

function mapDestinations(deliveryJson: unknown) {
  const parsed = parseDelivery(deliveryJson);
  return parsed.kinds.map((kind) => {
    if (kind === "email") {
      return {
        kind,
        label: "Email",
        detail: parsed.emails.length > 0 ? `${parsed.emails.length} recipient(s)` : null,
      };
    }
    if (kind === "webhook") {
      return { kind, label: "Webhook", detail: parsed.webhookHost };
    }
    if (kind === "storage") {
      return { kind, label: "Storage", detail: parsed.storageLabel };
    }
    return { kind, label: "Download", detail: null as string | null };
  });
}

function buildFilterChips(params: Record<string, unknown>) {
  const skip = new Set([
    "columns",
    "rowLimit",
    "limit",
    "format",
    "delivery",
    "deliveryMode",
    "deliveryEmails",
    "webhookUrl",
    "triggeredFromScheduleId",
  ]);
  const chips: Array<{ key: string; label: string; value: string }> = [];
  for (const [key, raw] of Object.entries(params)) {
    if (skip.has(key)) continue;
    if (raw == null || raw === "") continue;
    if (Array.isArray(raw)) {
      if (raw.length === 0) continue;
      chips.push({
        key,
        label: key,
        value: raw.map(String).join(", "),
      });
      continue;
    }
    if (typeof raw === "object") continue;
    chips.push({
      key,
      label: key,
      value:
        typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean"
          ? String(raw)
          : "",
    });
  }
  return chips.slice(0, 24);
}

function extractColumns(params: Record<string, unknown>): string[] {
  const cols = params["columns"];
  if (!Array.isArray(cols)) return [];
  return cols.filter((c): c is string => typeof c === "string" && c.trim().length > 0);
}

function extractRowLimit(params: Record<string, unknown>): number | null {
  const raw = params["rowLimit"] ?? params["limit"];
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) {
    return Math.max(0, Math.floor(Number(raw)));
  }
  return null;
}

function extractRetentionDays(params: Record<string, unknown>): number | null {
  const raw = params["retentionDays"] ?? params["retention"];
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  return 7;
}

function fileNameForRun(args: {
  definitionKey: string;
  completedAt: Date | null;
  createdAt: Date;
  format: ReportFormat | null;
  hasFile: boolean;
}): string | null {
  if (!args.hasFile) return null;
  const stamp = (args.completedAt ?? args.createdAt).toISOString().slice(0, 10);
  const ext = args.format ?? "csv";
  return `${args.definitionKey}-${stamp}.${ext}`;
}

function mapRunDelivery(
  paramsJson: unknown,
  scheduleDelivery: ReturnType<typeof parseDelivery>,
): {
  deliveryKind: "download" | "email" | "webhook" | "storage" | "unknown" | null;
  deliveryLabel: string | null;
  deliveryStatus: "succeeded" | "failed" | "pending" | "skipped" | null;
  deliveryError: string | null;
} {
  const params = asRecord(paramsJson);
  const delivery = asRecord(params["delivery"]);
  const statusRaw =
    typeof delivery["status"] === "string" ? delivery["status"].toLowerCase() : null;
  const error =
    typeof delivery["error"] === "string"
      ? delivery["error"]
      : typeof delivery["errorMessage"] === "string"
        ? delivery["errorMessage"]
        : null;

  let deliveryStatus: "succeeded" | "failed" | "pending" | "skipped" | null;
  if (statusRaw === "failed" || statusRaw === "error") deliveryStatus = "failed";
  else if (statusRaw === "succeeded" || statusRaw === "delivered" || statusRaw === "ok") {
    deliveryStatus = "succeeded";
  } else if (statusRaw === "pending" || statusRaw === "queued") deliveryStatus = "pending";
  else if (statusRaw === "skipped") deliveryStatus = "skipped";
  else if (error) deliveryStatus = "failed";
  else if (scheduleDelivery.isExternal) deliveryStatus = "succeeded";
  else deliveryStatus = "skipped";

  const primary = scheduleDelivery.kinds[0] ?? "download";
  const label =
    primary === "email"
      ? "Email"
      : primary === "webhook"
        ? "Webhook"
        : primary === "storage"
          ? (scheduleDelivery.storageLabel ?? "Storage")
          : "Download";

  return {
    deliveryKind: primary,
    deliveryLabel: label,
    deliveryStatus,
    deliveryError: error,
  };
}

export async function getScheduleDetail(
  tx: TenantTx,
  ctx: ServiceCtx,
  scheduleId: string,
  query: ScheduleDetailQuery,
) {
  void ctx;
  const schedule = await reportsRepository.findScheduleById(tx, scheduleId);
  if (!schedule || schedule.tenant_id !== ctx.tenantId) {
    throw reportScheduleNotFound();
  }

  const formats = asFormats(schedule.formats_json);
  const primaryFormat = formats[0] ?? "csv";
  const params = asRecord(schedule.params_json);
  const deliveryParsed = parseDelivery(schedule.delivery_json);
  const destinations = mapDestinations(schedule.delivery_json);
  const name = schedule.name?.trim() || schedule.definition_title;
  const cadence = cadenceLabel(schedule.cron_expression, schedule.timezone);

  const [ownerName, stats, sparkline, runsListed, failureMeta] = await Promise.all([
    scheduleDetailRepository.getOwnerName(tx, schedule.created_by_membership_id),
    scheduleDetailRepository.getStats(tx, scheduleId),
    scheduleDetailRepository.listRecentRowCounts(tx, scheduleId, 12),
    scheduleDetailRepository.listRuns(tx, scheduleId, query.runsPage, query.runsLimit),
    scheduleDetailRepository.getConsecutiveFailureMeta(tx, scheduleId),
  ]);

  const isFailing = failureMeta.consecutiveFailures >= 1;

  const columns = extractColumns(params);
  const externalWarning = deliveryParsed.isExternal
    ? `This schedule sends personal data to ${destinations
        .filter((d) => d.kind !== "download")
        .map((d) => d.detail ?? d.label)
        .join(" and ")} on every run.`
    : null;

  const successRatePercent =
    stats.total_runs === 0
      ? null
      : Math.round((stats.succeeded_runs / stats.total_runs) * 1000) / 10;

  const mappedRuns = runsListed.rows.map((row, index) => {
    const format = asFormat(row.format);
    const hasFile = Boolean(row.r2_object_key) && row.status === "SUCCEEDED";
    const durationMs =
      row.started_at && row.completed_at
        ? Math.max(0, row.completed_at.getTime() - row.started_at.getTime())
        : null;
    const prev = runsListed.rows[index + 1];
    const rowDelta =
      row.row_count != null && prev?.row_count != null ? row.row_count - prev.row_count : null;
    const delivery = mapRunDelivery(row.params_json, deliveryParsed);
    const errorMessage =
      row.error_json && typeof row.error_json === "object" && !Array.isArray(row.error_json)
        ? typeof (row.error_json as Record<string, unknown>)["message"] === "string"
          ? String((row.error_json as Record<string, unknown>)["message"])
          : null
        : null;

    return {
      id: row.id,
      fileName: fileNameForRun({
        definitionKey: schedule.definition_key,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        format,
        hasFile,
      }),
      status: asJobStatus(row.status),
      rowCount: row.row_count,
      rowDelta:
        rowDelta != null && Math.abs(rowDelta) >= Math.max(50, (prev?.row_count ?? 0) * 0.2)
          ? rowDelta
          : rowDelta != null && Math.abs(rowDelta) >= 100
            ? rowDelta
            : null,
      durationMs,
      durationLabel: formatDuration(durationMs),
      startedAt: (row.started_at ?? row.created_at).toISOString(),
      completedAt: row.completed_at?.toISOString() ?? null,
      format,
      hasFile,
      canDownload: hasFile,
      deliveryKind: delivery.deliveryKind,
      deliveryLabel: delivery.deliveryLabel,
      deliveryStatus: delivery.deliveryStatus,
      deliveryError: delivery.deliveryError,
      errorMessage,
    };
  });

  const trouble =
    isFailing && failureMeta.consecutiveFailures > 0
      ? {
          consecutiveFailures: failureMeta.consecutiveFailures,
          lastErrorMessage: failureMeta.lastErrorMessage ?? "The most recent scheduled run failed.",
          failingSinceAt: failureMeta.failingSinceAt?.toISOString() ?? null,
          failingRunId: failureMeta.failingRunId,
          retriesRemainingBeforePause: Math.max(
            0,
            AUTO_PAUSE_AFTER_FAILURES - failureMeta.consecutiveFailures,
          ),
        }
      : null;

  return scheduleDetailResponseSchema.parse({
    data: {
      id: schedule.id,
      name,
      definitionKey: schedule.definition_key,
      definitionTitle: schedule.definition_title,
      isActive: schedule.is_active,
      isFailing,
      cadenceLabel: cadence,
      primaryFormat,
      destinations,
      isExternal: deliveryParsed.isExternal,
      nextRunAt: schedule.is_active ? schedule.next_run_at.toISOString() : null,
      createdAt: schedule.created_at.toISOString(),
      updatedAt: schedule.updated_at.toISOString(),
      ownerName,
      stats: {
        nextRunAt: schedule.is_active ? schedule.next_run_at.toISOString() : null,
        totalRuns: stats.total_runs,
        succeededRuns: stats.succeeded_runs,
        failedRuns: stats.failed_runs,
        successRatePercent,
        avgDurationMs: stats.avg_duration_ms,
        avgRowCount: stats.avg_row_count,
        rowSparkline: sparkline,
      },
      config: {
        reportTitle: schedule.definition_title,
        definitionKey: schedule.definition_key,
        filterChips: buildFilterChips(params),
        columns,
        columnCount: columns.length,
        format: primaryFormat,
        formatOptionsLabel:
          primaryFormat === "csv" ? "CSV (Comma), UTF-8" : primaryFormat.toUpperCase(),
        rowLimit: extractRowLimit(params),
        cadenceLabel: cadence,
        cronExpression: schedule.cron_expression,
        timezone: schedule.timezone,
        retentionDays: extractRetentionDays(params),
        destinations,
        isExternal: deliveryParsed.isExternal,
        externalWarning,
        editBuilderHref: `/admin/reports/exports/new?definition=${encodeURIComponent(schedule.definition_key)}`,
      },
      trouble,
      runs: mappedRuns,
      runsPageInfo: pageInfo(runsListed.totalCount, query.runsPage, query.runsLimit),
    },
  });
}

export async function duplicateReportSchedule(tx: TenantTx, ctx: ServiceCtx, scheduleId: string) {
  const existing = await reportsRepository.findScheduleById(tx, scheduleId);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw reportScheduleNotFound();
  }

  const baseName = existing.name?.trim() || existing.definition_title;
  const formats = asFormats(existing.formats_json);
  const delivery =
    existing.delivery_json && typeof existing.delivery_json === "object"
      ? asRecord(existing.delivery_json)
      : undefined;

  const created = await createReportSchedule(tx, ctx, {
    definitionKey: existing.definition_key,
    name: `${baseName} (copy)`,
    cronExpression: existing.cron_expression,
    timezone: existing.timezone,
    params: asRecord(existing.params_json),
    formats,
    ...(delivery ? { delivery } : {}),
    isActive: false,
  });

  return duplicateScheduleResponseSchema.parse({
    data: {
      id: created.data.id,
      name: created.data.name ?? `${baseName} (copy)`,
    },
  });
}
