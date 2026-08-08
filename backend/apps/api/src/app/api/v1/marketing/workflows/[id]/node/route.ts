import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  marketingWorkflowResponseSchema,
  updateWorkflowNodeBodySchema,
} from "../../../../../../../server/marketing-workflows/marketing-workflow.schemas";
import { mutateMarketingWorkflowsMetadata } from "../../../../../../../server/marketing-workflows/marketing-workflow.route-metadata";
import { updateMarketingWorkflowNode } from "../../../../../../../server/marketing-workflows/marketing-workflow.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const PATCH = createTenantRoute<
  z.output<typeof updateWorkflowNodeBodySchema>,
  z.output<typeof marketingWorkflowResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingWorkflowsMetadata,
  params: paramsSchema,
  body: updateWorkflowNodeBodySchema,
  output: marketingWorkflowResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateMarketingWorkflowNode(tx, ctx, params.id, input),
});
