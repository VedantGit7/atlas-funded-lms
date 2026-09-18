import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  applyUseCaseBodySchema,
  marketingWorkflowResponseSchema,
} from "../../../../../../../server/marketing-workflows/marketing-workflow.schemas";
import { mutateMarketingWorkflowsMetadata } from "../../../../../../../server/marketing-workflows/marketing-workflow.route-metadata";
import { applyMarketingUseCase } from "../../../../../../../server/marketing-workflows/marketing-workflow.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof applyUseCaseBodySchema>,
  z.output<typeof marketingWorkflowResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingWorkflowsMetadata,
  params: paramsSchema,
  body: applyUseCaseBodySchema,
  output: marketingWorkflowResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    applyMarketingUseCase(tx, ctx, params["id"], input),
});
