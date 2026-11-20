import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadItemCreateResourceRef } from "@atlas/api-server/item-registry/item-registry.resource-loaders";

export const getItemImportBatchesRouteMetadata = {
  permission: "item.create",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadItemCreateResourceRef({ ctx }),
} satisfies RouteMetadata;

export const postItemImportBatchRouteMetadata = {
  permission: "item.create",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadItemCreateResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = postItemImportBatchRouteMetadata;
