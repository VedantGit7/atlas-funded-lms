import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { marketingWorkflowRunsResponseSchema } from "../../../../../../../server/marketing-workflows/marketing-workflow.schemas";
import { listMarketingWorkflowsMetadata } from "../../../../../../../server/marketing-workflows/marketing-workflow.route-metadata";
import { listMarketingWorkflowRuns } from "../../../../../../../server/marketing-workflows/marketing-workflow.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingWorkflowRunsResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMarketingWorkflowsMetadata,
  params: paramsSchema,
  output: marketingWorkflowRunsResponseSchema,
  handler: async ({ tx, ctx, params }) => listMarketingWorkflowRuns(tx, ctx, params["id"]),
});
