import { createHash } from "node:crypto";
import { OutboxDeliveryError } from "@atlas/events/services/outbox-worker.service";
import type { MarketingWebhookDispatchPayload } from "./marketing-integrations.events";
import { safeOutboundFetch } from "@atlas/security/safe-outbound-fetch";
import { publishOutboxEvent } from "@atlas/events";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import {
  MARKETING_WEBHOOK_DISPATCH_EVENT,
  marketingWebhookDispatchPayloadSchema,
} from "./marketing-integrations.events";
import type { MarketingIntegrationEventKey } from "./marketing-integrations.schemas";
import { marketingIntegrationsRepository } from "./marketing-integrations.repository";

async function deliverWebhook(args: {
  url: string;
  eventKey: string;
  requestBody: string;
  idempotencyKey: string;
  timeoutMs?: number;
}): Promise<{
  ok: boolean;
  statusCode: number | null;
  message: string;
  requestBody: string;
}> {
  const requestBody = args.requestBody;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, args.timeoutMs ?? 8000);
  try {
    // Tenant-configured URL: SSRF-guarded (protocol allowlist, resolved-address
    // check, no redirect following).
    const response = await safeOutboundFetch(args.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Atlas-Marketing-Integrations/1.0",
        "x-atlas-event": args.eventKey,
        "idempotency-key": args.idempotencyKey,
      },
      body: requestBody,
      signal: controller.signal,
    });
    const message = response.ok
      ? `Delivered with status ${response.status}.`
      : `Remote responded with status ${response.status}.`;
    return { ok: response.ok, statusCode: response.status, message, requestBody };
  } catch {
    const message = "WEBHOOK_ACCEPTANCE_UNKNOWN";
    return { ok: false, statusCode: null, message, requestBody };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Queue webhook fan-out for an event.
 *
 * This is the request-path entry point and it performs **no network I/O**. It
 * used to loop over every enabled webhook and await an 8 s-timeout HTTP call
 * for each, sequentially, inside the caller's tenant transaction — on public
 * signup and on enrollment. Five slow or dead tenant-configured URLs pinned a
 * pooled connection for up to 40 s on an unauthenticated request: the same
 * shape as C6, which Phase 1 measured at 0 rps and a 10 s stall.
 *
 * Delivery now happens in `deliverMarketingIntegrationWebhooks` under the
 * outbox worker, which also gives it retries. Callers never depended on
 * delivery having completed — the old function was documented as never
 * throwing — so this is not an observable change for them.
 */
export async function dispatchMarketingIntegrationWebhooks(
  tx: TenantTx,
  ctx: ServiceCtx,
  eventKey: MarketingIntegrationEventKey,
  payload: Record<string, unknown>,
): Promise<void> {
  // Skip the enqueue entirely when the tenant has no webhook for this event,
  // so the outbox does not accumulate events with nothing to deliver.
  const webhooks = await marketingIntegrationsRepository.listEnabledWebhooksForEvent(tx, eventKey);
  if (webhooks.length === 0) return;

  await publishOutboxEvent(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: MARKETING_WEBHOOK_DISPATCH_EVENT,
    aggregateType: "marketing_integration_event",
    aggregateId: ctx.tenantId,
    payload: marketingWebhookDispatchPayloadSchema.parse({
      eventKey,
      data: payload,
      schemaVersion: 1,
    }),
    idempotencyKey: `${ctx.requestId}:marketing-webhook:${eventKey}`,
  });
}

async function prepareMarketingWebhookDeliveries(
  db: { transaction: <T>(fn: (tx: TenantTx) => Promise<T>) => Promise<T> },
  ctx: Pick<ServiceCtx, "tenantId" | "requestId">,
  event: { id: string; payload: MarketingWebhookDispatchPayload },
): Promise<void> {
  const { eventKey, data } = event.payload;
  await db.transaction(async (tx) => {
    const webhooks = await marketingIntegrationsRepository.listEnabledWebhooksForEvent(
      tx,
      eventKey,
    );
    const requestBody = JSON.stringify({
      event: eventKey,
      occurredAt: new Date().toISOString(),
      data: { ...data, tenantId: ctx.tenantId },
    });
    for (const webhook of webhooks) {
      const idempotencyKey =
        "atlas-webhook-" +
        createHash("sha256")
          .update(JSON.stringify([event.id, webhook.id]))
          .digest("hex");
      await publishOutboxEvent(tx, {
        ctx,
        eventType: MARKETING_WEBHOOK_DISPATCH_EVENT,
        aggregateType: "marketing_integration_endpoint",
        aggregateId: webhook.id,
        payload: {
          eventKey,
          data: {},
          schemaVersion: 1,
          delivery: { webhookId: webhook.id, url: webhook.url, idempotencyKey, requestBody },
        },
        idempotencyKey,
      });
    }
  });
}

/** Create one durable job per endpoint, or send a single frozen endpoint snapshot. */
export async function deliverMarketingIntegrationWebhooks(
  db: { transaction: <T>(fn: (tx: TenantTx) => Promise<T>) => Promise<T> },
  ctx: Pick<ServiceCtx, "tenantId" | "requestId">,
  event: { id: string; payload: MarketingWebhookDispatchPayload },
): Promise<void> {
  const { eventKey, delivery } = event.payload;
  if (!delivery) {
    await prepareMarketingWebhookDeliveries(db, ctx, event);
    return;
  }

  // The header is a correlation key: arbitrary tenant endpoints do not promise deduplication.
  const result = await deliverWebhook({
    url: delivery.url,
    eventKey,
    requestBody: delivery.requestBody,
    idempotencyKey: delivery.idempotencyKey,
  });
  try {
    await db.transaction(async (tx) => {
      await marketingIntegrationsRepository.markWebhookDelivery(tx, {
        id: delivery.webhookId,
        status: result.ok
          ? `ok:${result.statusCode ?? 0}`
          : `error:${result.statusCode ?? "unknown"}`,
      });
      await marketingIntegrationsRepository.insertDelivery(tx, {
        webhookId: delivery.webhookId,
        eventKey,
        url: delivery.url,
        ok: result.ok,
        statusCode: result.statusCode,
        message: result.message,
        requestBody: delivery.requestBody,
        source: "dispatch",
      });
    });
  } catch {
    throw new OutboxDeliveryError("reconciliation_required", "WEBHOOK_RECEIPT_UNKNOWN");
  }
  if (result.ok) return;
  if (result.statusCode === 429) throw new OutboxDeliveryError("retryable", "WEBHOOK_RATE_LIMITED");
  if (
    result.statusCode !== null &&
    result.statusCode >= 400 &&
    result.statusCode < 500 &&
    result.statusCode !== 408
  ) {
    throw new OutboxDeliveryError("permanent", "WEBHOOK_REJECTED");
  }
  // A timeout or server error may occur after the receiver performed the action.
  throw new OutboxDeliveryError("reconciliation_required", "WEBHOOK_ACCEPTANCE_UNKNOWN");
}
