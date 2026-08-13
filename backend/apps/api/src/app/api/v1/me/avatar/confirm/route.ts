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
    avatarUrl: z.url().nullable(),
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
    const { avatarUrl } = await confirmMemberAvatarUpload(
      tx,
      { tenantId: ctx.tenantId },
      { assetReferenceId: input.assetReferenceId },
    );

    if (avatarUrl) {
      await updateMemberProfile(tx, ctx, ctx.actorMembershipId, { avatarUrl });
    }

    return { data: { avatarUrl } };
  },
});
