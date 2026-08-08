import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadScoringConfigPublishResourceRef } from "../../../../../../server/competency/competency-config.resource-loaders";

export const publishRouteMetadata = {
  permission: "scoring_config.publish",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const profileId = params["id"];
    if (!profileId) throw new Error("Missing scoring profile id");
    return await loadScoringConfigPublishResourceRef({ tx, ctx, profileId });
  },
} satisfies RouteMetadata;

export const routeMetadata = publishRouteMetadata;
