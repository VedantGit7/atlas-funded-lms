"use client";

import { toast } from "../../lib/feedback/toast";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "REVIEWING", label: "Reviewing" },
  { value: "ACTIONED", label: "Actioned" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CLOSED", label: "Closed" },
] as const;

export const TARGET_TYPE_OPTIONS = [
  { value: "", label: "All targets" },
  { value: "post", label: "Posts" },
  { value: "comment", label: "Comments" },
] as const;

export type ModerationCaseItem = {
  id: string;
  status: string;
  targetType: string;
  targetId: string;
  reasonKey: string | null;
  createdAt: string;
  target: {
    previewText: string;
    title: string | null;
    deleted?: boolean;
  } | null;
  decisions?: Array<{
    id: string;
    decisionKey: string;
    decidedByMembershipId: string | null;
    occurredAt: string;
    metadata: Record<string, unknown> | null;
  }>;
  appeals?: Array<{
    id: string;
    status: string;
    body: string;
    submittedByMembershipId: string;
  }>;
};

export class ModerationApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId: string,
  ) {
    super(message);
    this.name = "ModerationApiError";
  }
}

async function parseError(response: Response): Promise<ModerationApiError> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; requestId?: string };
  };
  return new ModerationApiError(
    body.error?.message ?? "Request failed",
    response.status,
    body.error?.requestId ?? "",
  );
}

function idempotencyHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  };
}

export async function listModerationCases(query: {
  status?: string;
  targetType?: string;
  view?: "cases" | "appeals";
}): Promise<{ data: { items: ModerationCaseItem[] } }> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.targetType) params.set("targetType", query.targetType);
  if (query.view) params.set("view", query.view);

  const response = await fetch(`/api/v1/moderation/cases?${params.toString()}`);
  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as { data: { items: ModerationCaseItem[] } };
}

export async function createModerationCase(body: {
  targetType: "post" | "comment";
  targetId: string;
  reasonKey?: string;
}): Promise<{ data: ModerationCaseItem }> {
  const response = await fetch("/api/v1/moderation/cases", {
    method: "POST",
    headers: idempotencyHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  toast.mutationSuccess({ idempotencyKeyPrefix: "moderation-case-create", method: "POST" });
  return (await response.json()) as { data: ModerationCaseItem };
}

export async function createAppeal(body: {
  moderationCaseId: string;
  body: string;
}): Promise<{
  data: {
    id: string;
    moderationCaseId: string;
    status: string;
    body: string;
    createdAt: string;
  };
}> {
  const response = await fetch("/api/v1/appeals", {
    method: "POST",
    headers: idempotencyHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  toast.mutationSuccess({ idempotencyKeyPrefix: "moderation-appeal-create", method: "POST" });
  return (await response.json()) as {
    data: {
      id: string;
      moderationCaseId: string;
      status: string;
      body: string;
      createdAt: string;
    };
  };
}

export async function beginModerationReview(caseId: string): Promise<{ data: ModerationCaseItem }> {
  const response = await fetch(`/api/v1/moderation/cases/${caseId}/decide`, {
    method: "POST",
    headers: idempotencyHeaders(),
    body: JSON.stringify({ decisionKey: "begin_review" }),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  toast.mutationSuccess({ idempotencyKeyPrefix: "moderation-review-begin", method: "POST" });
  return (await response.json()) as { data: ModerationCaseItem };
}

export async function getModerationCase(
  caseId: string,
): Promise<{ data: { items: ModerationCaseItem[] } }> {
  const response = await fetch(`/api/v1/moderation/cases?caseId=${caseId}`);
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as { data: { items: ModerationCaseItem[] } };
}

export async function decideModerationCase(
  caseId: string,
  body: {
    decisionKey: "actioned" | "rejected" | "closed";
    reason?: string;
    contentAction?: "delete";
  },
): Promise<{ data: ModerationCaseItem }> {
  const response = await fetch(`/api/v1/moderation/cases/${caseId}/decide`, {
    method: "POST",
    headers: idempotencyHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  toast.mutationSuccess({ idempotencyKeyPrefix: "moderation-case-decide", method: "POST" });
  return (await response.json()) as { data: ModerationCaseItem };
}

export async function reviewAppeal(
  appealId: string,
  body: {
    outcome: "uphold" | "reject";
    reason?: string;
    nextCaseStatus?: "REJECTED" | "CLOSED";
  },
): Promise<{
  data: {
    appealId: string;
    outcome: "uphold" | "reject";
    appealStatus: "upheld" | "rejected";
    caseStatus: string;
  };
}> {
  const response = await fetch(`/api/v1/appeals/${appealId}/review`, {
    method: "POST",
    headers: idempotencyHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  toast.mutationSuccess({ idempotencyKeyPrefix: "moderation-appeal-review", method: "POST" });
  return (await response.json()) as {
    data: {
      appealId: string;
      outcome: "uphold" | "reject";
      appealStatus: "upheld" | "rejected";
      caseStatus: string;
    };
  };
}

export function formatModerationError(error: unknown): string {
  if (error instanceof ModerationApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}

export { STATUS_OPTIONS, TARGET_TYPE_OPTIONS };
