import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { can, createTenantResourceRef, toAuthorizationError } from "@atlas/authorization";
import { assignRoleToMember } from "@atlas/domain-access";
import {
  inviteMember,
  inviteMemberBodySchema,
  inviteMemberResponseSchema,
} from "@atlas/membership";
import { inviteRouteMetadata } from "./route.metadata";
import { sendMembershipInvitationEmail } from "../../../../../server/notifications/membership-invitation.service";

type InviteResponse = z.output<typeof inviteMemberResponseSchema>;
type InviteBody = z.output<typeof inviteMemberBodySchema>;

export const POST = createTenantRoute<InviteBody, InviteResponse>({
  metadata: inviteRouteMetadata,
  body: inviteMemberBodySchema,
  output: inviteMemberResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    const { data, inviteToken } = await inviteMember(tx, ctx, input);

    if (input.roleId) {
      const resource = createTenantResourceRef({
        type: "membership",
        id: data.id,
        tenantId: ctx.tenantId,
        ownerMembershipId: data.id,
      });

      const decision = await can({
        tx,
        actor: { tenantId: ctx.tenantId, membershipId: ctx.actorMembershipId },
        permission: "role.assign",
        resource,
        ctx: { tenantId: ctx.tenantId, requestId: ctx.requestId },
      });

      if (!decision.allowed) {
        throw toAuthorizationError(decision);
      }

      await assignRoleToMember(tx, ctx, data.id, { roleId: input.roleId });
    }

    await sendMembershipInvitationEmail({
      tenantId: ctx.tenantId,
      requestId: ctx.requestId,
      to: data.invitedEmail,
      inviteToken,
    });

    return { data };
  },
});
