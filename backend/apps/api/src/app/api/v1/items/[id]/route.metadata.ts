import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadItemResourceRef } from "../../../../../server/item-registry/item-registry.resource-loaders";

export const getItemRouteMetadata = {
  permission: "item.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const itemId = params["id"];
    if (!itemId) throw new Error("Missing item id");
    return loadItemResourceRef({ tx, ctx, itemId });
  },
} satisfies RouteMetadata;

export const putItemRouteMetadata = {
  permission: "item.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: getItemRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const deleteItemRouteMetadata = {
  permission: "item.delete",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: getItemRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = getItemRouteMetadata;
