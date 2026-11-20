import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadItemCatalogResourceRef } from "@atlas/api-server/item-registry/item-registry.resource-loaders";

export const postItemBulkStatusRouteMetadata = {
  permission: "item.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadItemCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = postItemBulkStatusRouteMetadata;
