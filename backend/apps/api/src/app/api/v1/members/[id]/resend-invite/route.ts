import type { z } from "zod";
import { z as zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import { resendInvite, resendInviteResponseSchema } from "@atlas/membership";
import { postRouteMetadata } from "./route.metadata";
import { sendMembershipInvitationEmail } from "../../../../../../server/notifications/membership-invitation.service";

const memberParamsSchema = zod.object({ id: zod.uuid() });

type ResendInviteResponse = z.output<typeof resendInviteResponseSchema>;

export const POST = createTenantRoute<Record<string, never>, ResendInviteResponse>({
  metadata: postRouteMetadata,
  params: memberParamsSchema,
  output: resendInviteResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const { id } = memberParamsSchema.parse(params);
    const { data, inviteToken } = await resendInvite(tx, ctx, id);

    await sendMembershipInvitationEmail({
      tenantId: ctx.tenantId,
      requestId: ctx.requestId,
      to: data.invitedEmail,
      inviteToken,
    });

    return { data };
  },
});
