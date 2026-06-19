"use client";

import type { z } from "zod";
import { ClientApiError, clientApi } from "../../lib/client-api";
import type {
  workflowListResponseSchema,
  workflowTransitionBodySchema,
  workflowTransitionResultSchema,
} from "../../server/workflows/workflow-schemas";

type WorkflowListResponse = z.infer<typeof workflowListResponseSchema>;
type WorkflowTransitionBody = z.infer<typeof workflowTransitionBodySchema>;
type WorkflowTransitionResponse = z.infer<typeof workflowTransitionResultSchema>;

export type WorkflowQueueItem = WorkflowListResponse["data"][number];

export async function listWorkflows(query?: {
  status?: "pending" | "acted" | "all";
  targetType?: "course";
  limit?: number;
  cursor?: string;
}): Promise<WorkflowListResponse> {
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.targetType) params.set("targetType", query.targetType);
  if (query?.limit != null) params.set("limit", String(query.limit));
  if (query?.cursor) params.set("cursor", query.cursor);

  const suffix = params.toString();
  return clientApi.get<WorkflowListResponse>(`/api/v1/workflows${suffix ? `?${suffix}` : ""}`);
}

export async function transitionWorkflow(
  id: string,
  body: WorkflowTransitionBody,
): Promise<WorkflowTransitionResponse> {
  return clientApi.post<WorkflowTransitionResponse>(
    `/api/v1/workflows/${id}/transition`,
    body,
    "workflow-transition",
  );
}

export function formatWorkflowApiError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return error.message;
  }
  return "Request failed.";
}
