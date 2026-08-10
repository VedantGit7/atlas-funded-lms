"use client";

import { clientApi } from "../../../lib/client-api";

export const ZOOM_PARTICIPANT_COLUMN_OPTIONS = [
  { key: "display_name", label: "Name", group: "identity" },
  { key: "email", label: "Email", group: "identity" },
  { key: "join_time", label: "Join time", group: "identity" },
  { key: "leave_time", label: "Leave time", group: "identity" },
  { key: "duration_seconds", label: "Duration", group: "identity" },
  { key: "match_state", label: "Match state", group: "metrics" },
  { key: "coverage", label: "Coverage", group: "metrics" },
  { key: "rejoins", label: "Rejoins", group: "metrics" },
] as const;

export type ZoomParticipantColumnKey = (typeof ZOOM_PARTICIPANT_COLUMN_OPTIONS)[number]["key"];

export const DEFAULT_ZOOM_PARTICIPANT_COLUMNS: ZoomParticipantColumnKey[] =
  ZOOM_PARTICIPANT_COLUMN_OPTIONS.map((column) => column.key);

export type ZoomConnectionStatus = "connected" | "disconnected" | "unknown";

export type ZoomMeetingsView = "all" | "has_unmatched" | "no_participants";

export type ZoomMatchState = "matched" | "unmatched" | "guest";

export type ZoomMeetingListItem = {
  id: string;
  externalMeetingId: string;
  topic: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  attendanceCount: number;
  matchedCount: number;
  unmatchedCount: number;
  totalAttendanceSeconds: number;
};

export type ZoomTimelinePoint = {
  minuteOffset: number;
  at: string;
  concurrent: number;
};

export type ZoomMeetingDetail = ZoomMeetingListItem & {
  avgDurationSeconds: number | null;
  connection: ZoomConnectionMeta;
  timeline: ZoomTimelinePoint[];
  peakConcurrent: number;
  peakAt: string | null;
  biggestDropCount: number;
  biggestDropFrom: string | null;
  biggestDropTo: string | null;
  linkedSession: {
    id: string;
    title: string;
    lmsAttendanceCount: number | null;
  } | null;
};

export type ZoomParticipantItem = {
  id: string;
  membershipId: string | null;
  externalUserId: string | null;
  displayName: string | null;
  zoomDisplayName: string | null;
  email: string | null;
  joinTime: string | null;
  leaveTime: string | null;
  durationSeconds: number | null;
  matchState: ZoomMatchState;
  sessionCount: number;
  rejoinCount: number;
};

export type ZoomConnectionMeta = {
  status: ZoomConnectionStatus;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  meetingsImportedToday: number;
  hasConnectionRecord: boolean;
};

export type ZoomMeetingsSummary = {
  meetingCount: number;
  participantCount: number;
  matchedCount: number;
  unmatchedCount: number;
  totalAttendanceSeconds: number;
  avgAttendancePerMeeting: number | null;
  avgDurationSeconds: number | null;
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export function dateInputToStartIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return `${trimmed}T00:00:00.000Z`;
}

