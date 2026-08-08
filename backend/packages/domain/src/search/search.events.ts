import { z } from "zod";

export const SEARCH_REINDEX_REQUESTED_EVENT = "search.reindex_requested" as const;

export const searchReindexRequestedPayloadSchema = z
  .object({
    requestedAt: z.string().datetime(),
    requestedByMembershipId: z.string().uuid(),
  })
  .strict();

export type SearchReindexRequestedPayload = z.output<typeof searchReindexRequestedPayloadSchema>;

export const coursePublishedPayloadSchema = z
  .object({
    courseId: z.string().uuid(),
    publishedAt: z.string().datetime(),
    workflowTransitionId: z.string().uuid().optional(),
  })
  .passthrough();

export const communityPostCreatedPayloadSchema = z
  .object({
    postId: z.string().uuid(),
    spaceId: z.string().uuid(),
    authorMembershipId: z.string().uuid(),
    mentionMembershipIds: z.array(z.string().uuid()),
  })
  .strict();
