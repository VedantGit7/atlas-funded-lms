import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadItemCreateResourceRef } from "@atlas/api-server/item-registry/item-registry.resource-loaders";

// The template is only useful to someone who can create questions, and it
// names the academy's competency dimensions.
export const getItemImportTemplateRouteMetadata = {
  permission: "item.create",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadItemCreateResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getItemImportTemplateRouteMetadata;
