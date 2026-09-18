import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { FeatureFlagListResponseSchema } from "@atlas/domain-config/schemas/feature-flags";
import { UpdateFeatureFlagRequestSchema } from "@atlas/domain-config/schemas/tenant-config";
import { updateTenantFeatureFlagOverride } from "@atlas/domain-config";
import { putRouteMetadata } from "./route.metadata";

type FeatureFlagListResponse = z.output<typeof FeatureFlagListResponseSchema>;
type UpdateFeatureFlagRequest = z.output<typeof UpdateFeatureFlagRequestSchema>;

// The params schema was passed at runtime but not as a type argument. Supplying
// only two of the three generics makes TypeScript fall back to the default for
// the third, so the handler saw `Record<string, never>` and `params["key"]` was
// `undefined` at the type level — hence the `?? ""` that could never fire.
const paramsSchema = z.object({ key: z.string().min(1).max(120) });

export const PUT = createTenantRoute<
  UpdateFeatureFlagRequest,
  FeatureFlagListResponse,
  typeof paramsSchema
>({
  metadata: putRouteMetadata,
  body: UpdateFeatureFlagRequestSchema,
  output: FeatureFlagListResponseSchema,
  params: paramsSchema,
  handler: async ({ tx, ctx, input, params }) =>
    updateTenantFeatureFlagOverride(tx, ctx, params.key, input),
});
