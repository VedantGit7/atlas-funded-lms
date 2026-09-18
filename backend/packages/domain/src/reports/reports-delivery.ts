import { createHmac } from "node:crypto";
import { safeOutboundFetch } from "@atlas/security/safe-outbound-fetch";
import type { TenantTx } from "@atlas/db";
import { assertTenantKeyPrefix, getStorageProvider, parseStorageEnv } from "@atlas/storage";
import { getReportRun, listReportSchedules } from "./reports.service";
import { reportsRepository } from "./reports.repository";
import type { ServiceCtx } from "./reports.types";
import {
  destinationsRosterRepository,
  pushHealthDay,
  type DestinationRow,
} from "./destinations-roster.repository";

export type ReportDeliveryEmailSender = (input: {
  to: string;
  subject: string;
  body: string;
  requestId: string;
}) => Promise<void>;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readWebhookUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function contentTypeForFormat(format: string): string {
  if (format === "xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (format === "pdf") return "application/pdf";
  if (format === "json") return "application/json";
  return "text/csv; charset=utf-8";
}

function extensionForFormat(format: string): string {
  if (format === "xlsx") return "xlsx";
  if (format === "pdf") return "pdf";
  if (format === "json") return "json";
  return "csv";
}

function signWebhookBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function recordDestinationDelivery(
  tx: TenantTx,
  destination: DestinationRow,
  ok: boolean,
  error: string | null,
) {
  const health = pushHealthDay(destination.health_30d_json, ok ? "success" : "fail");
  await destinationsRosterRepository.update(tx, destination.id, {
    lastDeliveryAt: new Date(),
    lastDeliveryStatus: ok ? "succeeded" : "failed",
    lastError: ok ? null : error,
    consecutiveFailures: ok ? 0 : destination.consecutive_failures + 1,
    health30d: health,
  });
}

async function deliverToStorageDestination(args: {
  ctx: ServiceCtx;
  destination: DestinationRow;
  objectKey: string;
  format: string;
  definitionKey: string;
  reportRunId: string;
}): Promise<void> {
  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();
  assertTenantKeyPrefix({ tenantId: args.ctx.tenantId, key: args.objectKey });
  const body = await provider.getObjectBody({
    bucket: env.R2_BUCKET_NAME,
    key: args.objectKey,
  });
  if (!body) {
    throw new Error("REPORT_STORAGE_SOURCE_MISSING");
  }

  const config = asRecord(args.destination.config_json);
  const prefix =
    typeof config["prefix"] === "string" ? config["prefix"].replace(/^\/+|\/+$/g, "") : "";
  const fileName = `${args.definitionKey}-${args.reportRunId}.${extensionForFormat(args.format)}`;
  const destKey = [
    `tenants/${args.ctx.tenantId}`,
    "exports",
    "destinations",
    args.destination.id,
    prefix,
    fileName,
  ]
    .filter(Boolean)
    .join("/");
  assertTenantKeyPrefix({ tenantId: args.ctx.tenantId, key: destKey });

  await provider.putObject({
    bucket: env.R2_BUCKET_NAME,
    key: destKey,
    body,
    contentType: contentTypeForFormat(args.format),
  });
}

/**
 * Delivers a succeeded report run via email and/or webhook using params_json,
 * optional schedule delivery_json, and saved destinations (destinationId).
 */
export async function deliverSucceededReportRun(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    reportRunId: string;
    sendEmail: ReportDeliveryEmailSender | null;
    resolveMembershipEmail: (membershipId: string) => Promise<string | null>;
  },
): Promise<{
  emailed: number;
  webhookDelivered: boolean;
  storageDelivered: boolean;
  skipped: boolean;
}> {
  const detail = await getReportRun(tx, ctx, args.reportRunId);
  if (detail.data.status !== "SUCCEEDED" || !detail.data.download) {
    return { emailed: 0, webhookDelivered: false, storageDelivered: false, skipped: true };
  }

  const params = detail.data.params;
  const paramsDelivery = asRecord(params["delivery"]);
  let deliveryMode =
    typeof params["deliveryMode"] === "string"
      ? params["deliveryMode"]
      : typeof paramsDelivery["kind"] === "string"
        ? paramsDelivery["kind"]
        : "download";

  let emails = asStringArray(params["deliveryEmails"]);
  if (emails.length === 0) {
    emails = asStringArray(paramsDelivery["recipients"]);
  }
  let webhookUrl = readWebhookUrl(params["webhookUrl"] ?? paramsDelivery["url"]);
  let webhookSigningSecret: string | null =
    typeof paramsDelivery["signingSecret"] === "string" ? paramsDelivery["signingSecret"] : null;
  let destinationId =
    typeof params["destinationId"] === "string"
      ? params["destinationId"]
      : typeof paramsDelivery["destinationId"] === "string"
        ? paramsDelivery["destinationId"]
        : null;
  let storageDestination: DestinationRow | null = null;

  if (detail.data.scheduleId) {
    const schedules = await listReportSchedules(tx, ctx);
    const schedule = schedules.data.items.find((item) => item.id === detail.data.scheduleId);
    const delivery = schedule?.delivery ?? null;
    if (delivery) {
      const scheduleEmails = asStringArray(delivery["emails"]);
      if (scheduleEmails.length > 0) emails = [...new Set([...emails, ...scheduleEmails])];
      const scheduleWebhook = readWebhookUrl(delivery["webhookUrl"]);
      if (scheduleWebhook) webhookUrl = scheduleWebhook;
      if (typeof delivery["mode"] === "string" && delivery["mode"].trim()) {
        deliveryMode = delivery["mode"];
      }
      if (typeof delivery["kind"] === "string" && delivery["kind"].trim()) {
        deliveryMode = delivery["kind"];
      }
      if (typeof delivery["destinationId"] === "string" && delivery["destinationId"].trim()) {
        destinationId = delivery["destinationId"];
      }
    }
  }

  if (destinationId) {
    const destination = await destinationsRosterRepository.getById(tx, destinationId);
    if (!destination || !destination.is_active) {
      throw new Error("REPORT_DESTINATION_UNAVAILABLE");
    }
    const config = asRecord(destination.config_json);
    const secrets = asRecord(destination.secrets_json);

    if (destination.kind === "email") {
      const destEmails = asStringArray(config["emails"]);
      emails = [...new Set([...emails, ...destEmails])];
      deliveryMode = "email";
    } else if (destination.kind === "webhook") {
      const destUrl = readWebhookUrl(config["url"] ?? config["webhookUrl"]);
      if (destUrl) webhookUrl = destUrl;
      if (typeof secrets["signingSecret"] === "string") {
        webhookSigningSecret = secrets["signingSecret"];
      }
      deliveryMode = "webhook";
    } else if (destination.kind === "storage") {
      storageDestination = destination;
      deliveryMode = "storage";
    }
  }

  if (deliveryMode === "email_me" || deliveryMode === "email") {
    const actorEmail = await args.resolveMembershipEmail(detail.data.requestedByMembershipId);
    if (actorEmail && (deliveryMode === "email_me" || emails.length === 0)) {
      emails = [...new Set([actorEmail, ...emails])];
    }
  }

  const shouldEmail = emails.length > 0;
  const shouldWebhook = Boolean(webhookUrl);
  const shouldStorage = Boolean(storageDestination);

  if (!shouldEmail && !shouldWebhook && !shouldStorage) {
    return { emailed: 0, webhookDelivered: false, storageDelivered: false, skipped: true };
  }

  const downloadUrl = detail.data.download.url;
  const expiresAt = detail.data.download.expiresAt;
  const title = detail.data.definitionTitle;
  let emailed = 0;
  let webhookDelivered = false;
  let storageDelivered = false;

  if (shouldEmail && args.sendEmail) {
    const subject = `${title} export is ready`;
    const body = [
      `Your ${title} export is ready.`,
      "",
      `Format: ${detail.data.format.toUpperCase()}`,
      `Rows: ${detail.data.rowCount ?? 0}`,
      `Download (expires ${expiresAt}):`,
      downloadUrl,
      "",
      `Run ID: ${detail.data.id}`,
    ].join("\n");

    for (const to of emails) {
      await args.sendEmail({
        to,
        subject,
        body,
        requestId: `${ctx.requestId}:report-delivery:${detail.data.id}:${to}`,
      });
      emailed += 1;
    }
  } else if (shouldEmail && !args.sendEmail) {
    throw new Error("REPORT_EMAIL_NOT_CONFIGURED");
  }

  if (shouldWebhook && webhookUrl) {
    const payload = {
      event: "report.run_succeeded",
      reportRunId: detail.data.id,
      definitionKey: detail.data.definitionKey,
      format: detail.data.format,
      rowCount: detail.data.rowCount,
      downloadUrl,
      expiresAt,
      completedAt: detail.data.completedAt,
    };
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-atlas-event": "report.run_succeeded",
      "x-request-id": ctx.requestId,
    };
    if (webhookSigningSecret) {
      headers["x-atlas-signature"] = signWebhookBody(body, webhookSigningSecret);
      headers["x-atlas-signature-alg"] = "hmac-sha256";
    }

    // Tenant-configured destination URL: SSRF-guarded. Note the payload carries
    // a signed report download URL, so an unguarded fetch could hand tenant data
    // to an attacker-chosen endpoint.
    const response = await safeOutboundFetch(webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      if (destinationId) {
        const dest = await destinationsRosterRepository.getById(tx, destinationId);
        if (dest) {
          await recordDestinationDelivery(
            tx,
            dest,
            false,
            `Webhook failed with status ${response.status}`,
          );
        }
      }
      throw new Error(`REPORT_WEBHOOK_FAILED:${response.status}`);
    }
    webhookDelivered = true;
  }

  if (shouldStorage && storageDestination) {
    const runRow = await reportsRepository.findReportRunById(tx, args.reportRunId);
    const objectKey = runRow?.r2_object_key ?? null;
    if (!objectKey) {
      await recordDestinationDelivery(tx, storageDestination, false, "Export file missing.");
      throw new Error("REPORT_STORAGE_SOURCE_MISSING");
    }

    try {
      await deliverToStorageDestination({
        ctx,
        destination: storageDestination,
        objectKey,
        format: detail.data.format,
        definitionKey: detail.data.definitionKey,
        reportRunId: detail.data.id,
      });
      storageDelivered = true;
      await recordDestinationDelivery(tx, storageDestination, true, null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Storage delivery failed.";
      await recordDestinationDelivery(tx, storageDestination, false, message);
      throw error;
    }
  }

  if (destinationId && (shouldEmail || shouldWebhook) && !shouldStorage) {
    const dest = await destinationsRosterRepository.getById(tx, destinationId);
    if (dest) {
      await recordDestinationDelivery(tx, dest, true, null);
    }
  }

  return { emailed, webhookDelivered, storageDelivered, skipped: false };
}

export { signWebhookBody };
