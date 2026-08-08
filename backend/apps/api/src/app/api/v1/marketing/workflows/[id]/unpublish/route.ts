import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { z as zod } from "zod";
import { marketingWorkflowResponseSchema } from "../../../../../../../server/marketing-workflows/marketing-workflow.schemas";
import { mutateMarketingWorkflowsMetadata } from "../../../../../../../server/marketing-workflows/marketing-workflow.route-metadata";
import { unpublishMarketingWorkflow } from "../../../../../../../server/marketing-workflows/marketing-workflow.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof marketingWorkflowResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingWorkflowsMetadata,
  params: paramsSchema,
  body: noBodySchema,
  output: marketingWorkflowResponseSchema,
  handler: async ({ tx, ctx, params }) => unpublishMarketingWorkflow(tx, ctx, params["id"]),
});
