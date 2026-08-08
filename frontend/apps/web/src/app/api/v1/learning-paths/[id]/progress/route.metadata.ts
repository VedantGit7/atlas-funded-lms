import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadLearningPathProgressResourceRef } from "../../../../../../server/learning-paths/learning-path.resource-loaders";

export const getRouteMetadata = {
  permission: "progress.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const pathId = params["id"];
    if (!pathId) throw new Error("Missing learning path id");

    return loadLearningPathProgressResourceRef({
      tx,
      ctx,
      pathId,
    });
  },
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
