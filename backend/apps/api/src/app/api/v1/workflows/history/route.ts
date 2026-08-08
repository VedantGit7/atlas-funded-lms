import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { getWorkflowHistory } from "../../../../../server/workflows/workflows.service";
import {
  workflowHistoryQuerySchema,
  workflowHistoryResponseSchema,
} from "../../../../../server/workflows/workflow-schemas";
import { getWorkflowHistoryRouteMetadata } from "./route.metadata";

type WorkflowHistoryQuery = z.output<typeof workflowHistoryQuerySchema>;
type WorkflowHistoryResponse = z.output<typeof workflowHistoryResponseSchema>;

export const GET = createTenantRoute<WorkflowHistoryQuery, WorkflowHistoryResponse>({
  metadata: getWorkflowHistoryRouteMetadata,
  input: workflowHistoryQuerySchema,
  output: workflowHistoryResponseSchema,
  handler: async ({ tx, input }) => getWorkflowHistory(tx, input.targetType, input.targetId),
});
