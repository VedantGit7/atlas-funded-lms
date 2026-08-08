"use client";

import type { z } from "zod";
import { ClientApiError, clientApi } from "../../lib/client-api";
import type {
  gradeTaskBodySchema,
  gradeTaskResultSchema,
  gradingListResponseSchema,
  gradingTaskDetailResponseSchema,
} from "@atlas/contracts/grading/grading-schemas";

type GradingListResponse = z.infer<typeof gradingListResponseSchema>;
type GradingTaskDetailResponse = z.infer<typeof gradingTaskDetailResponseSchema>;
type GradeTaskBody = z.infer<typeof gradeTaskBodySchema>;
type GradeTaskResponse = z.infer<typeof gradeTaskResultSchema>;

export type GradingQueueItem = GradingListResponse["data"][number];
export type GradingTaskDetail = GradingTaskDetailResponse["data"];

export async function listGradingTasks(query?: {
  status?: "PENDING" | "IN_PROGRESS" | "GRADED" | "CANCELLED";
  assessmentId?: string;
  learnerMembershipId?: string;
  assignedTo?: "me" | "all";
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<GradingListResponse> {
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.assessmentId) params.set("assessmentId", query.assessmentId);
  if (query?.learnerMembershipId) params.set("learnerMembershipId", query.learnerMembershipId);
  if (query?.assignedTo) params.set("assignedTo", query.assignedTo);
  if (query?.q) params.set("q", query.q);
  if (query?.limit != null) params.set("limit", String(query.limit));
  if (query?.cursor) params.set("cursor", query.cursor);

  const suffix = params.toString();
  return clientApi.get<GradingListResponse>(`/api/v1/grading-tasks${suffix ? `?${suffix}` : ""}`);
}

export async function getGradingTask(taskId: string): Promise<GradingTaskDetailResponse> {
  return clientApi.get<GradingTaskDetailResponse>(`/api/v1/grading-tasks/${taskId}`);
}

export async function gradeGradingTask(
  taskId: string,
  body: GradeTaskBody,
): Promise<GradeTaskResponse> {
  return clientApi.post<GradeTaskResponse>(
    `/api/v1/grading-tasks/${taskId}/grade`,
    body,
    "grade-task",
  );
}

export function formatGradingApiError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return error.message;
  }

  return "Request failed.";
}
