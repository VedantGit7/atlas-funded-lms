import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadLearningPathForEnrollmentResourceRef } from "../../../../../../server/learning-paths/learning-path.resource-loaders";

export const postRouteMetadata = {
  permission: "enrollment.create",
  entitlement: null,
  audit: "none",
  auditExempt: "learner_activity",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const pathId = params["id"];
    if (!pathId) throw new Error("Missing learning path id");

    return loadLearningPathForEnrollmentResourceRef({
      tx,
      ctx,
      pathId,
    });
  },
} satisfies RouteMetadata;

export const routeMetadata = postRouteMetadata;
