import { z } from "zod";

export const COMMUNITY_POST_CREATED_EVENT = "community.post.created" as const;

export const COMMUNITY_AUDIT_SPACE_DELETED = "community.space.deleted" as const;

export const communityPostCreatedPayloadSchema = z
  .object({
    postId: z.string().uuid(),
    spaceId: z.string().uuid(),
    authorMembershipId: z.string().uuid(),
    mentionMembershipIds: z.array(z.string().uuid()),
  })
  .strict();

export type CommunityPostCreatedPayload = z.output<typeof communityPostCreatedPayloadSchema>;
