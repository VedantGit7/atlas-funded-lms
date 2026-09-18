import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { createMemberAvatarUpload } from "@atlas/storage/member-avatar.service";
import { SignedUploadResponseSchema } from "@atlas/storage/schemas/asset-reference";
import { avatarMutationMetadata } from "../route.metadata";

const createAvatarUploadBodySchema = z
  .object({
    fileName: z.string().min(1).max(240),
    contentType: z.string().min(1).max(180),
    sizeBytes: z.number().int().min(1),
    checksumSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .optional(),
  })
  .strict();

type CreateAvatarUploadBody = z.output<typeof createAvatarUploadBodySchema>;
type SignedUploadResponse = z.output<typeof SignedUploadResponseSchema>;

export const POST = createTenantRoute<CreateAvatarUploadBody, SignedUploadResponse>({
  metadata: avatarMutationMetadata,
  body: createAvatarUploadBodySchema,
  output: SignedUploadResponseSchema,
  handler: async ({ tx, ctx, input }) =>
    createMemberAvatarUpload(
      tx,
      { tenantId: ctx.tenantId },
      {
        membershipId: ctx.actorMembershipId,
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256 ?? null,
      },
    ),
});
