import { createHmac, randomBytes } from "node:crypto";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { safeOutboundFetch } from "@atlas/security/safe-outbound-fetch";
import type { TenantTx } from "@atlas/db";
import { assertTenantKeyPrefix, getStorageProvider, parseStorageEnv } from "@atlas/storage";
import type { ServiceCtx } from "./reports.types";
import {
  createDestinationResponseSchema,
  deleteDestinationResponseSchema,
  destinationsRosterListResponseSchema,
  exportDestinationsResponseSchema,
  testDestinationResponseSchema,
  updateDestinationResponseSchema,
  type CreateDestinationBody,
  type DestinationsRosterListQuery,
  type UpdateDestinationBody,
} from "./destinations-roster.dto";
import {
  destinationsRosterRepository,
  emailDomain,
  isExternalEmail,
  maskSecret,
  parseHealth,
  parseWebhookParts,
  pushHealthDay,
  type DestinationRow,
} from "./destinations-roster.repository";

export type DestinationTestEmailSender = (input: {
  to: string;
  subject: string;
  body: string;
  requestId: string;
}) => Promise<void>;

function destinationNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Destination not found.",
  });
}

function destinationValidationError(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

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

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asLinkedSchedules(value: unknown): Array<{ id: string; name: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row["id"] !== "string" || typeof row["name"] !== "string") return null;
      return { id: row["id"], name: row["name"] };
    })
    .filter((item): item is { id: string; name: string } => item != null);
}

function mapItem(row: DestinationRow, tenantDomains: string[]) {
  const config = asRecord(row.config_json);
  const secrets = asRecord(row.secrets_json);
  const kind = row.kind as "email" | "webhook" | "storage";
  const emails = asStringArray(config["emails"]).map((address) => ({
    address,
    isExternal: isExternalEmail(address, tenantDomains),
  }));

  const webhookUrl =
    typeof config["url"] === "string"
      ? config["url"]
      : typeof config["webhookUrl"] === "string"
        ? config["webhookUrl"]
        : null;
  const webhookParts = webhookUrl ? parseWebhookParts(webhookUrl) : null;
  const signingSecret =
    typeof secrets["signingSecret"] === "string" ? secrets["signingSecret"] : null;
  const credentials = typeof secrets["credentials"] === "string" ? secrets["credentials"] : null;

  const lastStatus =
    row.last_delivery_status === "succeeded" ||
    row.last_delivery_status === "failed" ||
    row.last_delivery_status === "pending"
      ? row.last_delivery_status
      : null;

  const isFailing = row.is_active && (lastStatus === "failed" || row.consecutive_failures > 0);

  return {
    id: row.id,
    name: row.name,
    kind,
    isActive: row.is_active,
    isFailing,
    emails,
    webhookHost: webhookParts?.host ?? null,
    webhookPathTruncated: webhookParts?.pathTruncated ?? null,
    webhookUrl,
    signingSecretMasked: signingSecret ? maskSecret(signingSecret) : null,
    hasSigningSecret: Boolean(signingSecret),
    retryPolicy:
      config["retryPolicy"] === "none" ||
      config["retryPolicy"] === "3x" ||
      config["retryPolicy"] === "5x"
        ? config["retryPolicy"]
        : kind === "webhook"
          ? "3x"
          : null,
    payloadFormat:
      config["payloadFormat"] === "multipart" || config["payloadFormat"] === "json_signed_url"
        ? config["payloadFormat"]
        : kind === "webhook"
          ? "multipart"
          : null,
    storageProvider:
      config["provider"] === "s3" || config["provider"] === "gcs" || config["provider"] === "azure"
        ? config["provider"]
        : kind === "storage"
          ? "s3"
          : null,
    storageBucket: typeof config["bucket"] === "string" ? config["bucket"] : null,
    storagePrefix: typeof config["prefix"] === "string" ? config["prefix"] : null,
    hasCredentials: Boolean(credentials),
    credentialsMasked: credentials ? maskSecret(credentials) : null,
    lastDeliveryAt: row.last_delivery_at?.toISOString() ?? null,
    lastDeliveryStatus: lastStatus,
    lastError: row.last_error,
    consecutiveFailures: row.consecutive_failures,
    scheduleCount: row.schedule_count,
    linkedSchedules: asLinkedSchedules(row.linked_schedules_json),
    health30d: parseHealth(row.health_30d_json),
    externalRecipientCount: emails.filter((e) => e.isExternal).length,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function countExternalRecipients(rows: DestinationRow[], tenantDomains: string[]): number {
  let total = 0;
  for (const row of rows) {
    if (row.kind !== "email") continue;
    const emails = asStringArray(asRecord(row.config_json)["emails"]);
    total += emails.filter((address) => isExternalEmail(address, tenantDomains)).length;
  }
  return total;
}

function assertHttpsUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw destinationValidationError("Webhook URL is invalid.");
  }
  if (parsed.protocol !== "https:") {
    throw destinationValidationError("Webhook URL must use https.");
  }
}

