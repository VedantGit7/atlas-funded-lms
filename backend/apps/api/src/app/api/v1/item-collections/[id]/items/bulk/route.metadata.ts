import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadItemCollectionResourceRef } from "../../../../../../../server/item-registry/item-registry.resource-loaders";

export const routeMetadata = {
  permission: "item_collection.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const collectionId = params["id"];
    if (!collectionId) throw new Error("Missing collection id");
    return loadItemCollectionResourceRef({ tx, ctx, collectionId });
  },
} satisfies RouteMetadata;
