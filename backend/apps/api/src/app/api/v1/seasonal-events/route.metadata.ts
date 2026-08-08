import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadBadgeCatalogResourceRef } from "../../../../server/gamification/gamification.resource-loaders";

export const getRouteMetadata = {
  permission: "badge.manage",
  entitlement: "gamification.enable",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadBadgeCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const postRouteMetadata = {
  permission: "badge.manage",
  entitlement: "gamification.enable",
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadBadgeCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const putRouteMetadata = {
  permission: "badge.manage",
  entitlement: "gamification.enable",
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadBadgeCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
