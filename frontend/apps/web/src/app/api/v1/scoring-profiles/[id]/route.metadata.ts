import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadScoringProfileResourceRef } from "../../../../../server/competency/competency-config.resource-loaders";

export const putRouteMetadata = {
  permission: "scoring_profile.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const profileId = params["id"];
    if (!profileId) throw new Error("Missing scoring profile id");
    return loadScoringProfileResourceRef({ tx, ctx, profileId });
  },
} satisfies RouteMetadata;

export const routeMetadata = putRouteMetadata;
