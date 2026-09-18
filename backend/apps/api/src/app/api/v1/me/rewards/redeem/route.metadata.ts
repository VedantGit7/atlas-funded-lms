import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadSelfGamificationResourceRef } from "../../../../../../server/gamification/gamification.resource-loaders";

export const routeMetadata = {
  permission: "gamification.profile.read",
  entitlement: "gamification.enable",
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  // A redemption is a consumable, so it meters. Unlimited until a plan
  // sets a limit; the counter runs either way.
  entitlementUsage: () => 1,
  resourceLoader: async ({ ctx }) => loadSelfGamificationResourceRef({ ctx }),
} satisfies RouteMetadata;
