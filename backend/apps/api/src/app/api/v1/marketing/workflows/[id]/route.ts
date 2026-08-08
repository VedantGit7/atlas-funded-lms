import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  marketingWorkflowResponseSchema,
  updateMarketingWorkflowBasicsBodySchema,
} from "../../../../../../server/marketing-workflows/marketing-workflow.schemas";
import {
  listMarketingWorkflowsMetadata,
  mutateMarketingWorkflowsMetadata,
} from "../../../../../../server/marketing-workflows/marketing-workflow.route-metadata";
import {
  getMarketingWorkflow,
  updateMarketingWorkflowBasics,
} from "../../../../../../server/marketing-workflows/marketing-workflow.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingWorkflowResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMarketingWorkflowsMetadata,
  params: paramsSchema,
  output: marketingWorkflowResponseSchema,
  handler: async ({ tx, ctx, params }) => getMarketingWorkflow(tx, ctx, params["id"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateMarketingWorkflowBasicsBodySchema>,
  z.output<typeof marketingWorkflowResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingWorkflowsMetadata,
  params: paramsSchema,
  body: updateMarketingWorkflowBasicsBodySchema,
  output: marketingWorkflowResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateMarketingWorkflowBasics(tx, ctx, params["id"], input),
});
