import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { listReviewQueue } from "../../../../server/workflows/workflows.service";
import {
  workflowListQuerySchema,
  workflowListResponseSchema,
} from "../../../../server/workflows/workflow-schemas";
import { getWorkflowsRouteMetadata } from "./route.metadata";

type WorkflowListQuery = z.output<typeof workflowListQuerySchema>;
type WorkflowListResponse = z.output<typeof workflowListResponseSchema>;

export const GET = createTenantRoute<WorkflowListQuery, WorkflowListResponse>({
  metadata: getWorkflowsRouteMetadata,
  input: workflowListQuerySchema,
  output: workflowListResponseSchema,
  handler: async ({ tx, ctx, input }) => listReviewQueue(tx, ctx, input),
});