export function dateInputToEndIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return `${trimmed}T23:59:59.999Z`;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchZoomMeetingsRoster(filters?: {
  q?: string | undefined;
  startedFrom?: string | undefined;
  startedTo?: string | undefined;
  view?: ZoomMeetingsView | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{
    data: {
      items: ZoomMeetingListItem[];
      pageInfo: PageInfo;
      connectionStatus: ZoomConnectionStatus;
      connection: ZoomConnectionMeta;
      summary: ZoomMeetingsSummary;
    };
  }>(
    `/api/v1/reports/zoom-insights${buildQuery({
      q: filters?.q,
      startedFrom: filters?.startedFrom,
      startedTo: filters?.startedTo,
      view: filters?.view ?? "all",
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 50,
    })}`,
  );
}

export async function fetchZoomMeetingDetail(meetingId: string) {
  return clientApi.get<{ data: ZoomMeetingDetail }>(`/api/v1/reports/zoom-insights/${meetingId}`);
}

export async function fetchZoomMeetingParticipants(
  meetingId: string,
  filters: {
    displayName?: string | undefined;
    email?: string | undefined;
    joinedFrom?: string | undefined;
    joinedTo?: string | undefined;
    matchState?: "all" | ZoomMatchState | undefined;
    durationBucket?: "any" | "under_10" | "10_to_30" | "over_30" | undefined;
    rejoinedOnly?: boolean | undefined;
    sortBy?: string | undefined;
    sortDir?: "asc" | "desc" | undefined;
    columns?: ZoomParticipantColumnKey[] | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  },
) {
  return clientApi.get<{
    data: {
      meetingId: string;
      topic: string | null;
      meetingDurationSeconds: number | null;
      items: ZoomParticipantItem[];
      pageInfo: PageInfo;
      columns: string[];
      summary: {
        matchedCount: number;
        unmatchedCount: number;
        guestCount: number;
      };
    };
  }>(
    `/api/v1/reports/zoom-insights/${meetingId}/participants${buildQuery({
      displayName: filters.displayName,
      email: filters.email,
      joinedFrom: filters.joinedFrom,
      joinedTo: filters.joinedTo,
      matchState: filters.matchState ?? "all",
      durationBucket: filters.durationBucket ?? "any",
      rejoinedOnly: filters.rejoinedOnly ?? false,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      columns: filters.columns?.join(","),
      page: filters.page ?? 1,
      limit: filters.limit ?? 25,
    })}`,
  );
}

export async function exportZoomInsightsReport(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/zoom-insights/export",
    body,
    "zoom-insights-roster-export",
    { successMessage: "Zoom Insights export queued." },
  );
}

export async function connectZoomAccount(body?: {
  accountId?: string;
  accountName?: string;
  accountEmail?: string;
  appId?: string;
  accessTokenRef?: string;
  refreshTokenRef?: string;
}) {
  return clientApi.post<{
    data: {
      id: string;
      accountId: string | null;
      status: string;
      connectedAt: string | null;
    };
  }>("/api/v1/zoom/connect", body ?? {}, "zoom-connect", {
    successMessage: "Zoom connection updated.",
  });
}

export type ZoomParticipantSession = {
  id: string;
  index: number;
  joinTime: string | null;
  leaveTime: string | null;
  durationSeconds: number | null;
  shareOfMeeting: number | null;
  deviceHint: "mobile" | "tablet" | "desktop" | "unknown";
};

export type ZoomParticipantDetail = {
  id: string;
  meetingId: string;
  meetingTopic: string | null;
  meetingExternalId: string;
  meetingStartedAt: string | null;
  meetingEndedAt: string | null;
  meetingDurationSeconds: number | null;
  membershipId: string | null;
  externalUserId: string | null;
  displayName: string | null;
  zoomDisplayName: string | null;
  email: string | null;
  matchState: ZoomMatchState;
  totalDurationSeconds: number;
  coveragePercent: number | null;
  sessionCount: number;
  rejoinCount: number;
  firstJoinedAt: string | null;
  lastLeftAt: string | null;
  longestGapSeconds: number | null;
  deviceHint: "mobile" | "tablet" | "desktop" | "unknown";
  sessions: ZoomParticipantSession[];
  attendanceHistory: Array<{
    meetingId: string;
    topic: string | null;
    startedAt: string | null;
    coveragePercent: number | null;
    isCurrent: boolean;
  }>;
  lmsCrossCheck: {
    enrollmentStatus: "active" | "inactive" | "unknown" | "unlinked";
    matchMethod: "membership" | "exact_email" | "none";
    zoomDurationSeconds: number;
    lmsDurationSeconds: number | null;
    discrepancySeconds: number | null;
  };
  otherUnmatchedMeetingCount: number;
};

