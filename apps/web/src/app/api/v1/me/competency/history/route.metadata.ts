import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadSelfCompetencyResourceRef } from "../../../../../../server/competency/competency-projection.resource-loaders";

export const getRouteMetadata = {
  permission: "competency.score.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => await loadSelfCompetencyResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
