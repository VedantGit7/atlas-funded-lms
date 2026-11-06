import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { confirmMemberAvatarUpload } from "@atlas/storage/member-avatar.service";
import { updateMemberProfile } from "@atlas/membership";
import { avatarMutationMetadata } from "../route.metadata";

const confirmAvatarBodySchema = z
  .object({
    assetReferenceId: z.uuid(),
  })
  .strict();

type ConfirmAvatarBody = z.output<typeof confirmAvatarBodySchema>;

const confirmAvatarResponseSchema = z.object({
  data: z.object({
    // A public R2 URL, or this app's /api/v1/public/avatars/<id> when there's
    // no public endpoint.
    avatarUrl: z.string().min(1),
  }),
});

export const POST = createTenantRoute<
  ConfirmAvatarBody,
  z.output<typeof confirmAvatarResponseSchema>
>({
  metadata: avatarMutationMetadata,
  body: confirmAvatarBodySchema,
  output: confirmAvatarResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    // The member's own upload only; the avatars it replaces are deleted.
    const { avatarUrl } = await confirmMemberAvatarUpload(
      tx,
      { tenantId: ctx.tenantId },
      { assetReferenceId: input.assetReferenceId, membershipId: ctx.actorMembershipId },
    );

    await updateMemberProfile(tx, ctx, ctx.actorMembershipId, { avatarUrl });

    return { data: { avatarUrl } };
  },
});
