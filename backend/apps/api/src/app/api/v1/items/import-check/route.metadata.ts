import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadItemCreateResourceRef } from "@atlas/api-server/item-registry/item-registry.resource-loaders";

// Checks rows from an uploaded template against the rules and the bank.
// Writes nothing, so no audit and no idempotency key; it is a write-sized
// request (up to 1,000 rows), so it counts against the write budget.
export const postItemImportCheckRouteMetadata = {
  permission: "item.create",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantMutation",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadItemCreateResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = postItemImportCheckRouteMetadata;
