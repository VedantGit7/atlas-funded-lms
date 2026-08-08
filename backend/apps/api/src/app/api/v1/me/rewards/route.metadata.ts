import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadSelfGamificationResourceRef } from "../../../../../server/gamification/gamification.resource-loaders";

export const getRouteMetadata = {
  permission: "gamification.profile.read",
  entitlement: "gamification.enable",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadSelfGamificationResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
