import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadGradingTaskResourceRef } from "../../../../../../server/grading/grading.resource-loaders";

export const postGradeGradingTaskRouteMetadata = {
  permission: "assessment.grade",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const taskId = params["id"];
    if (!taskId) throw new Error("Missing grading task id");

    return loadGradingTaskResourceRef({ tx, ctx, taskId });
  },
} satisfies RouteMetadata;

export const routeMetadata = postGradeGradingTaskRouteMetadata;
