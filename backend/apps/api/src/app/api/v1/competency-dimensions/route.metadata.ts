import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadCompetencyConfigCatalogResourceRef } from "../../../../server/competency/competency-config.resource-loaders";

export const getRouteMetadata = {
  permission: "competency.dimension.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadCompetencyConfigCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const postRouteMetadata = {
  permission: "competency.dimension.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadCompetencyConfigCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
