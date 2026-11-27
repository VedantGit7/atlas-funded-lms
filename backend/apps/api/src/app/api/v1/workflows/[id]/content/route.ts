import { createTenantRoute } from "@atlas/api";
import { getWorkflowContent } from "../../../../../../server/workflows/workflow-content.service";
import {
  workflowContentResponseSchema,
  type WorkflowContentResponse,
} from "../../../../../../server/workflows/workflow-content.schemas";
import { workflowTransitionParamsSchema } from "../../../../../../server/workflows/workflow-schemas";
import { getWorkflowContentRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  WorkflowContentResponse,
  typeof workflowTransitionParamsSchema
>({
  metadata: getWorkflowContentRouteMetadata,
  params: workflowTransitionParamsSchema,
  output: workflowContentResponseSchema,
  handler: async ({ tx, params }) => {
    const transitionId = params["id"];
    if (!transitionId) throw new Error("Missing workflow transition id");
    return getWorkflowContent(tx, transitionId);
  },
});
