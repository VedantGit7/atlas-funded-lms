import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadSelfGamificationResourceRef } from "../../../../../server/gamification/gamification.resource-loaders";

export const routeMetadata = {
  permission: "gamification.profile.read",
  entitlement: "gamification.enable",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadSelfGamificationResourceRef({ ctx }),
} satisfies RouteMetadata;
