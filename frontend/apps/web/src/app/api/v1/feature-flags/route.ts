import { createTenantRoute, noBodySchema } from "@atlas/api";
import { FeatureFlagListResponseSchema } from "@atlas/domain-config/schemas/feature-flags";
import { listTenantFeatureFlags } from "@atlas/domain-config/services/feature-flag.service";
import { routeMetadata } from "./route.metadata";

export const GET = createTenantRoute({
  metadata: routeMetadata,
  input: noBodySchema,
  output: FeatureFlagListResponseSchema,
  handler: async ({ tx }) => {
    return listTenantFeatureFlags(tx);
  },
});