async function auditDestination(
  tx: TenantTx,
  ctx: ServiceCtx,
  action: string,
  destinationId: string,
  after: Record<string, unknown> | null,
  before: Record<string, unknown> | null = null,
) {
  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action,
      target: { type: "report_delivery_destination", id: destinationId },
      before,
      after,
      reason: null,
      metadata: {},
    },
  );
}

export async function listDestinationsRoster(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: DestinationsRosterListQuery,
) {
  const tenantDomains = await destinationsRosterRepository.listTenantEmailDomains(tx);
  const summaryRow = await destinationsRosterRepository.summarize(tx);
  const { rows, totalCount } = await destinationsRosterRepository.list(tx, query);
  const allForExternal =
    query.page === 1 && !query.q && query.kind === "any" && query.status === "all"
      ? rows
      : await destinationsRosterRepository.listAllForExport(tx);

  return destinationsRosterListResponseSchema.parse({
    data: {
      items: rows.map((row) => mapItem(row, tenantDomains)),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      summary: {
        totalCount: summaryRow.total_count,
        emailCount: summaryRow.email_count,
        webhookCount: summaryRow.webhook_count,
        storageCount: summaryRow.storage_count,
        deliveriesThisMonth: summaryRow.deliveries_this_month,
        deliveriesSucceededThisMonth: summaryRow.deliveries_succeeded_this_month,
        failingCount: summaryRow.failing_count,
        failingCaption: summaryRow.failing_caption,
        externalRecipientCount: countExternalRecipients(allForExternal, tenantDomains),
        lastDeliveryAt: summaryRow.last_delivery_at?.toISOString() ?? null,
        tenantEmailDomains: tenantDomains,
      },
    },
  });
}

export async function createDestination(
  tx: TenantTx,
  ctx: ServiceCtx,
  body: CreateDestinationBody,
) {
  const tenantDomains = await destinationsRosterRepository.listTenantEmailDomains(tx);
  let config: Record<string, unknown>;
  let secrets: Record<string, unknown> | null = null;

  if (body.kind === "email") {
    config = { emails: body.emails.map((e) => e.trim().toLowerCase()) };
  } else if (body.kind === "webhook") {
    assertHttpsUrl(body.url);
    const secret = body.signingSecret?.trim() || randomBytes(24).toString("hex");
    config = {
      url: body.url.trim(),
      retryPolicy: body.retryPolicy,
      payloadFormat: body.payloadFormat,
      signingSecretLast4: secret.slice(-4),
    };
    secrets = { signingSecret: secret };
  } else {
    config = {
      provider: body.provider,
      bucket: body.bucket.trim(),
      prefix: body.prefix.trim(),
    };
    if (body.credentials?.trim()) {
      secrets = { credentials: body.credentials.trim() };
      config["credentialsLast4"] = body.credentials.trim().slice(-4);
    }
  }

  const row = await destinationsRosterRepository.create(tx, {
    createdByMembershipId: ctx.actorMembershipId,
    name: body.name.trim(),
    kind: body.kind,
    config,
    secrets,
  });

  await auditDestination(tx, ctx, "reports.destination.created", row.id, {
    name: row.name,
    kind: row.kind,
  });

  return createDestinationResponseSchema.parse({
    data: mapItem(row, tenantDomains),
  });
}

