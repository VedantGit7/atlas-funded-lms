import { withTenantTx } from "@atlas/db";
import type { OutboxHandler } from "@atlas/events";
import {
  MARKETING_WEBHOOK_DISPATCH_EVENT,
  MARKETING_WEBHOOK_WORKER_DESTINATION,
  marketingWebhookDispatchPayloadSchema,
} from "./marketing-integrations.events";
import { deliverMarketingIntegrationWebhooks } from "./marketing-integrations.dispatch";

/**
 * Delivers tenant webhook fan-out off the request path.
 *
 * See `marketing-integrations.events.ts` for why this moved: the fan-out used
 * to run inline inside the caller's tenant transaction, holding a pooled
 * connection across up to 8 s of network I/O per configured webhook.
 */
export async function handleMarketingWebhookOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.eventType !== MARKETING_WEBHOOK_DISPATCH_EVENT) return;
  if (event.tenantId == null) {
    throw new Error("Marketing webhook dispatch requires tenant-scoped events.");
  }
  const tenantId = event.tenantId;

  const payload = marketingWebhookDispatchPayloadSchema.parse(event.payload);

  await deliverMarketingIntegrationWebhooks(
    {
      transaction: (fn) =>
        withTenantTx({ tenantId, requestId: event.requestId, allowAnonymousTenantRead: true }, fn),
    },
    { tenantId, requestId: event.requestId },
    { id: event.id, payload },
  );
}

export const marketingWebhookOutboxHandlers: OutboxHandler[] = [
  {
    destinationKey: MARKETING_WEBHOOK_WORKER_DESTINATION,
    retryOnCrash: false,
    handle: handleMarketingWebhookOutboxEvent,
  },
];

export { MARKETING_WEBHOOK_DISPATCH_EVENT, MARKETING_WEBHOOK_WORKER_DESTINATION };
