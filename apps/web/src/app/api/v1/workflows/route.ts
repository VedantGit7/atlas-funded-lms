import type { NextRequest } from "next/server";
import type { z } from "zod";
import { z as zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createWorkflowDefinitionRecord,
  listReviewQueue,
  listWorkflowDefinitions,
} from "../../../../server/workflows/workflows.service";
import {
  createWorkflowDefinitionBodySchema,
  workflowDefinitionListResponseSchema,
  workflowDefinitionResponseSchema,
  workflowListQuerySchema,
  workflowListResponseSchema,
} from "../../../../server/workflows/workflow-schemas";
import {
  getWorkflowDefinitionsRouteMetadata,
  getWorkflowsRouteMetadata,
  manageWorkflowDefinitionsRouteMetadata,
} from "./route.metadata";

type WorkflowListQuery = z.output<typeof workflowListQuerySchema>;
type WorkflowListResponse = z.output<typeof workflowListResponseSchema>;
type WorkflowDefinitionListResponse = z.output<typeof workflowDefinitionListResponseSchema>;
type CreateWorkflowDefinitionBody = z.output<typeof createWorkflowDefinitionBodySchema>;
type WorkflowDefinitionResponse = z.output<typeof workflowDefinitionResponseSchema>;

const getReviewQueue = createTenantRoute<WorkflowListQuery, WorkflowListResponse>({
  metadata: getWorkflowsRouteMetadata,
  input: workflowListQuerySchema,
  output: workflowListResponseSchema,
  handler: async ({ tx, ctx, input }) => listReviewQueue(tx, ctx, input),
});

const workflowDefinitionsQuerySchema = zod.object({
  view: zod.literal("definitions"),
});

const getDefinitions = createTenantRoute<Record<string, never>, WorkflowDefinitionListResponse>({
  metadata: getWorkflowDefinitionsRouteMetadata,
  input: workflowDefinitionsQuerySchema,
  output: workflowDefinitionListResponseSchema,
  handler: async ({ tx }) => listWorkflowDefinitions(tx),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("view") === "definitions") {
    return getDefinitions(req);
  }
  return getReviewQueue(req);
}

export const POST = createTenantRoute<CreateWorkflowDefinitionBody, WorkflowDefinitionResponse>({
  metadata: manageWorkflowDefinitionsRouteMetadata,
  body: createWorkflowDefinitionBodySchema,
  output: workflowDefinitionResponseSchema,
  handler: async ({ tx, ctx, input }) => createWorkflowDefinitionRecord(tx, ctx, input),
});
