import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  inviteMember,
  inviteMemberBodySchema,
  inviteMemberResponseSchema,
} from "@atlas/membership";
import { inviteRouteMetadata } from "./route.metadata";

type InviteResponse = z.output<typeof inviteMemberResponseSchema>;
type InviteBody = z.output<typeof inviteMemberBodySchema>;

export const POST = createTenantRoute<InviteBody, InviteResponse>({
  metadata: inviteRouteMetadata,
  body: inviteMemberBodySchema,
  output: inviteMemberResponseSchema,
  handler: async ({ tx, ctx, input }) => inviteMember(tx, ctx, input),
});
