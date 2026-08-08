import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  loadCompetencyBandResourceRef,
  loadScoringProfileResourceRef,
} from "../../../../../../server/competency/competency-config.resource-loaders";

export const getRouteMetadata = {
  permission: "scoring_profile.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const profileId = params["id"];
    if (!profileId) throw new Error("Missing scoring profile id");
    return await loadScoringProfileResourceRef({ tx, ctx, profileId });
  },
} satisfies RouteMetadata;

export const putRouteMetadata = {
  permission: "competency.band.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const profileId = params["id"];
    if (!profileId) throw new Error("Missing scoring profile id");
    return await loadCompetencyBandResourceRef({ tx, ctx, profileId });
  },
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
