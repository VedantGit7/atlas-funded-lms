import { createTenantRoute, noBodySchema } from "@atlas/api";
import { UsageSummaryResponseSchema } from "@atlas/domain-config/schemas/usage";
import { getUsageSummary } from "@atlas/domain-config/services/usage.service";
import { routeMetadata } from "./route.metadata";

export const GET = createTenantRoute({
  metadata: routeMetadata,
  input: noBodySchema,
  output: UsageSummaryResponseSchema,
  handler: async ({ tx }) => {
    return getUsageSummary(tx);
  },
});
