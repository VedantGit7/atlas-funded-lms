import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadLeaderboardCatalogResourceRef } from "../../../../server/gamification/gamification.resource-loaders";

export const getRouteMetadata = {
  permission: "leaderboard.read",
  entitlement: "gamification.enable",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadLeaderboardCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const postRouteMetadata = {
  permission: "leaderboard.manage",
  entitlement: "gamification.enable",
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadLeaderboardCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const putRouteMetadata = {
  permission: "leaderboard.manage",
  entitlement: "gamification.enable",
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadLeaderboardCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
