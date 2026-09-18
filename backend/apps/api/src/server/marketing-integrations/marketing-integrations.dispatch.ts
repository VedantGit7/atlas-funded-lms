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
  payload: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<{
  ok: boolean;
  statusCode: number | null;
  message: string;
  requestBody: string;
}> {
  const requestBody = JSON.stringify({
    event: args.eventKey,
    occurredAt: new Date().toISOString(),
    data: args.payload,
  });
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
      },
      body: requestBody,
      signal: controller.signal,
    });
    const message = response.ok
      ? `Delivered with status ${response.status}.`
      : `Remote responded with status ${response.status}.`;
    return { ok: response.ok, statusCode: response.status, message, requestBody };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook delivery failed.";
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

/**
 * Perform the fan-out. Runs under the outbox worker, never in a request.
 *
 * Delivery failures are recorded but do not throw: one dead remote URL must not
 * fail the whole batch or block the other webhooks for that event.
 */
export async function deliverMarketingIntegrationWebhooks(
  tx: TenantTx,
  ctx: Pick<ServiceCtx, "tenantId">,
  eventKey: MarketingIntegrationEventKey,
  payload: Record<string, unknown>,
): Promise<void> {
  const webhooks = await marketingIntegrationsRepository.listEnabledWebhooksForEvent(tx, eventKey);
  if (webhooks.length === 0) return;

  for (const webhook of webhooks) {
    const result = await deliverWebhook({
      url: webhook.url,
      eventKey,
      payload: {
        tenantId: ctx.tenantId,
        ...payload,
      },
    });
    try {
      await marketingIntegrationsRepository.markWebhookDelivery(tx, {
        id: webhook.id,
        status: result.ok
          ? `ok:${result.statusCode ?? 0}`
          : `error:${result.message.slice(0, 180)}`,
      });
      await marketingIntegrationsRepository.insertDelivery(tx, {
        webhookId: webhook.id,
        eventKey,
        url: webhook.url,
        ok: result.ok,
        statusCode: result.statusCode,
        message: result.message,
        requestBody: result.requestBody,
        source: "dispatch",
      });
    } catch {
      // Best-effort status write.
    }
  }
}
