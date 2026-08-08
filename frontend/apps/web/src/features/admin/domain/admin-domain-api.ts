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