export async function updateDestination(
  tx: TenantTx,
  ctx: ServiceCtx,
  destinationId: string,
  body: UpdateDestinationBody,
) {
  const existing = await destinationsRosterRepository.getById(tx, destinationId);
  if (!existing) {
    throw destinationNotFound();
  }

  const tenantDomains = await destinationsRosterRepository.listTenantEmailDomains(tx);
  const config = asRecord(existing.config_json);
  const secrets = asRecord(existing.secrets_json);
  let nextSecrets: Record<string, unknown> | null | undefined = undefined;

  if (body.name !== undefined) {
    // name applied in repository
  }

  if (existing.kind === "email" && body.emails) {
    config["emails"] = body.emails.map((e) => e.trim().toLowerCase());
  }

  if (existing.kind === "webhook") {
    if (body.url) {
      assertHttpsUrl(body.url);
      config["url"] = body.url.trim();
    }
    if (body.retryPolicy) config["retryPolicy"] = body.retryPolicy;
    if (body.payloadFormat) config["payloadFormat"] = body.payloadFormat;
    if (body.signingSecret) {
      nextSecrets = { ...secrets, signingSecret: body.signingSecret.trim() };
      config["signingSecretLast4"] = body.signingSecret.trim().slice(-4);
    }
  }

  if (existing.kind === "storage") {
    if (body.provider) config["provider"] = body.provider;
    if (body.bucket) config["bucket"] = body.bucket.trim();
    if (body.prefix !== undefined) config["prefix"] = body.prefix.trim();
    if (body.credentials) {
      nextSecrets = { ...secrets, credentials: body.credentials.trim() };
      config["credentialsLast4"] = body.credentials.trim().slice(-4);
    }
  }

  const row = await destinationsRosterRepository.update(tx, destinationId, {
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    config,
    ...(nextSecrets !== undefined ? { secrets: nextSecrets } : {}),
  });

  await auditDestination(tx, ctx, "reports.destination.updated", row.id, {
    name: row.name,
    isActive: row.is_active,
  });

  return updateDestinationResponseSchema.parse({
    data: mapItem(row, tenantDomains),
  });
}

export async function deleteDestination(tx: TenantTx, ctx: ServiceCtx, destinationId: string) {
  const existing = await destinationsRosterRepository.getById(tx, destinationId);
  if (!existing) {
    throw destinationNotFound();
  }

  const affected = await destinationsRosterRepository.listAffectedSchedules(tx, destinationId);

  await destinationsRosterRepository.delete(tx, destinationId);

  await auditDestination(tx, ctx, "reports.destination.deleted", destinationId, null, {
    name: existing.name,
    affectedScheduleCount: affected.length,
  });

  return deleteDestinationResponseSchema.parse({
    data: {
      deleted: true as const,
      id: destinationId,
      affectedSchedules: affected.map((row) => ({
        id: row.id,
        name: row.name?.trim() || "Untitled schedule",
      })),
    },
  });
}