export async function fetchZoomParticipantDetail(meetingId: string, participantId: string) {
  return clientApi.get<{ data: ZoomParticipantDetail }>(
    `/api/v1/reports/zoom-insights/${meetingId}/participants/${participantId}`,
  );
}

export async function mutateZoomParticipantMatch(
  meetingId: string,
  participantId: string,
  body: {
    action: "match" | "unlink" | "mark_guest";
    membershipId?: string;
    applyToOtherMeetings?: boolean;
  },
) {
  return clientApi.patch<{
    data: {
      participantId: string;
      matchState: ZoomMatchState;
      membershipId: string | null;
      updatedRowCount: number;
      updatedMeetingCount: number;
    };
  }>(
    `/api/v1/reports/zoom-insights/${meetingId}/participants/${participantId}`,
    body,
    "zoom-participant-match",
    {
      successMessage:
        body.action === "match"
          ? "Participant matched to learner."
          : body.action === "unlink"
            ? "Participant unlinked from learner."
            : "Participant marked as guest.",
    },
  );
}

export type ZoomPersonListItem = {
  identityKey: string;
  membershipId: string | null;
  externalUserId: string | null;
  displayName: string | null;
  zoomDisplayName: string | null;
  email: string | null;
  matchState: ZoomMatchState;
  meetingsAttended: number;
  meetingsInRange: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number | null;
  avgCoveragePercent: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  representativeMeetingId: string;
  representativeParticipantId: string;
};

export type ZoomPeopleSummary = {
  peopleCount: number;
  matchedCount: number;
  unmatchedCount: number;
  guestCount: number;
  avgMeetingsAttended: number | null;
  totalDurationSeconds: number;
  avgCoveragePercent: number | null;
  attendedOnceOnlyCount: number;
  meetingsInRange: number;
};

export type ZoomPersonMeetingItem = {
  meetingId: string;
  participantId: string;
  topic: string | null;
  externalMeetingId: string;
  startedAt: string | null;
  durationSeconds: number | null;
  coveragePercent: number | null;
  rejoinCount: number;
};

export type ZoomPersonAttendancePulseCell = {
  date: string;
  state: "high" | "partial" | "missed" | "none";
  coveragePercent: number | null;
  meetingCount: number;
};

export type ZoomPersonMeetingsDetail = {
  identityKey: string;
  membershipId: string | null;
  displayName: string | null;
  email: string | null;
  matchState: ZoomMatchState;
  totalMeetings: number;
  totalDurationSeconds: number;
  avgCoveragePercent: number | null;
  meetings: ZoomPersonMeetingItem[];
  attendancePulse: ZoomPersonAttendancePulseCell[];
  representativeMeetingId: string | null;
  representativeParticipantId: string | null;
};

