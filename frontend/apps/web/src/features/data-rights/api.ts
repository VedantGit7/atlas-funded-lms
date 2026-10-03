import { ClientApiError, clientApi } from "../../lib/client-api";

export type ExportJobItem = {
  id: string;
  status: string;
  requestedByMembershipId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  errorCode: string | null;
};

export type ExportJobDetail = ExportJobItem & {
  download: { url: string; expiresAt: string } | null;
};

export type DeletionRequestItem = {
  id: string;
  status: string;
  targetType: "membership";
  targetId: string;
  requestedByMembershipId: string | null;
  reason: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  outcome?: {
    accessRemoved: boolean;
    erasure: string;
    retentionReviewRequired: boolean;
  } | null;
  completionMessage?: string | null;
};

export async function fetchExportJobs(params?: { status?: string; cursor?: string }) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.cursor) search.set("cursor", params.cursor);
  const query = search.toString();
  return clientApi.get<{
    data: { items: ExportJobItem[]; pageInfo: { nextCursor: string | null } };
  }>(`/api/v1/exports${query ? `?${query}` : ""}`);
}

export async function requestExport(idempotencyKey: string) {
  return clientApi.post<{ data: ExportJobItem }>("/api/v1/exports", {}, idempotencyKey);
}

export async function fetchExportJob(id: string) {
  return clientApi.get<{ data: ExportJobDetail }>(`/api/v1/exports/${id}`);
}

export async function fetchDeletionRequests(params?: { status?: string; cursor?: string }) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.cursor) search.set("cursor", params.cursor);
  const query = search.toString();
  return clientApi.get<{
    data: { items: DeletionRequestItem[]; pageInfo: { nextCursor: string | null } };
  }>(`/api/v1/deletion-requests${query ? `?${query}` : ""}`);
}

export async function createDeletionRequest(
  body: { confirm: true; targetMembershipId?: string; reason?: string },
  idempotencyKey: string,
) {
  return clientApi.post<{ data: DeletionRequestItem }>(
    "/api/v1/deletion-requests",
    body,
    idempotencyKey,
  );
}

export async function processDeletionRequest(id: string, idempotencyKey: string) {
  return clientApi.post<{ data: DeletionRequestItem }>(
    `/api/v1/deletion-requests/${id}/process`,
    { confirm: true },
    idempotencyKey,
  );
}

export function formatApiError(error: unknown): { message: string; requestId: string | null } {
  if (error instanceof ClientApiError) {
    return { message: error.message, requestId: error.requestId };
  }
  return { message: "Unexpected error.", requestId: null };
}
