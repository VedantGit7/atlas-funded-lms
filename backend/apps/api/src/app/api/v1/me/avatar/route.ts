import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { clearMemberAvatarKey } from "@atlas/membership/member-admin.repository";
import { getStorageProvider } from "@atlas/storage";
import { retireMemberAvatars } from "@atlas/storage/member-avatar.service";
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
    // Removing a photo deletes it; it used to stay in storage (launch plan 5.1).
    await retireMemberAvatars(tx, getStorageProvider(), { membershipId: ctx.actorMembershipId });
    return { data: { ok: true as const } };
  },
});
