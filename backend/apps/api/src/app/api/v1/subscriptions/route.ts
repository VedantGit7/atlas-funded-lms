import { createTenantRoute, noBodySchema } from "@atlas/api";
import { SubscriptionListResponseSchema } from "@atlas/domain-config/schemas/subscriptions";
import { listTenantSubscriptions } from "@atlas/domain-config/services/subscription.service";
import { routeMetadata } from "./route.metadata";

export const GET = createTenantRoute({
  metadata: routeMetadata,
  input: noBodySchema,
  output: SubscriptionListResponseSchema,
  handler: async ({ tx }) => {
    return listTenantSubscriptions(tx);
  },
});
