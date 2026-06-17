import { z } from "zod";

export const OutboxEventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  eventType: z.string().min(1).max(160),
  aggregateType: z.string().min(1).max(120),
  aggregateId: z.string().uuid(),
  actorMembershipId: z.string().uuid().nullable().optional(),
  occurredAt: z.string().datetime(),
  schemaVersion: z.number().int().min(1),
  payloadJson: z.unknown(),
  metadataJson: z.object({
    requestId: z.string(),
    idempotencyKey: z.string().optional(),
  }),
  idempotencyKey: z.string().nullable().optional(),
});

export type OutboxEventEnvelope = z.infer<typeof OutboxEventEnvelopeSchema>;
