import { z } from "zod";

export const AuditTargetSchema = z.object({
  type: z.string().min(1).max(120),
  id: z.uuid().nullable(),
});

export const AuditWriteInputSchema = z.object({
  action: z.string().min(1).max(160),
  target: AuditTargetSchema,
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  reason: z.string().max(1000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const AuditEntryViewSchema = z.object({
  id: z.uuid(),
  occurredAt: z.iso.datetime(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.uuid().nullable(),
  actorMembershipId: z.uuid().nullable(),
  platformPrincipalId: z.uuid().nullable(),
  requestId: z.string(),
  reason: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

export const AuditListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
  action: z.string().max(160).optional(),
  targetType: z.string().max(120).optional(),
  /**
   * Narrow to one record's history.
   *
   * `targetType` alone answers "what happened to tags", which is not the
   * question a detail screen asks. `target_id` is text rather than uuid in the
   * table — some targets are not uuids — so this is a string.
   */
  targetId: z.string().max(200).optional(),
});

export const TenantAuditListQuerySchema = AuditListQuerySchema.strict();

export const AuditListResponseSchema = z.object({
  data: z.array(AuditEntryViewSchema),
  page: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
});

export type AuditWriteInput = z.infer<typeof AuditWriteInputSchema>;
export type AuditListQuery = z.infer<typeof AuditListQuerySchema>;
export type AuditListResponse = z.infer<typeof AuditListResponseSchema>;