export async function fetchZoomPeopleRoster(filters?: {
  q?: string | undefined;
  attendedFrom?: string | undefined;
  attendedTo?: string | undefined;
  matchState?: "all" | ZoomMatchState | undefined;
  meetingsMin?: number | undefined;
  meetingsMax?: number | undefined;
  coverageMin?: number | undefined;
  coverageMax?: number | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{
    data: {
      items: ZoomPersonListItem[];
      pageInfo: PageInfo;
      connectionStatus: ZoomConnectionStatus;
      connection: ZoomConnectionMeta;
      summary: ZoomPeopleSummary;
      range: {
        attendedFrom: string | null;
        attendedTo: string | null;
      };
    };
  }>(
    `/api/v1/reports/zoom-insights/participants${buildQuery({
      q: filters?.q,
      attendedFrom: filters?.attendedFrom,
      attendedTo: filters?.attendedTo,
      matchState: filters?.matchState ?? "all",
      meetingsMin: filters?.meetingsMin,
      meetingsMax: filters?.meetingsMax,
      coverageMin: filters?.coverageMin,
      coverageMax: filters?.coverageMax,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function fetchZoomPersonMeetings(filters: {
  identityKey: string;
  attendedFrom?: string | undefined;
  attendedTo?: string | undefined;
}) {
  return clientApi.get<{ data: ZoomPersonMeetingsDetail }>(
    `/api/v1/reports/zoom-insights/participants/history${buildQuery({
      identityKey: filters.identityKey,
      attendedFrom: filters.attendedFrom,
      attendedTo: filters.attendedTo,
    })}`,
  );
}

export type ZoomMatchSuggestion = {
  membershipId: string;
  displayName: string | null;
  email: string | null;
  confidence: "high" | "medium" | "low";
  reason: "exact_email" | "normalized_display_name" | "domain_plus_enrollment";
  reasonLabel: string;
};

export type ZoomUnmatchedIdentity = {
  identityKey: string;
  displayName: string | null;
  email: string | null;
  externalUserId: string | null;
  meetingsAttended: number;
  totalDurationSeconds: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  representativeMeetingId: string;
  representativeParticipantId: string;
  otherUnmatchedMeetingCount: number;
  group: "high" | "medium" | "guest" | "none";
  suggestions: ZoomMatchSuggestion[];
};

export type ZoomUnmatchedSummary = {
  unmatchedIdentities: number;
  meetingCount: number;
  joinRecordCount: number;
  highConfidence: number;
  needsReview: number;
  likelyGuests: number;
  attendanceNotCountedSeconds: number;
  reconciledLast30Days: number;
};

export type ZoomMatchingRules = {
  matchOnExactEmail: boolean;
  matchOnNormalizedDisplayName: boolean;
  matchOnEmailDomainPlusEnrollment: boolean;
  autoMatchHighConfidenceOnImport: boolean;
  guestEmailDomains: string[];
};

export async function fetchZoomUnmatchedIdentities(filters?: {
  q?: string | undefined;
  attendedFrom?: string | undefined;
  attendedTo?: string | undefined;
  group?: "all" | "high" | "medium" | "guest" | "none" | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{
    data: {
      items: ZoomUnmatchedIdentity[];
      groups: {
        high: ZoomUnmatchedIdentity[];
        medium: ZoomUnmatchedIdentity[];
        guest: ZoomUnmatchedIdentity[];
        none: ZoomUnmatchedIdentity[];
      };
      pageInfo: PageInfo;
      connectionStatus: ZoomConnectionStatus;
      connection: ZoomConnectionMeta;
      summary: ZoomUnmatchedSummary;
    };
  }>(
    `/api/v1/reports/zoom-insights/unmatched${buildQuery({
      q: filters?.q,
      attendedFrom: filters?.attendedFrom,
      attendedTo: filters?.attendedTo,
      group: filters?.group ?? "all",
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 50,
    })}`,
  );
}

export async function fetchZoomMatchingRules() {
  return clientApi.get<{ data: ZoomMatchingRules }>("/api/v1/reports/zoom-insights/matching-rules");
}

export async function updateZoomMatchingRules(body: ZoomMatchingRules) {
  return clientApi.patch<{ data: ZoomMatchingRules }>(
    "/api/v1/reports/zoom-insights/matching-rules",
    body,
    "zoom-matching-rules",
    { successMessage: "Matching rules saved." },
  );
}

export async function bulkMatchZoomUnmatched(body: {
  mode: "selected" | "all_high";
  applyToOtherMeetings?: boolean;
  items?: Array<{
    identityKey: string;
    membershipId: string;
    representativeMeetingId: string;
    representativeParticipantId: string;
  }>;
}) {
  return clientApi.post<{
    data: {
      matchedCount: number;
      updatedRowCount: number;
      updatedMeetingCount: number;
      results: Array<{
        identityKey: string;
        membershipId: string | null;
        matchState: ZoomMatchState;
        updatedRowCount: number;
        updatedMeetingCount: number;
        error?: string;
      }>;
    };
  }>("/api/v1/reports/zoom-insights/unmatched/bulk-match", body, "zoom-unmatched-bulk-match", {
    successMessage: "Identities matched.",
  });
}

export type ZoomSyncRunStatus = "completed" | "partial" | "failed" | "running";
export type ZoomSyncTrigger = "manual" | "scheduled" | "webhook" | "backfill";

export type ZoomSyncRun = {
  id: string;
  trigger: ZoomSyncTrigger;
  status: ZoomSyncRunStatus;
  startedAt: string;
  finishedAt: string | null;
  meetingsCount: number;
  participantsCount: number;
  skippedCount: number;
  errorMessage: string | null;
  logLines: string[];
};

export type ZoomSyncPulseCell = {
  index: number;
  status: "success" | "partial" | "failed" | "none";
  runId: string | null;
};

export type ZoomWebhookEvent = {
  id: string;
  eventType: string;
  topic: string | null;
  statusCode: number;
  receivedAt: string;
};

export type ZoomConnectionDetail = ZoomConnectionMeta & {
  id: string | null;
  accountId: string | null;
  accountName: string | null;
  accountEmail: string | null;
  appId: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  disconnectedAt: string | null;
  scheduleEnabled: boolean;
  scheduleIntervalMinutes: number;
  nextRunAt: string | null;
  nextRunInSeconds: number | null;
  coverageGapCount: number;
  meetingsImported: number;
  webhookEndpoint: string;
  webhookSecretMasked: string | null;
  hasWebhookSecret: boolean;
};

export async function fetchZoomConnectionDetail() {
  return clientApi.get<{
    data: {
      connection: ZoomConnectionDetail;
      syncPulse: ZoomSyncPulseCell[];
      syncRuns: ZoomSyncRun[];
      webhookEvents: ZoomWebhookEvent[];
      lastWebhookAt: string | null;
    };
  }>("/api/v1/reports/zoom-insights/connection");
}

export async function syncZoomConnectionNow() {
  return clientApi.post<{
    data: { run: ZoomSyncRun; connection: ZoomConnectionMeta };
  }>("/api/v1/reports/zoom-insights/connection/sync", {}, "zoom-connection-sync", {
    successMessage: "Zoom sync completed.",
  });
}

export async function estimateZoomBackfill(rangeFrom: string, rangeTo: string) {
  return clientApi.get<{
    data: { estimatedMeetings: number; estimatedParticipants: number };
  }>(
    `/api/v1/reports/zoom-insights/connection/backfill/estimate${buildQuery({
      rangeFrom,
      rangeTo,
    })}`,
  );
}

export async function backfillZoomConnection(body: {
  rangeFrom: string;
  rangeTo: string;
  skipAlreadyImported?: boolean;
}) {
  return clientApi.post<{
    data: {
      run: ZoomSyncRun;
      estimatedMeetings: number;
      estimatedParticipants: number;
    };
  }>("/api/v1/reports/zoom-insights/connection/backfill", body, "zoom-connection-backfill", {
    successMessage: "Backfill started.",
  });
}

export async function disconnectZoomConnection(confirmation: string) {
  return clientApi.post<{
    data: { status: "disconnected"; disconnectedAt: string };
  }>(
    "/api/v1/reports/zoom-insights/connection/disconnect",
    { confirmation },
    "zoom-connection-disconnect",
    { successMessage: "Zoom disconnected." },
  );
}

export async function updateZoomConnectionSchedule(body: {
  scheduleEnabled: boolean;
  scheduleIntervalMinutes?: number;
}) {
  return clientApi.patch<{
    data: {
      scheduleEnabled: boolean;
      scheduleIntervalMinutes: number;
      nextRunAt: string | null;
      nextRunInSeconds: number | null;
    };
  }>("/api/v1/reports/zoom-insights/connection/schedule", body, "zoom-connection-schedule", {
    successMessage: "Sync schedule updated.",
  });
}

export async function sendZoomWebhookTest() {
  return clientApi.post<{
    data: { event: ZoomWebhookEvent };
  }>("/api/v1/reports/zoom-insights/connection/webhook-test", {}, "zoom-connection-webhook-test", {
    successMessage: "Test webhook sent.",
  });
}
