import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadBadgeCatalogResourceRef } from "../../../../../server/gamification/gamification.resource-loaders";

export const routeMetadata = {
  permission: "badge.manage",
  entitlement: "gamification.enable",
  // Dry-run computation: reads only, no state change to audit.
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadBadgeCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;
