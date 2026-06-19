import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadGradingQueueResourceRef } from "../../../../server/grading/grading.resource-loaders";

export const getGradingTasksRouteMetadata = {
  permission: "assessment.grade",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadGradingQueueResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getGradingTasksRouteMetadata;
