import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadWorkflowTransitionResourceRef } from "../../../../../../server/workflows/load-workflow-resource-ref";

/** What's being approved, for whoever may approve it (S3.4). */
export const getWorkflowContentRouteMetadata = {
  permission: "workflow.transition.act",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const transitionId = params["id"];
    if (!transitionId) throw new Error("Missing workflow transition id");
    return loadWorkflowTransitionResourceRef({ tx, ctx, transitionId });
  },
} satisfies RouteMetadata;

export const routeMetadata = getWorkflowContentRouteMetadata;
