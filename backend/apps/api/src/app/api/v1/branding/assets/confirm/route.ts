import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { confirmBrandingAssetUpload } from "@atlas/storage/branding-asset.service";
import { AssetReferenceViewSchema } from "@atlas/storage/schemas/asset-reference";
import { routeMetadata } from "./route.metadata";

const confirmBrandingAssetBodySchema = z.object({ assetReferenceId: z.uuid() }).strict();

const confirmBrandingAssetResponseSchema = z.object({
  data: z.object({
    asset: AssetReferenceViewSchema,
    url: z.string().nullable(),
  }),
});

type ConfirmBrandingAssetBody = z.output<typeof confirmBrandingAssetBodySchema>;
type ConfirmBrandingAssetResponse = z.output<typeof confirmBrandingAssetResponseSchema>;

/**
 * Finalize a branding upload: the stored bytes are checked against the
 * declared type and an SVG is sanitized before the asset becomes usable
 * (audit M8).
 */
export const POST = createTenantRoute<ConfirmBrandingAssetBody, ConfirmBrandingAssetResponse>({
  metadata: routeMetadata,
  body: confirmBrandingAssetBodySchema,
  output: confirmBrandingAssetResponseSchema,
  handler: async ({ tx, ctx, input }) =>
    confirmBrandingAssetUpload(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        requestId: ctx.requestId,
      },
      { assetReferenceId: input.assetReferenceId },
    ),
});
