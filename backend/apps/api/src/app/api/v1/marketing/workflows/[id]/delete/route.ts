import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  deleteMarketingWorkflowBodySchema,
  deleteMarketingWorkflowResponseSchema,
} from "../../../../../../../server/marketing-workflows/marketing-workflow.schemas";
import { mutateMarketingWorkflowsMetadata } from "../../../../../../../server/marketing-workflows/marketing-workflow.route-metadata";
import { deleteMarketingWorkflow } from "../../../../../../../server/marketing-workflows/marketing-workflow.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof deleteMarketingWorkflowBodySchema>,
  z.output<typeof deleteMarketingWorkflowResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingWorkflowsMetadata,
  params: paramsSchema,
  body: deleteMarketingWorkflowBodySchema,
  output: deleteMarketingWorkflowResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    deleteMarketingWorkflow(tx, ctx, params["id"], input),
});
