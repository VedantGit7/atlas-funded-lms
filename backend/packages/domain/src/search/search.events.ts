import { z } from "zod";

export const SEARCH_REINDEX_REQUESTED_EVENT = "search.reindex_requested" as const;

export const searchReindexRequestedPayloadSchema = z
  .object({
    requestedAt: z.iso.datetime(),
    requestedByMembershipId: z.uuid(),
  })
  .strict();

export type SearchReindexRequestedPayload = z.output<typeof searchReindexRequestedPayloadSchema>;

export const coursePublishedPayloadSchema = z
  .object({
    courseId: z.uuid(),
    publishedAt: z.iso.datetime(),
    workflowTransitionId: z.uuid().optional(),
  })
  .loose();

/** A live course taken offline; search drops it (its projection is empty unless PUBLISHED). */
export const courseUnpublishedPayloadSchema = z
  .object({
    courseId: z.uuid(),
    unpublishedAt: z.iso.datetime(),
  })
  .loose();

export const communityPostCreatedPayloadSchema = z
  .object({
    postId: z.uuid(),
    spaceId: z.uuid(),
    authorMembershipId: z.uuid(),
    mentionMembershipIds: z.array(z.uuid()),
  })
  .strict();
