import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
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
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 8000);
  try {
    const response = await fetch(args.url, {
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
    const message =
      error instanceof Error ? error.message : "Webhook delivery failed.";
    return { ok: false, statusCode: null, message, requestBody };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fan-out enabled webhook URLs for an event. Delivery failures are recorded but
 * do not throw - callers must not fail because a remote URL is down.
 */
export async function dispatchMarketingIntegrationWebhooks(
  tx: TenantTx,
  ctx: Pick<ServiceCtx, "tenantId">,
  eventKey: MarketingIntegrationEventKey,
  payload: Record<string, unknown>,
): Promise<void> {
  const webhooks = await marketingIntegrationsRepository.listEnabledWebhooksForEvent(
    tx,
    eventKey,
  );
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
