import { createHash, createHmac } from "node:crypto";
import { safeOutboundFetch } from "@atlas/security/safe-outbound-fetch";
import type { TenantTx } from "@atlas/db";
import { assertTenantKeyPrefix, getStorageProvider, parseStorageEnv } from "@atlas/storage";
import { mapRunBaseDto } from "./reports.service";
import { OutboxDeliveryError } from "@atlas/events/services/outbox-worker.service";
import {
  reportDeliveryEffectsRepository,
  type ReportDeliveryEffect,
} from "./report-delivery-effects.repository";
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
  idempotencyKey: string;
}) => Promise<void>;

export type ReportDeliveryTransaction = <T>(fn: (tx: TenantTx) => Promise<T>) => Promise<T>;
type DeliveryArgs = {
  reportRunId: string;
  sendEmail: ReportDeliveryEmailSender | null;
  emailSupportsIdempotency?: boolean;
  resolveMembershipEmail: (tx: TenantTx, membershipId: string) => Promise<string | null>;
};

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

/** Only database reads and recipient resolution happen in this short transaction. */
async function prepareReportDelivery(tx: TenantTx, ctx: ServiceCtx, args: DeliveryArgs) {
  const run = await reportsRepository.findReportRunById(tx, args.reportRunId);
  if (!run || run.tenant_id !== ctx.tenantId || run.status !== "SUCCEEDED" || !run.r2_object_key)
    return null;
  const detail = { data: mapRunBaseDto(run) };
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
    const schedules = await reportsRepository.listSchedules(tx);
    const schedule = schedules.find((item) => item.id === detail.data.scheduleId);
    const delivery = schedule ? asRecord(schedule.delivery_json) : null;
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
    const actorEmail = await args.resolveMembershipEmail(tx, detail.data.requestedByMembershipId);
    if (actorEmail && (deliveryMode === "email_me" || emails.length === 0)) {
      emails = [...new Set([actorEmail, ...emails])];
    }
  }

  return {
    run,
    data: detail.data,
    emails: [...new Set(emails)],
    webhookUrl,
    webhookSigningSecret,
    destinationId,
    storageDestination,
  };
}

function effectKey(ctx: ServiceCtx, runId: string, kind: string, endpoint: string): string {
  return `report:${createHash("sha256")
    .update(JSON.stringify([ctx.tenantId, runId, kind, endpoint]))
    .digest("hex")}`;
}

