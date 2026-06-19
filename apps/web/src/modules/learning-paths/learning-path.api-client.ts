"use client";

import type { z } from "zod";
import { ClientApiError, clientApi } from "../../lib/client-api";
import type {
  createLearningPathBodySchema,
  learningPathDetailResponseSchema,
  learningPathListResponseSchema,
  pathProgressResponseSchema,
  publishLearningPathBodySchema,
  updateLearningPathBodySchema,
} from "../../server/learning-paths/learning-path.schemas";

type LearningPathListResponse = z.infer<typeof learningPathListResponseSchema>;
type LearningPathDetailResponse = z.infer<typeof learningPathDetailResponseSchema>;
type CreateLearningPathBody = z.infer<typeof createLearningPathBodySchema>;
type UpdateLearningPathBody = z.infer<typeof updateLearningPathBodySchema>;
type PublishLearningPathBody = z.infer<typeof publishLearningPathBodySchema>;
type PathProgressResponse = z.infer<typeof pathProgressResponseSchema>;

export async function listLearningPaths(query?: {
  view?: "studio";
  type?: "roadmap" | "program";
  status?: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<LearningPathListResponse> {
  const params = new URLSearchParams();
  if (query?.view) params.set("view", query.view);
  if (query?.type) params.set("type", query.type);
  if (query?.status) params.set("status", query.status);
  if (query?.q) params.set("q", query.q);
  if (query?.limit != null) params.set("limit", String(query.limit));
  if (query?.cursor) params.set("cursor", query.cursor);

  const suffix = params.toString();
  return clientApi.get<LearningPathListResponse>(
    `/api/v1/learning-paths${suffix ? `?${suffix}` : ""}`,
  );
}

export async function getLearningPath(
  pathId: string,
  view?: "studio",
): Promise<LearningPathDetailResponse> {
  const suffix = view ? "?view=studio" : "";
  return clientApi.get<LearningPathDetailResponse>(`/api/v1/learning-paths/${pathId}${suffix}`);
}

export async function createLearningPath(
  body: CreateLearningPathBody,
): Promise<LearningPathDetailResponse> {
  return clientApi.post<LearningPathDetailResponse>("/api/v1/learning-paths", body, "path-create");
}

export async function updateLearningPath(
  pathId: string,
  body: UpdateLearningPathBody,
): Promise<LearningPathDetailResponse> {
  return clientApi.put<LearningPathDetailResponse>(
    `/api/v1/learning-paths/${pathId}`,
    body,
    "path-update",
  );
}

export async function deleteLearningPath(pathId: string): Promise<{ data: { id: string } }> {
  return clientApi.delete<{ data: { id: string; deleted: true } }>(
    `/api/v1/learning-paths/${pathId}`,
    "path-delete",
  );
}

export async function publishLearningPath(
  pathId: string,
  body: PublishLearningPathBody = {},
): Promise<{ data: { id: string; status: "REVIEW" } }> {
  return clientApi.post<{ data: { id: string; status: "REVIEW" } }>(
    `/api/v1/learning-paths/${pathId}/publish`,
    body,
    "path-publish",
  );
}

export async function enrollInLearningPath(pathId: string): Promise<{ data: { id: string } }> {
  return clientApi.post<{ data: { id: string } }>(
    `/api/v1/learning-paths/${pathId}/enroll`,
    {},
    "path-enroll",
  );
}

export async function getLearningPathProgress(pathId: string): Promise<PathProgressResponse> {
  return clientApi.get<PathProgressResponse>(`/api/v1/learning-paths/${pathId}/progress`);
}

export function formatLearningPathApiError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Something went wrong.";
}
