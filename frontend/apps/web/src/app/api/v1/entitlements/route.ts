import { createTenantRoute, noBodySchema } from "@atlas/api";
import { EntitlementListResponseSchema } from "@atlas/domain-config/schemas/entitlements";
import { listTenantEntitlements } from "@atlas/domain-config/services/entitlement.service";
import { routeMetadata } from "./route.metadata";

export const GET = createTenantRoute({
  metadata: routeMetadata,
  input: noBodySchema,
  output: EntitlementListResponseSchema,
  handler: async ({ tx }) => {
    return listTenantEntitlements(tx);
  },
});
