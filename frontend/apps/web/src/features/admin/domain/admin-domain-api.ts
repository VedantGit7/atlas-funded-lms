"use client";

import { clientApi } from "../../../lib/client-api";

export type Batch = {
  id: string;
  key: string;
  name: string;
  courseId: string | null;
  status: string;
  createdAt: string;
};

export type Poll = {
  id: string;
  title: string;
  description: string | null;
  pollType: string;
  status: string;
  quizMode: boolean;
  allowMultipleAnswers: boolean;
  anonymousVote: boolean;
  resultVisibility: string;
  layout: string;
  durationSeconds: number | null;
  liveSessionId: string | null;
  closesAt: string | null;
  options: Array<{ id: string; label: string; sortOrder: number; isCorrect: boolean }>;
  createdAt: string;
};

export type PollResults = {
  pollId: string;
  totalResponses: number;
  options: Array<{
    optionId: string;
    label: string;
    count: number;
    isCorrect: boolean;
    percent: number;
  }>;
};

export type LiveSession = {
  id: string;
  title: string;
  courseId: string | null;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

export type CustomFieldDefinition = {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  status: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  subject: string | null;
  status: string;
  messageCount: number;
  updatedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderMembershipId: string;
  body: string;
  sentAt: string;
};

export type DeviceSession = {
  id: string;
  membershipId: string;
  deviceFingerprint: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  platform: string | null;
  lastSeenAt: string;
  createdAt: string;
};

export type AtRiskRule = {
  id: string;
  key: string;
  name: string;
  ruleType: "inactivity_days" | "grade_below" | "low_activity_vs_cohort";
  config: Record<string, unknown>;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
};

export async function fetchBatches() {
  return clientApi.get<{ data: { items: Batch[] } }>("/api/v1/batches");
}

export async function createBatch(body: { key: string; name: string }) {
  return clientApi.post<{ data: Batch }>("/api/v1/batches", body, `batch-${body.key}`);
}

export async function fetchBatch(batchId: string) {
  return clientApi.get<{ data: Batch }>(`/api/v1/batches/${encodeURIComponent(batchId)}`);
}

/** Partial update: send only the fields that changed. */
export async function updateBatch(
  batchId: string,
  body: { name?: string; status?: string; metadataJson?: Record<string, unknown> },
) {
  return clientApi.patch<{ data: Batch }>(
    `/api/v1/batches/${encodeURIComponent(batchId)}`,
    body,
    `batch-update-${batchId}`,
  );
}

export async function deleteBatch(batchId: string) {
  return clientApi.delete<{ data: { deleted: boolean } }>(
    `/api/v1/batches/${encodeURIComponent(batchId)}`,
    `batch-delete-${batchId}`,
  );
}

export async function assignBatchMember(batchId: string, membershipId: string) {
  return clientApi.post(
    `/api/v1/batches/${encodeURIComponent(batchId)}/members`,
    { membershipId },
    `batch-member-${batchId}`,
  );
}

export async function fetchPolls() {
  return clientApi.get<{ data: { items: Poll[] } }>("/api/v1/polls");
}

export async function createPoll(body: {
  title: string;
  options: Array<{ label: string; sortOrder?: number }>;
}) {
  return clientApi.post<{ data: Poll }>(
    "/api/v1/polls",
    {
      title: body.title,
      options: body.options.map((option, index) => ({
        label: option.label,
        sortOrder: option.sortOrder ?? index,
      })),
    },
    `poll-${body.title}`,
  );
}

export async function fetchPollResults(pollId: string) {
  return clientApi.get<{ data: PollResults }>(
    `/api/v1/polls/${encodeURIComponent(pollId)}/results`,
  );
}

export async function fetchPoll(pollId: string) {
  return clientApi.get<{ data: Poll }>(`/api/v1/polls/${encodeURIComponent(pollId)}`);
}

/** Partial update. The route accepts every field as optional, so send only what changed. */
export async function updatePoll(
  pollId: string,
  body: {
    title?: string;
    description?: string | null;
    status?: string;
    quizMode?: boolean;
    allowMultipleAnswers?: boolean;
    anonymousVote?: boolean;
    resultVisibility?: "after_vote" | "after_poll_ends";
    layout?: "list" | "grid" | "card";
    durationSeconds?: number | null;
  },
) {
  return clientApi.patch<{ data: Poll }>(
    `/api/v1/polls/${encodeURIComponent(pollId)}`,
    body,
    `poll-update-${pollId}`,
  );
}

export async function deletePoll(pollId: string) {
  return clientApi.delete<{ data: { deleted: boolean } }>(
    `/api/v1/polls/${encodeURIComponent(pollId)}`,
    `poll-delete-${pollId}`,
  );
}

export async function fetchLiveSessions() {
  return clientApi.get<{ data: { items: LiveSession[] } }>("/api/v1/live/sessions");
}

export async function createLiveSession(body: { title: string; scheduledAt?: string }) {
  return clientApi.post<{ data: LiveSession }>(
    "/api/v1/live/sessions",
    body,
    `live-session-${body.title}`,
  );
}

export async function fetchLiveAttendance(sessionId: string) {
  return clientApi.get<{
    data: { items: Array<{ id: string; membershipId: string; status: string }> };
  }>(`/api/v1/live/sessions/${encodeURIComponent(sessionId)}/attendance`);
}

export async function fetchCustomFieldDefinitions() {
  return clientApi.get<{ data: { items: CustomFieldDefinition[] } }>(
    "/api/v1/custom-fields/definitions",
  );
}

export async function createCustomFieldDefinition(body: {
  key: string;
  label: string;
  fieldType: "text" | "number" | "boolean" | "select" | "date";
}) {
  return clientApi.post<{ data: CustomFieldDefinition }>(
    "/api/v1/custom-fields/definitions",
    body,
    `custom-field-${body.key}`,
  );
}

export type CustomFieldValue = {
  definitionId: string;
  membershipId: string;
  valueJson: unknown;
  updatedAt: string;
};

export async function fetchCustomFieldValues(definitionId: string) {
  return clientApi.get<{ data: { items: CustomFieldValue[] } }>(
    `/api/v1/custom-fields/definitions/${encodeURIComponent(definitionId)}/values`,
  );
}

/**
 * Sets one member's value for a definition.
 *
 * `valueJson` is deliberately `unknown`: the field type is configured per
 * definition (text, number, boolean, select, date), so the caller decides the
 * shape and the server validates it against the definition.
 */
export async function setCustomFieldValue(
  definitionId: string,
  body: { membershipId: string; valueJson: unknown },
) {
  return clientApi.post<{ data: CustomFieldValue }>(
    `/api/v1/custom-fields/definitions/${encodeURIComponent(definitionId)}/values`,
    body,
    `custom-field-value-${definitionId}`,
  );
}

export async function fetchConversations() {
  return clientApi.get<{ data: { items: Conversation[] } }>("/api/v1/messenger/conversations");
}

export async function fetchConversationMessages(conversationId: string) {
  return clientApi.get<{ data: { items: Message[] } }>(
    `/api/v1/messenger/conversations/${encodeURIComponent(conversationId)}/messages`,
  );
}

export async function sendConversationMessage(conversationId: string, body: string) {
  return clientApi.post<{ data: Message }>(
    `/api/v1/messenger/conversations/${encodeURIComponent(conversationId)}/messages`,
    { body },
    `message-${conversationId}`,
  );
}

export async function fetchDeviceSessions() {
  return clientApi.get<{ data: { items: DeviceSession[] } }>("/api/v1/devices/sessions?limit=50");
}

export async function fetchAtRiskRules() {
  return clientApi.get<{ data: { rules: AtRiskRule[] } }>("/api/v1/analytics/at-risk/rules");
}

export async function updateAtRiskRule(
  ruleId: string,
  body: { config?: Record<string, unknown>; status?: "ACTIVE" | "INACTIVE" },
) {
  return clientApi.patch<{ data: AtRiskRule }>(
    `/api/v1/analytics/at-risk/rules/${encodeURIComponent(ruleId)}`,
    body,
  );
}
