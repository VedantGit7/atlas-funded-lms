import { z } from "zod";

export const OutboxEventEnvelopeSchema = z.object({
  eventId: z.uuid(),
  tenantId: z.uuid().nullable(),
  eventType: z.string().min(1).max(160),
  aggregateType: z.string().min(1).max(120),
  aggregateId: z.uuid(),
  actorMembershipId: z.uuid().nullable().optional(),
  occurredAt: z.iso.datetime(),
  schemaVersion: z.number().int().min(1),
  payloadJson: z.unknown(),
  metadataJson: z.object({
    requestId: z.string(),
    idempotencyKey: z.string().optional(),
  }),
  idempotencyKey: z.string().nullable().optional(),
});

export type OutboxEventEnvelope = z.infer<typeof OutboxEventEnvelopeSchema>;