// outbox-exempt: an admin clicking "Test destination" is asking whether this
// destination works right now, so the send has to happen inline and its result
// reported back. Routing it through the outbox would answer a different
// question — "was it queued" — which is exactly what the operator is trying to
// look past. Ordinary report delivery does go through the outbox, via
// `handleReportDeliveryOutboxEvent`.
export async function testDestination(
  tx: TenantTx,
  ctx: ServiceCtx,
  destinationId: string,
  deps: { sendEmail?: DestinationTestEmailSender | null } = {},
) {
  const existing = await destinationsRosterRepository.getById(tx, destinationId);
  if (!existing) {
    throw destinationNotFound();
  }
  if (!existing.is_active) {
    throw destinationValidationError("Destination is disabled.");
  }

  const tenantDomains = await destinationsRosterRepository.listTenantEmailDomains(tx);
  const config = asRecord(existing.config_json);
  const secrets = asRecord(existing.secrets_json);
  const testedAt = new Date();

  let ok = true;
  let message: string;

  if (existing.kind === "email") {
    const emails = asStringArray(config["emails"]);
    if (emails.length === 0) {
      ok = false;
      message = "No email recipients configured.";
    } else if (!deps.sendEmail) {
      ok = false;
      message = "Email provider is not configured; cannot send a live test.";
    } else {
      try {
        const [probeTo] = emails;
        if (probeTo == null) {
          ok = false;
          message = "No email recipients configured.";
        } else {
          await deps.sendEmail({
            to: probeTo,
            subject: `Atlas export destination test: ${existing.name}`,
            body: [
              "This is a live probe from Atlas LMS export destinations.",
              "",
              `Destination: ${existing.name}`,
              `Recipients configured: ${emails.length}`,
              `Request: ${ctx.requestId}`,
            ].join("\n"),
            requestId: `${ctx.requestId}:destination-test:${destinationId}`,
          });
          const external = emails.filter((address) => isExternalEmail(address, tenantDomains));
          message =
            external.length > 0
              ? `Test email sent to ${probeTo} (${emails.length} recipient(s); ${external.length} external).`
              : `Test email sent to ${probeTo} (${emails.length} recipient(s)).`;
        }
      } catch (err) {
        ok = false;
        message = err instanceof Error ? err.message : "Email test failed.";
      }
    }
  } else if (existing.kind === "webhook") {
    const url = typeof config["url"] === "string" ? config["url"] : "";
    try {
      assertHttpsUrl(url);
      const signingSecret =
        typeof secrets["signingSecret"] === "string" ? secrets["signingSecret"] : null;
      if (!signingSecret) {
        ok = false;
        message = "Signing secret is missing.";
      } else {
        const payload = {
          event: "report.destination_test",
          destinationId,
          destinationName: existing.name,
          testedAt: testedAt.toISOString(),
          requestId: ctx.requestId,
        };
        const body = JSON.stringify(payload);
        const signature = createHmac("sha256", signingSecret).update(body).digest("hex");
        // Tenant-configured destination URL: SSRF-guarded.
        const response = await safeOutboundFetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-atlas-event": "report.destination_test",
            "x-atlas-signature": signature,
            "x-atlas-signature-alg": "hmac-sha256",
            "x-request-id": ctx.requestId,
          },
          body,
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          ok = false;
          message = `Webhook probe failed with status ${response.status} (${parseWebhookParts(url).host}).`;
        } else {
          message = `Webhook probe succeeded (${parseWebhookParts(url).host}).`;
        }
      }
    } catch (err) {
      ok = false;
      message = err instanceof Error ? err.message : "Webhook test failed.";
    }
  } else {
    const bucket = typeof config["bucket"] === "string" ? config["bucket"].trim() : "";
    const prefix =
      typeof config["prefix"] === "string" ? config["prefix"].replace(/^\/+|\/+$/g, "") : "";
    if (!bucket) {
      ok = false;
      message = "Storage bucket is missing.";
    } else {
      try {
        // Live probe against Atlas-managed object storage (R2/local). External
        // provider credentials are validated for presence; object I/O uses tenant R2.
        if (!secrets["credentials"]) {
          ok = false;
          message = "Storage credentials are missing.";
        } else {
          const env = parseStorageEnv(process.env);
          const provider = getStorageProvider();
          const probeKey = [
            `tenants/${ctx.tenantId}`,
            "exports",
            "destinations",
            destinationId,
            prefix,
            ".atlas-probe",
          ]
            .filter(Boolean)
            .join("/");
          assertTenantKeyPrefix({ tenantId: ctx.tenantId, key: probeKey });
          await provider.putObject({
            bucket: env.R2_BUCKET_NAME,
            key: probeKey,
            body: Buffer.from(`atlas-destination-probe:${destinationId}:${testedAt.toISOString()}`),
            contentType: "text/plain",
          });
          const head = await provider.headObject({
            bucket: env.R2_BUCKET_NAME,
            key: probeKey,
          });
          await provider.deleteObject({
            bucket: env.R2_BUCKET_NAME,
            key: probeKey,
          });
          if (!head) {
            ok = false;
            message = `Storage probe could not verify object in ${bucket}.`;
          } else {
            const providerLabel =
              typeof config["provider"] === "string" ? config["provider"] : "s3";
            message = `Storage probe succeeded via Atlas object storage for ${providerLabel}://${bucket}${prefix ? `/${prefix}` : ""} (config bucket noted; live write used tenant store).`;
          }
        }
      } catch (err) {
        ok = false;
        message = err instanceof Error ? err.message : "Storage test failed.";
      }
    }
  }

  const health = pushHealthDay(existing.health_30d_json, ok ? "success" : "fail");
  const row = await destinationsRosterRepository.update(tx, destinationId, {
    lastDeliveryAt: testedAt,
    lastDeliveryStatus: ok ? "succeeded" : "failed",
    lastError: ok ? null : message,
    consecutiveFailures: ok ? 0 : existing.consecutive_failures + 1,
    health30d: health,
  });

  await auditDestination(tx, ctx, "reports.destination.tested", destinationId, {
    ok,
    message,
  });

  return testDestinationResponseSchema.parse({
    data: {
      ok,
      message,
      testedAt: testedAt.toISOString(),
      destination: mapItem(row, tenantDomains),
    },
  });
}

