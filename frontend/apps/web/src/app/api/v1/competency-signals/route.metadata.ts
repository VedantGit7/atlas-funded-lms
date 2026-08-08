import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadCompetencySignalsCatalogResourceRef } from "../../../../server/competency/competency-projection.resource-loaders";

export const getRouteMetadata = {
  permission: "competency.signal.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => await loadCompetencySignalsCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
