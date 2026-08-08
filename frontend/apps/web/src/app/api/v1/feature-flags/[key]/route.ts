import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { FeatureFlagListResponseSchema } from "@atlas/domain-config/schemas/feature-flags";
import { UpdateFeatureFlagRequestSchema } from "@atlas/domain-config/schemas/tenant-config";
import { updateTenantFeatureFlagOverride } from "@atlas/domain-config";
import { putRouteMetadata } from "./route.metadata";

type FeatureFlagListResponse = z.output<typeof FeatureFlagListResponseSchema>;
type UpdateFeatureFlagRequest = z.output<typeof UpdateFeatureFlagRequestSchema>;

export const PUT = createTenantRoute<UpdateFeatureFlagRequest, FeatureFlagListResponse>({
  metadata: putRouteMetadata,
  body: UpdateFeatureFlagRequestSchema,
  output: FeatureFlagListResponseSchema,
  params: z.object({ key: z.string().min(1).max(120) }),
  handler: async ({ tx, ctx, input, params }) =>
    updateTenantFeatureFlagOverride(tx, ctx, params["key"] ?? "", input),
});
