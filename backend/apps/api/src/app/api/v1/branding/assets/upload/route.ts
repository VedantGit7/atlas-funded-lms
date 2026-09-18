import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { createBrandingAssetUpload } from "@atlas/storage/branding-asset.service";
import { SignedUploadResponseSchema } from "@atlas/storage/schemas/asset-reference";
import { routeMetadata } from "./route.metadata";

const createBrandingAssetUploadBodySchema = z
  .object({
    purpose: z.enum(["branding.logo", "branding.favicon", "branding.og-image"]),
    fileName: z.string().min(1).max(240),
    contentType: z.string().min(1).max(180),
    sizeBytes: z.number().int().min(1),
    checksumSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .optional(),
    variant: z.enum(["light", "dark"]).optional(),
  })
  .strict();

type CreateBrandingAssetUploadBody = z.output<typeof createBrandingAssetUploadBodySchema>;
type SignedUploadResponse = z.output<typeof SignedUploadResponseSchema>;

export const POST = createTenantRoute<CreateBrandingAssetUploadBody, SignedUploadResponse>({
  metadata: routeMetadata,
  body: createBrandingAssetUploadBodySchema,
  output: SignedUploadResponseSchema,
  handler: async ({ tx, ctx, input }) =>
    createBrandingAssetUpload(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        requestId: ctx.requestId,
      },
      {
        purpose: input.purpose,
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256 ?? null,
        visibility: "public-safe",
      },
    ),
});
