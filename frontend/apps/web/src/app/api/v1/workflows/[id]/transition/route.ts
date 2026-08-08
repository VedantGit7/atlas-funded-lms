import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { actOnWorkflowTransition } from "../../../../../../server/workflows/workflows.service";
import {
  workflowTransitionBodySchema,
  workflowTransitionParamsSchema,
  workflowTransitionResultSchema,
} from "../../../../../../server/workflows/workflow-schemas";
import { postWorkflowTransitionRouteMetadata } from "./route.metadata";

type WorkflowTransitionBody = z.output<typeof workflowTransitionBodySchema>;
type WorkflowTransitionResponse = z.output<typeof workflowTransitionResultSchema>;

export const POST = createTenantRoute<
  WorkflowTransitionBody,
  WorkflowTransitionResponse,
  typeof workflowTransitionParamsSchema
>({
  metadata: postWorkflowTransitionRouteMetadata,
  params: workflowTransitionParamsSchema,
  body: workflowTransitionBodySchema,
  output: workflowTransitionResultSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const workflowId = params["id"];
    if (!workflowId) throw new Error("Missing workflow transition id");

    return actOnWorkflowTransition(
      tx,
      ctx,
      workflowId,
      input,
    ) as unknown as Promise<WorkflowTransitionResponse>;
  },
});
