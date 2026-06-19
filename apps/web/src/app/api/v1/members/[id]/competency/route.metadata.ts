import type { RouteMetadata } from "@atlas/api/route-metadata";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { loadMemberCompetencyResourceRef } from "../../../../../../server/competency/competency-projection.resource-loaders";

export const getRouteMetadata = {
  permission: "competency.score.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const parsed = uuidParamSchema.parse(params);
    return await loadMemberCompetencyResourceRef({
      tx,
      ctx,
      membershipId: parsed.id,
    });
  },
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
