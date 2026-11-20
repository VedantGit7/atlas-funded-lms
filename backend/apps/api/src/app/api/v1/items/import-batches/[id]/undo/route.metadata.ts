import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadItemCatalogResourceRef } from "@atlas/api-server/item-registry/item-registry.resource-loaders";

// Undo removes questions from the bank, so it needs item.delete. The service
// also requires the batch to belong to this academy (row-level security) and
// to have been run by the same member.
export const postItemImportBatchUndoRouteMetadata = {
  permission: "item.delete",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadItemCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = postItemImportBatchUndoRouteMetadata;
