import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadCompetencyDimensionResourceRef } from "../../../../../server/competency/competency-config.resource-loaders";

export const getRouteMetadata = {
  permission: "competency.dimension.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const dimensionId = params["id"];
    if (!dimensionId) throw new Error("Missing competency dimension id");
    return loadCompetencyDimensionResourceRef({ tx, ctx, dimensionId });
  },
} satisfies RouteMetadata;

export const putRouteMetadata = {
  permission: "competency.dimension.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: getRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const deleteRouteMetadata = {
  permission: "competency.dimension.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: getRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
