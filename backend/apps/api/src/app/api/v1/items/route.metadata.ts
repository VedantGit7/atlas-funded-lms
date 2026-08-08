import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  loadItemCatalogResourceRef,
  loadItemCreateResourceRef,
} from "@atlas/api-server/item-registry/item-registry.resource-loaders";

export const getItemsRouteMetadata = {
  permission: "item.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadItemCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const postItemsRouteMetadata = {
  permission: "item.create",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadItemCreateResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getItemsRouteMetadata;
