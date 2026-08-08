import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadWorkflowQueueResourceRef } from "../../../../../server/workflows/load-workflow-resource-ref";

export const getWorkflowHistoryRouteMetadata = {
  permission: "workflow.transition.act",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadWorkflowQueueResourceRef({ ctx }),
} satisfies RouteMetadata;
