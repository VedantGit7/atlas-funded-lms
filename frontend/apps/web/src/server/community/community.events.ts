// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { z } from "zod";

export const COMMUNITY_POST_CREATED_EVENT = "community.post.created" as const;

export const COMMUNITY_AUDIT_SPACE_DELETED = "community.space.deleted" as const;

export const communityPostCreatedPayloadSchema = z
  .object({
    postId: z.uuid(),
    spaceId: z.uuid(),
    authorMembershipId: z.uuid(),
    mentionMembershipIds: z.array(z.uuid()),
  })
  .strict();

export type CommunityPostCreatedPayload = z.output<typeof communityPostCreatedPayloadSchema>;
