import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  loadItemCatalogResourceRef,
  loadItemCollectionManageResourceRef,
} from "../../../../server/item-registry/item-registry.resource-loaders";

export const getItemCollectionsRouteMetadata = {
  permission: "item.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadItemCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const postItemCollectionsRouteMetadata = {
  permission: "item_collection.manage",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadItemCollectionManageResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getItemCollectionsRouteMetadata;
