import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { updateWorkflowDefinitionRecord } from "../../../../../server/workflows/workflows.service";
import {
  updateWorkflowDefinitionBodySchema,
  workflowDefinitionResponseSchema,
} from "../../../../../server/workflows/workflow-schemas";
import { putRouteMetadata } from "./route.metadata";

export const PUT = createTenantRoute({
  metadata: putRouteMetadata,
  body: updateWorkflowDefinitionBodySchema,
  output: workflowDefinitionResponseSchema,
  params: z.object({ id: z.string().uuid() }),
  handler: async ({ tx, ctx, input, params }) =>
    updateWorkflowDefinitionRecord(tx, ctx, params["id"] ?? "", input),
});
