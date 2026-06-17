import type { EventsDbTx } from "../transaction";
import { pollOutboxEventsForProcessing } from "../repositories/outbox.repository";
import {
  findEventDelivery,
  insertEventDeliveryAttempt,
} from "../repositories/event-delivery.repository";
import { insertDeadLetterEvent } from "../repositories/dead-letter.repository";

export type OutboxHandler = {
  destinationKey: string;
  handle: (event: {
    id: string;
    eventType: string;
    tenantId: string | null;
    payload: unknown;
    requestId: string;
  }) => Promise<void>;
};

export async function processOutboxBatch(
  tx: EventsDbTx,
  args: {
    limit: number;
    handlers: Record<string, OutboxHandler[]>;
    maxRetries: number;
  },
): Promise<{ processed: number; delivered: number; failed: number; skipped: number }> {
  const events = await pollOutboxEventsForProcessing(tx, args.limit);

  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const event of events) {
    const handlers = args.handlers[event.event_type] ?? [];
    const metadata = event.metadata_json as { requestId?: string } | null;
    const requestId = metadata?.requestId ?? "unknown";

    for (const handler of handlers) {
      const existingDelivery = await findEventDelivery(tx, {
        outboxEventId: event.id,
        destinationKey: handler.destinationKey,
      });

      if (existingDelivery != null) {
        skipped += 1;
        continue;
      }

      try {
        await handler.handle({
          id: event.id,
          eventType: event.event_type,
          tenantId: event.tenant_id,
          payload: event.payload_json,
          requestId,
        });

        await insertEventDeliveryAttempt(tx, {
          tenantId: event.tenant_id,
          outboxEventId: event.id,
          destinationKey: handler.destinationKey,
          status: "SUCCEEDED",
          requestId,
        });

        delivered += 1;
      } catch (error) {
        const safeMessage = error instanceof Error ? error.message.slice(0, 500) : "Unknown error";

        await insertEventDeliveryAttempt(tx, {
          tenantId: event.tenant_id,
          outboxEventId: event.id,
          destinationKey: handler.destinationKey,
          status: "FAILED",
          errorCode: "HANDLER_FAILED",
          safeErrorMessage: safeMessage,
          requestId,
        });

        await insertDeadLetterEvent(tx, {
          outboxEventId: event.id,
          tenantId: event.tenant_id,
          destinationKey: handler.destinationKey,
          eventType: event.event_type,
          errorCode: "HANDLER_FAILED",
          safeErrorMessage: safeMessage,
          retryCount: 1,
          requestId,
          payloadJson: event.payload_json,
        });

        failed += 1;
      }
    }
  }

  return {
    processed: events.length,
    delivered,
    failed,
    skipped,
  };
}
