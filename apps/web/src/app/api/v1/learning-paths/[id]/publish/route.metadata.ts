import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadLearningPathResourceRef } from "../../../../../../server/learning-paths/learning-path.resource-loaders";

export const publishRouteMetadata = {
  permission: "learning_path.publish",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const pathId = params["id"];
    if (!pathId) throw new Error("Missing learning path id");

    return loadLearningPathResourceRef({
      tx,
      ctx,
      pathId,
      requirePublished: false,
    });
  },
} satisfies RouteMetadata;

export const routeMetadata = publishRouteMetadata;
