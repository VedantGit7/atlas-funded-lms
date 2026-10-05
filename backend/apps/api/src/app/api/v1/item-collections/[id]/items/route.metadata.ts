import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadItemCollectionResourceRef } from "../../../../../../server/item-registry/item-registry.resource-loaders";

const collectionResourceLoader = async ({
  tx,
  ctx,
  params,
}: {
  tx: Parameters<typeof loadItemCollectionResourceRef>[0]["tx"];
  ctx: Parameters<typeof loadItemCollectionResourceRef>[0]["ctx"];
  params: Record<string, string>;
}) => {
  const collectionId = params["id"];
  if (!collectionId) throw new Error("Missing collection id");
  return loadItemCollectionResourceRef({ tx, ctx, collectionId });
};

export const postCollectionItemRouteMetadata = {
  permission: "item_collection.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: collectionResourceLoader,
} satisfies RouteMetadata;

export const getCollectionItemsRouteMetadata = {
  permission: "item_collection.manage",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: collectionResourceLoader,
} satisfies RouteMetadata;

export const deleteCollectionItemRouteMetadata = {
  permission: "item_collection.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: collectionResourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = postCollectionItemRouteMetadata;
