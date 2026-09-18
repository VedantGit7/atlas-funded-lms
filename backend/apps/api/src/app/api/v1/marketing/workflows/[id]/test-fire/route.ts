import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  testFireWorkflowBodySchema,
  testFireWorkflowResponseSchema,
} from "../../../../../../../server/marketing-workflows/marketing-workflow.schemas";
import { mutateMarketingWorkflowsMetadata } from "../../../../../../../server/marketing-workflows/marketing-workflow.route-metadata";
import { testFireMarketingWorkflow } from "../../../../../../../server/marketing-workflows/marketing-workflow.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof testFireWorkflowBodySchema>,
  z.output<typeof testFireWorkflowResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingWorkflowsMetadata,
  params: paramsSchema,
  body: testFireWorkflowBodySchema,
  output: testFireWorkflowResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    testFireMarketingWorkflow(tx, ctx, params["id"], input),
});
