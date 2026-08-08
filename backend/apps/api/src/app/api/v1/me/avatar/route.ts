import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { clearMemberAvatarKey } from "@atlas/membership/member-admin.repository";
import { avatarMutationMetadata } from "./route.metadata";

const deleteAvatarResponseSchema = z.object({
  data: z.object({ ok: z.literal(true) }),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteAvatarResponseSchema>
>({
  metadata: avatarMutationMetadata,
  output: deleteAvatarResponseSchema,
  handler: async ({ tx, ctx }) => {
    await clearMemberAvatarKey({ tx, tenantId: ctx.tenantId, membershipId: ctx.actorMembershipId });
    return { data: { ok: true as const } };
  },
});
