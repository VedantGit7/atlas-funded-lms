import { serverApi } from "../server-api";

type DeadLetterListQuery = {
  limit?: number;
  cursor?: string;
};

export type SupportSessionRow = {
  sessionId: string;
  tenantId: string;
  tenantSlug: string;
  tenantDisplayName: string;
  expiresAt: string;
};

export type SupportSessionsResponse = {
  data: SupportSessionRow[];
};

export type DeadLetterRow = {
  id: string;
  tenantId: string | null;
  eventType: string;
  errorCode: string | null;
  safeErrorMessage: string | null;
  failedAt: string;
};

export type DeadLetterListResponse = {
  data: DeadLetterRow[];
  page: { nextCursor: string | null; hasMore: boolean };
};

export async function loadActiveSupportSessionsProjection(
  reason: string,
): Promise<SupportSessionsResponse> {
  return serverApi.get<SupportSessionsResponse>(
    `/api/v1/platform/support/sessions?reason=${encodeURIComponent(reason.trim())}`,
  );
}

export async function loadDeadLetterListProjection(
  reason: string,
  query: DeadLetterListQuery,
): Promise<DeadLetterListResponse> {
  const params = new URLSearchParams({
    reason: reason.trim(),
    limit: String(query.limit ?? 50),
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });
  return serverApi.get<DeadLetterListResponse>(
    `/api/v1/platform/eventing/dead-letters?${params.toString()}`,
  );
}
