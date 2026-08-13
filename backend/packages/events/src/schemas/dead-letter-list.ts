import { z } from "zod";

export const DeadLetterListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

export const DeadLetterListItemSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid().nullable(),
  outboxEventId: z.uuid(),
  destinationKey: z.string().nullable(),
  eventType: z.string(),
  errorCode: z.string().nullable(),
  safeErrorMessage: z.string().nullable(),
  failedAt: z.iso.datetime(),
});

export const DeadLetterListResponseSchema = z.object({
  data: z.array(DeadLetterListItemSchema),
  page: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
});

export type DeadLetterListQuery = z.infer<typeof DeadLetterListQuerySchema>;
