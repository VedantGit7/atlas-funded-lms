import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadGradingTaskResourceRef } from "../../../../../server/grading/grading.resource-loaders";

export const getGradingTaskRouteMetadata = {
  permission: "assessment.grade",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const taskId = params["id"];
    if (!taskId) throw new Error("Missing grading task id");

    return loadGradingTaskResourceRef({ tx, ctx, taskId });
  },
} satisfies RouteMetadata;

export const routeMetadata = getGradingTaskRouteMetadata;
