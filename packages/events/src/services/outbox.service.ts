import { assertApprovedEventType } from "../event-types";
import { insertOutboxEvent } from "../repositories/outbox.repository";
import { OutboxEventEnvelopeSchema } from "../schemas/event-envelope";
import type { EventsDbTx } from "../transaction";

export type OutboxPublishInput = {
  ctx: {
    tenantId: string | null;
    actorMembershipId?: string | null;
    requestId: string;
  };
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  schemaVersion?: number;
  idempotencyKey?: string | null;
  availableAt?: Date;
};

export async function publishOutboxEvent(
  tx: EventsDbTx,
  input: OutboxPublishInput,
): Promise<{ id: string }> {
  assertApprovedEventType(input.eventType);

  const eventId = crypto.randomUUID();
  const occurredAt = new Date();

  const envelope = OutboxEventEnvelopeSchema.parse({
    eventId,
    tenantId: input.ctx.tenantId,
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    actorMembershipId: input.ctx.actorMembershipId ?? null,
    occurredAt: occurredAt.toISOString(),
    schemaVersion: input.schemaVersion ?? 1,
    payloadJson: input.payload,
    metadataJson: {
      requestId: input.ctx.requestId,
      idempotencyKey: input.idempotencyKey ?? undefined,
    },
    idempotencyKey: input.idempotencyKey ?? null,
  });

  return insertOutboxEvent(tx, {
    id: eventId,
    tenantId: envelope.tenantId,
    eventType: envelope.eventType,
    aggregateType: envelope.aggregateType,
    aggregateId: envelope.aggregateId,
    actorMembershipId: envelope.actorMembershipId ?? null,
    payloadJson: envelope.payloadJson,
    metadataJson: {
      requestId: envelope.metadataJson.requestId,
      ...(envelope.metadataJson.idempotencyKey != null
        ? { idempotencyKey: envelope.metadataJson.idempotencyKey }
        : {}),
    },
    schemaVersion: envelope.schemaVersion,
    idempotencyKey: envelope.idempotencyKey ?? null,
    ...(input.availableAt != null ? { availableAt: input.availableAt } : {}),
  });
}

export const outbox = {
  publish: publishOutboxEvent,
};
