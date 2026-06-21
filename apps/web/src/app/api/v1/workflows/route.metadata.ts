import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadWorkflowQueueResourceRef } from "../../../../server/workflows/load-workflow-resource-ref";

export const getWorkflowsRouteMetadata = {
  permission: "workflow.transition.act",
  entitlement: null,
  audit: "required",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadWorkflowQueueResourceRef({ ctx }),
} satisfies RouteMetadata;

export const getWorkflowDefinitionsRouteMetadata = {
  permission: "workflow.definition.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
} satisfies RouteMetadata;

export const manageWorkflowDefinitionsRouteMetadata = {
  permission: "workflow.definition.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
} satisfies RouteMetadata;

export const routeMetadata = getWorkflowsRouteMetadata;
