import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadBadgeCatalogResourceRef } from "../../../../../server/gamification/gamification.resource-loaders";

export const routeMetadata = {
  permission: "badge.manage",
  entitlement: "gamification.enable",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  // One export run consumes one unit. `gamification.enable` carries no
  // limit today, so this only accrues history — an operator who later sets
  // `{ "limit": 500, "period": "month" }` gets enforcement immediately.
  entitlementUsage: () => 1,
  resourceLoader: async ({ ctx }) => loadBadgeCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;
