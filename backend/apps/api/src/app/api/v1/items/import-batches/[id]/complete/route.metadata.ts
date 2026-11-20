import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadItemCreateResourceRef } from "@atlas/api-server/item-registry/item-registry.resource-loaders";

// The service also requires the batch to belong to this academy (row-level
// security) and to have been started by the same member.
export const postItemImportBatchActionRouteMetadata = {
  permission: "item.create",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadItemCreateResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = postItemImportBatchActionRouteMetadata;