async function freezeRequests(
  ctx: ServiceCtx,
  plan: NonNullable<Awaited<ReturnType<typeof prepareReportDelivery>>>,
  args: DeliveryArgs,
): Promise<ReportDeliveryEffect[]> {
  const { data, emails, webhookUrl, webhookSigningSecret, destinationId, storageDestination } =
    plan;
  const effects: ReportDeliveryEffect[] = [];
  if (!emails.length && !webhookUrl && !storageDestination) return effects;
  const objectKey = plan.run.r2_object_key;
  if (!objectKey) throw new OutboxDeliveryError("permanent", "REPORT_STORAGE_SOURCE_MISSING");
  const env = parseStorageEnv(process.env);
  const artifact = asRecord(plan.run.artifact_json);
  if (
    plan.run.artifact_json != null &&
    (artifact["provider"] !== env.STORAGE_PROVIDER || artifact["bucket"] !== env.R2_BUCKET_NAME)
  )
    throw new OutboxDeliveryError("permanent", "REPORT_STORAGE_IDENTITY_CHANGED");
  const retentionExpiry = plan.run.expires_at;
  const ttl = retentionExpiry
    ? Math.min(
        env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS,
        Math.floor((retentionExpiry.getTime() - Date.now()) / 1000),
      )
    : 0;
  if (!retentionExpiry || ttl < 1)
    throw new OutboxDeliveryError("permanent", "REPORT_ARTIFACT_EXPIRED");
  assertTenantKeyPrefix({ tenantId: ctx.tenantId, key: objectKey });
  // Signing can call a storage adapter, so it too runs outside the transaction.
  const signed = await getStorageProvider().createSignedDownloadUrl({
    bucket: env.R2_BUCKET_NAME,
    key: objectKey,
    expiresInSeconds: ttl,
  });
  const downloadUrl = signed.url;
  const expiresAt = new Date(
    Math.min(signed.expiresAt.getTime(), retentionExpiry.getTime()),
  ).toISOString();
  for (const to of emails) {
    const key = effectKey(ctx, data.id, "email", to);
    effects.push({
      effectKey: key,
      kind: "email",
      destinationId,
      retryOnCrash: args.emailSupportsIdempotency === true,
      request: {
        expiresAt,
        to,
        subject: `${data.definitionTitle} export is ready`,
        body: [
          `Your ${data.definitionTitle} export is ready.`,
          "",
          `Format: ${data.format.toUpperCase()}`,
          `Rows: ${data.rowCount ?? 0}`,
          `Download (expires ${expiresAt}):`,
          downloadUrl,
          "",
          `Run ID: ${data.id}`,
        ].join("\n"),
        requestId: key,
        idempotencyKey: key,
      },
    });
  }
  if (webhookUrl) {
    const key = effectKey(ctx, data.id, "webhook", webhookUrl);
    const body = JSON.stringify({
      event: "report.run_succeeded",
      reportRunId: data.id,
      definitionKey: data.definitionKey,
      format: data.format,
      rowCount: data.rowCount,
      downloadUrl,
      expiresAt,
      completedAt: data.completedAt,
    });
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-atlas-event": "report.run_succeeded",
      "x-request-id": key,
      "idempotency-key": key,
    };
    if (webhookSigningSecret) {
      headers["x-atlas-signature"] = signWebhookBody(body, webhookSigningSecret);
      headers["x-atlas-signature-alg"] = "hmac-sha256";
    }
    effects.push({
      effectKey: key,
      kind: "webhook",
      destinationId,
      // The header aids receiver deduplication but is not an acceptance guarantee.
      retryOnCrash: false,
      request: { url: webhookUrl, body, headers, expiresAt },
    });
  }
  if (storageDestination) {
    effects.push({
      effectKey: effectKey(ctx, data.id, "storage", storageDestination.id),
      kind: "storage",
      destinationId: storageDestination.id,
      retryOnCrash: true,
      request: {
        destination: { id: storageDestination.id, config_json: storageDestination.config_json },
        objectKey: plan.run.r2_object_key,
        format: data.format,
        definitionKey: data.definitionKey,
        reportRunId: data.id,
      },
    });
  }
  return effects;
}

async function executeEffect(
  effect: ReportDeliveryEffect,
  ctx: ServiceCtx,
  args: DeliveryArgs,
): Promise<void> {
  if (effect.kind === "email" || effect.kind === "webhook") {
    const expiresAt = effect.request["expiresAt"];
    const expiry = typeof expiresAt === "string" ? Date.parse(expiresAt) : NaN;
    // Frozen provider bytes cannot be refreshed on retry. An expired link needs
    // a new report run; successful receipts are skipped before reaching here.
    if (!Number.isFinite(expiry) || expiry <= Date.now()) {
      throw new OutboxDeliveryError("permanent", "REPORT_DELIVERY_LINK_EXPIRED");
    }
  }
  if (effect.kind === "email") {
    if (!args.sendEmail) throw new OutboxDeliveryError("retryable", "REPORT_EMAIL_NOT_CONFIGURED");
    await args.sendEmail(effect.request as Parameters<ReportDeliveryEmailSender>[0]);
  } else if (effect.kind === "webhook") {
    const request = effect.request as {
      url: string;
      body: string;
      headers: Record<string, string>;
    };
    const response = await safeOutboundFetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new OutboxDeliveryError(
        response.status === 429
          ? "retryable"
          : response.status >= 500 || response.status === 408
            ? "reconciliation_required"
            : "permanent",
        `REPORT_WEBHOOK_HTTP_${response.status}`,
      );
  } else {
    await deliverToStorageDestination({
      ctx,
      ...(effect.request as Omit<Parameters<typeof deliverToStorageDestination>[0], "ctx">),
    });
  }
}