export async function exportDestinationsList(tx: TenantTx, _ctx: ServiceCtx) {
  void _ctx;
  const tenantDomains = await destinationsRosterRepository.listTenantEmailDomains(tx);
  const rows = await destinationsRosterRepository.listAllForExport(tx);
  const header = [
    "id",
    "name",
    "kind",
    "active",
    "targets",
    "last_delivery_status",
    "last_delivery_at",
    "schedule_count",
    "consecutive_failures",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const item = mapItem(row, tenantDomains);
    const targets =
      item.kind === "email"
        ? item.emails.map((e) => e.address).join(";")
        : item.kind === "webhook"
          ? (item.webhookUrl ?? "")
          : `${item.storageProvider ?? ""}://${item.storageBucket ?? ""}${item.storagePrefix ? `/${item.storagePrefix}` : ""}`;
    const cells = [
      item.id,
      item.name,
      item.kind,
      item.isActive ? "true" : "false",
      targets,
      item.lastDeliveryStatus ?? "",
      item.lastDeliveryAt ?? "",
      String(item.scheduleCount),
      String(item.consecutiveFailures),
    ].map((cell) => `"${cell.replaceAll('"', '""')}"`);
    lines.push(cells.join(","));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return exportDestinationsResponseSchema.parse({
    data: {
      format: "csv" as const,
      filename: `export-destinations-${stamp}.csv`,
      contentType: "text/csv; charset=utf-8" as const,
      content: `${lines.join("\n")}\n`,
    },
  });
}

export function previewExternalEmails(
  emails: string[],
  tenantDomains: string[],
): Array<{ address: string; isExternal: boolean; domain: string }> {
  return emails.map((address) => ({
    address,
    isExternal: isExternalEmail(address, tenantDomains),
    domain: emailDomain(address),
  }));
}
