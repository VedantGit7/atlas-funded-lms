import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadExtensionCatalogResourceRef } from "@atlas/api-server/item-registry/item-registry.resource-loaders";

export const getExtensionPointsRouteMetadata = {
  permission: "extension.point.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadExtensionCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getExtensionPointsRouteMetadata;