function deliveryError(error: unknown, effect: ReportDeliveryEffect): OutboxDeliveryError {
  const kind = asRecord(error)["kind"];
  if (kind === "retryable" || kind === "permanent" || kind === "reconciliation_required") {
    const code = asRecord(error)["code"];
    return new OutboxDeliveryError(
      kind,
      typeof code === "string" ? code : "REPORT_DELIVERY_FAILED",
    );
  }
  return new OutboxDeliveryError(
    !effect.retryOnCrash ? "reconciliation_required" : "retryable",
    "REPORT_DELIVERY_OUTCOME_UNKNOWN",
  );
}

/** Prepare/claim/receipt transactions never enclose external delivery. */
export async function deliverSucceededReportRun(
  withTx: ReportDeliveryTransaction,
  ctx: ServiceCtx,
  args: DeliveryArgs,
): Promise<{
  emailed: number;
  webhookDelivered: boolean;
  storageDelivered: boolean;
  skipped: boolean;
}> {
  let effects = await withTx((tx) => reportDeliveryEffectsRepository.list(tx, args.reportRunId));
  if (!effects.length) {
    const plan = await withTx((tx) => prepareReportDelivery(tx, ctx, args));
    if (!plan)
      return { emailed: 0, webhookDelivered: false, storageDelivered: false, skipped: true };
    const requests = await freezeRequests(ctx, plan, args);
    effects = await withTx((tx) =>
      reportDeliveryEffectsRepository.freeze(tx, args.reportRunId, requests),
    );
  }
  const result = {
    emailed: 0,
    webhookDelivered: false,
    storageDelivered: false,
    skipped: effects.length === 0,
  };
  let failureToReport: OutboxDeliveryError | null = null;
  const outcomePriority = { permanent: 1, reconciliation_required: 2, retryable: 3 };
  for (const effect of effects) {
    try {
      const claim = await withTx((tx) =>
        reportDeliveryEffectsRepository.claim(tx, effect.effectKey),
      );
      if (claim.status === "succeeded") continue;
      if (claim.status !== "claimed" || !claim.leaseToken) {
        throw new OutboxDeliveryError(
          claim.status === "reconciliation_required"
            ? "reconciliation_required"
            : claim.status === "permanent"
              ? "permanent"
              : "retryable",
          `REPORT_EFFECT_${claim.status.toUpperCase()}`,
        );
      }
      const leaseToken = claim.leaseToken;
      let failure: OutboxDeliveryError | null = null;
      try {
        await executeEffect(effect, ctx, args);
      } catch (error) {
        failure = deliveryError(error, effect);
      }
      // A receipt-write failure leaves processing intact: SMTP must reconcile.
      const recorded = await withTx(async (tx) => {
        const recorded = await reportDeliveryEffectsRepository.finish(
          tx,
          effect.effectKey,
          leaseToken,
          failure
            ? failure.kind === "reconciliation_required"
              ? "reconciliation_required"
              : "failed"
            : "succeeded",
          failure?.kind ?? null,
          failure?.code ?? null,
        );
        if (recorded && effect.destinationId) {
          const destination = await destinationsRosterRepository.getById(tx, effect.destinationId);
          if (destination)
            await recordDestinationDelivery(tx, destination, !failure, failure?.code ?? null);
        }
        return recorded;
      }).catch(() => {
        throw new OutboxDeliveryError(
          effect.retryOnCrash ? "retryable" : "reconciliation_required",
          "REPORT_EFFECT_RECEIPT_COMMIT_FAILED",
        );
      });
      if (!recorded)
        throw new OutboxDeliveryError("reconciliation_required", "REPORT_EFFECT_RECEIPT_LOST");
      if (failure) throw failure;
      if (effect.kind === "email") result.emailed += 1;
      if (effect.kind === "webhook") result.webhookDelivered = true;
      if (effect.kind === "storage") result.storageDelivered = true;
    } catch (error) {
      const failure =
        error instanceof OutboxDeliveryError
          ? error
          : new OutboxDeliveryError("retryable", "REPORT_EFFECT_STATE_UNAVAILABLE");
      // Keep the parent retryable while any independent endpoint has pending
      // work. Terminal/held receipts are skipped on those retries. Once pending
      // work finishes, reconciliation takes precedence over permanent failure.
      if (
        !failureToReport ||
        outcomePriority[failure.kind] > outcomePriority[failureToReport.kind]
      ) {
        failureToReport = failure;
      }
    }
  }
  if (failureToReport) throw failureToReport;
  return result;
}

export { signWebhookBody };
