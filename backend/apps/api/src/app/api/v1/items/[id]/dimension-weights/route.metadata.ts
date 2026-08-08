import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadItemResourceRef } from "../../../../../../server/item-registry/item-registry.resource-loaders";

const itemResourceLoader = async ({
  tx,
  ctx,
  params,
}: {
  tx: Parameters<typeof loadItemResourceRef>[0]["tx"];
  ctx: Parameters<typeof loadItemResourceRef>[0]["ctx"];
  params: Record<string, string>;
}) => {
  const itemId = params["id"];
  if (!itemId) throw new Error("Missing item id");
  return loadItemResourceRef({ tx, ctx, itemId });
};

export const getDimensionWeightsRouteMetadata = {
  permission: "item.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: itemResourceLoader,
} satisfies RouteMetadata;

export const putDimensionWeightsRouteMetadata = {
  permission: "item.update",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: itemResourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = getDimensionWeightsRouteMetadata;
