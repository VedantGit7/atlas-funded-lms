import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createMarketingWorkflowBodySchema,
  marketingWorkflowResponseSchema,
  marketingWorkflowsListQuerySchema,
  marketingWorkflowsListResponseSchema,
} from "../../../../../server/marketing-workflows/marketing-workflow.schemas";
import {
  listMarketingWorkflowsMetadata,
  mutateMarketingWorkflowsMetadata,
} from "../../../../../server/marketing-workflows/marketing-workflow.route-metadata";
import {
  createMarketingWorkflow,
  listMarketingWorkflows,
} from "../../../../../server/marketing-workflows/marketing-workflow.service";

export const GET = createTenantRoute<
  z.output<typeof marketingWorkflowsListQuerySchema>,
  z.output<typeof marketingWorkflowsListResponseSchema>
>({
  metadata: listMarketingWorkflowsMetadata,
  input: marketingWorkflowsListQuerySchema,
  output: marketingWorkflowsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listMarketingWorkflows(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createMarketingWorkflowBodySchema>,
  z.output<typeof marketingWorkflowResponseSchema>
>({
  metadata: mutateMarketingWorkflowsMetadata,
  body: createMarketingWorkflowBodySchema,
  output: marketingWorkflowResponseSchema,
  handler: async ({ tx, ctx, input }) => createMarketingWorkflow(tx, ctx, input),
});
