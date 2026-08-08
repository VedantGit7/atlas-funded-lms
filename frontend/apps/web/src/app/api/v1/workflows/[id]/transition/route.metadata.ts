import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadWorkflowTransitionResourceRef } from "../../../../../../server/workflows/load-workflow-resource-ref";

export const postWorkflowTransitionRouteMetadata = {
  permission: "workflow.transition.act",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const transitionId = params["id"];
    if (!transitionId) throw new Error("Missing workflow transition id");

    return loadWorkflowTransitionResourceRef({
      tx,
      ctx,
      transitionId,
    });
  },
} satisfies RouteMetadata;

export const routeMetadata = postWorkflowTransitionRouteMetadata;
