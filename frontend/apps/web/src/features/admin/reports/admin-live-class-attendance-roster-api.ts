"use client";

import { clientApi } from "../../../lib/client-api";

export const LIVE_ATTENDANCE_COLUMN_OPTIONS = [
  { key: "learner_name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "status", label: "Status" },
  { key: "joined_at", label: "Joined" },
  { key: "left_at", label: "Left" },
  { key: "duration_seconds", label: "Duration" },
] as const;

export type LiveAttendanceColumnKey = (typeof LIVE_ATTENDANCE_COLUMN_OPTIONS)[number]["key"];

export type LiveAttendanceRateBand = "below_40" | "mid_40_75" | "above_75";

export type LiveLearnerAttendanceRateBand =
  | "below_40"
  | "mid_40_75"
  | "above_75"
  | "never_attended"
  | "perfect";

export type LiveLearnerSessionsRegisteredBand = "1" | "2_5" | "gt_5";

export type LiveLearnerLastAttendedFilter = "last_7d" | "last_30d" | "never" | "not_in_30d";

export type LiveLearnerSortBy =
  | "attendance_rate"
  | "sessions_attended"
  | "total_time"
  | "last_attended"
  | "learner_name"
  | "registered_count";

export const LIVE_LEARNER_ATTENDANCE_COLUMN_OPTIONS = [
  { key: "learner_name", label: "Learner" },
  { key: "email", label: "Email" },
  { key: "batch", label: "Batch" },
  { key: "registered_count", label: "Registered" },
  { key: "attended_count", label: "Attended" },
  { key: "attendance_rate", label: "Attendance rate" },
  { key: "absent_count", label: "Absent" },
  { key: "total_time", label: "Total time" },
  { key: "avg_coverage", label: "Avg coverage" },
  { key: "last_attended", label: "Last attended" },
  { key: "streak", label: "Streak" },
] as const;

export type LiveLearnerAttendanceColumnKey =
  (typeof LIVE_LEARNER_ATTENDANCE_COLUMN_OPTIONS)[number]["key"];

export type LiveLearnerListItem = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  batchId: string | null;
  batchName: string | null;
  registeredCount: number;
  attendedCount: number;
  absentCount: number;
  attendanceRatePct: number | null;
  totalTimeSeconds: number;
  avgCoveragePct: number | null;
  lastAttendedAt: string | null;
  lastAttendedSessionId: string | null;
  lastAttendedSessionTitle: string | null;
  streakKind: "attended" | "missed" | "none";
  streakCount: number;
  streakLabel: string;
  health: "danger" | "warning" | "ok";
};

export type LiveLearnersListSummary = {
  learnersRegistered: number;
  avgAttendanceRatePct: number | null;
  neverAttendedCount: number;
  perfectAttendanceCount: number;
  avgCoveragePct: number | null;
};

export type LiveLearnersMatrixCell = "attended" | "absent" | "registered" | "not_registered";

export type LiveLearnersMatrix = {
  sessions: Array<{
    sessionId: string;
    title: string;
    scheduledAt: string | null;
    turnoutRatePct: number | null;
  }>;
  learners: Array<{
    membershipId: string;
    learnerName: string | null;
    email: string | null;
    attendanceRatePct: number | null;
    attendedCount: number;
    registeredCount: number;
    cells: Array<{
      sessionId: string;
      cell: LiveLearnersMatrixCell;
      attendeeId: string | null;
    }>;
  }>;
  attentionRequired: boolean;
};

export type LiveSessionListItem = {
  id: string;
  title: string;
  status: string;
  courseId: string | null;
  courseTitle: string | null;
  batchId: string | null;
  batchName: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  attendanceCount: number;
  registeredCount: number;
  avgCoverageSeconds?: number | null;
};

export type LiveSessionsListSummary = {
  sessionsHeld: number;
  cancelledCount: number;
  scheduledAheadCount: number;
  avgAttendancePct: number | null;
  totalAttendedCount: number;
  totalRegisteredCount: number;
  totalTimeSeconds: number;
  avgCoveragePct: number | null;
  lowTurnoutCount: number;
};

export type LiveSessionDetail = LiveSessionListItem & {
  totalAttendanceSeconds: number;
  avgDurationSeconds: number | null;
  absentCount: number;
  avgCoveragePct: number | null;
  startDelayMinutes: number | null;
  cancelledAt: string | null;
  nextSessionAt: string | null;
  nextSessionTitle: string | null;
  expectedTurnoutCount: number | null;
  expectedTurnoutPct: number | null;
  recordingUrl?: string | null;
  peakConcurrent: number | null;
  peakConcurrentAt: string | null;
  peakConcurrentOffsetMinutes: number | null;
  timeline: {
    bucketMinutes: number;
    points: Array<{ offsetMinutes: number; concurrent: number }>;
    dropInsight: {
      fromOffsetMinutes: number;
      toOffsetMinutes: number;
      learnersLeft: number;
      message: string;
    } | null;
  };
};

export type LiveAttendeeItem = {
  id: string;
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  status: string;
  joinedAt: string | null;
  leftAt: string | null;
  durationSeconds: number | null;
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

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchLiveClassSessionsRoster(filters?: {
  q?: string | undefined;
  status?: string | undefined;
  startedFrom?: string | undefined;
  startedTo?: string | undefined;
  attendanceRateBand?: LiveAttendanceRateBand | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  page?: number | undefined;
}) {
  return clientApi.get<{
    data: {
      items: LiveSessionListItem[];
      pageInfo: PageInfo;
      summary: LiveSessionsListSummary;
    };
  }>(
    `/api/v1/reports/live-class-attendance${buildQuery({
      q: filters?.q,
      status: filters?.status,
      startedFrom: filters?.startedFrom,
      startedTo: filters?.startedTo,
      attendanceRateBand: filters?.attendanceRateBand,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      page: filters?.page ?? 1,
      limit: 50,
    })}`,
  );
}

export async function fetchLiveClassSessionDetail(sessionId: string) {
  return clientApi.get<{ data: LiveSessionDetail }>(
    `/api/v1/reports/live-class-attendance/${sessionId}`,
  );
}

export async function fetchLiveClassSessionAttendees(
  sessionId: string,
  filters: {
    learnerName?: string | undefined;
    email?: string | undefined;
    status?: string | undefined;
    joinedFrom?: string | undefined;
    joinedTo?: string | undefined;
    sortBy?: string | undefined;
    sortDir?: "asc" | "desc" | undefined;
    columns?: LiveAttendanceColumnKey[] | undefined;
    page?: number | undefined;
  },
) {
  return clientApi.get<{
    data: {
      sessionId: string;
      sessionTitle: string;
      items: LiveAttendeeItem[];
      pageInfo: PageInfo;
      columns: string[];
    };
  }>(
    `/api/v1/reports/live-class-attendance/${sessionId}/attendees${buildQuery({
      learnerName: filters.learnerName,
      email: filters.email,
      status: filters.status,
      joinedFrom: filters.joinedFrom,
      joinedTo: filters.joinedTo,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      columns: filters.columns?.join(","),
      page: filters.page ?? 1,
      limit: 25,
    })}`,
  );
}

export async function exportLiveClassAttendanceReport(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/live-class-attendance/export",
    body,
    "live-class-attendance-roster-export",
    { successMessage: "Live Class Attendance export queued." },
  );
}

export async function sendLiveClassAttendanceMessage(body: {
  sessionId?: string;
  membershipIds?: string[];
  audience?: "absentees" | "selected" | "registrants" | "low_attendance";
  subject: string;
  message: string;
  channels?: Array<"email" | "in_app">;
  sendTestToSelf?: boolean;
}) {
  const scope = body.sessionId ?? body.audience ?? "message";
  return clientApi.post<{
    data: {
      sendGroupId: string;
      deliveredCount: number;
      skippedCount: number;
      failedCount: number;
      recipientCount: number;
      status: "sent" | "partially_failed" | "failed";
    };
  }>(
    "/api/v1/reports/live-class-attendance/messages",
    body,
    `live-class-attendance-message:${scope}:${Date.now()}`,
    { successMessage: "Message queued for delivery." },
  );
}

export async function fetchLiveClassAttendanceLearners(filters?: {
  q?: string | undefined;
  courseId?: string | undefined;
  batchId?: string | undefined;
  scheduledFrom?: string | undefined;
  scheduledTo?: string | undefined;
  attendanceRateBand?: LiveLearnerAttendanceRateBand | undefined;
  sessionsRegisteredBand?: LiveLearnerSessionsRegisteredBand | undefined;
  lastAttended?: LiveLearnerLastAttendedFilter | undefined;
  sortBy?: LiveLearnerSortBy | undefined;
  sortDir?: "asc" | "desc" | undefined;
  columns?: LiveLearnerAttendanceColumnKey[] | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{
    data: {
      items: LiveLearnerListItem[];
      pageInfo: PageInfo;
      summary: LiveLearnersListSummary;
      columns: string[];
    };
  }>(
    `/api/v1/reports/live-class-attendance/learners${buildQuery({
      q: filters?.q,
      courseId: filters?.courseId,
      batchId: filters?.batchId,
      scheduledFrom: filters?.scheduledFrom,
      scheduledTo: filters?.scheduledTo,
      attendanceRateBand: filters?.attendanceRateBand,
      sessionsRegisteredBand: filters?.sessionsRegisteredBand,
      lastAttended: filters?.lastAttended,
      sortBy: filters?.sortBy ?? "attendance_rate",
      sortDir: filters?.sortDir ?? "asc",
      columns: filters?.columns?.join(","),
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function fetchLiveClassAttendanceLearnersMatrix(filters?: {
  q?: string | undefined;
  courseId?: string | undefined;
  batchId?: string | undefined;
  scheduledFrom?: string | undefined;
  scheduledTo?: string | undefined;
  attendanceRateBand?: LiveLearnerAttendanceRateBand | undefined;
  sessionsRegisteredBand?: LiveLearnerSessionsRegisteredBand | undefined;
  lastAttended?: LiveLearnerLastAttendedFilter | undefined;
  learnerLimit?: number | undefined;
  sessionLimit?: number | undefined;
}) {
  return clientApi.get<{ data: LiveLearnersMatrix }>(
    `/api/v1/reports/live-class-attendance/learners/matrix${buildQuery({
      q: filters?.q,
      courseId: filters?.courseId,
      batchId: filters?.batchId,
      scheduledFrom: filters?.scheduledFrom,
      scheduledTo: filters?.scheduledTo,
      attendanceRateBand: filters?.attendanceRateBand,
      sessionsRegisteredBand: filters?.sessionsRegisteredBand,
      lastAttended: filters?.lastAttended,
      learnerLimit: filters?.learnerLimit ?? 80,
      sessionLimit: filters?.sessionLimit ?? 24,
    })}`,
  );
}

export type LiveLearnerDetailSessionStatus = "present" | "absent" | "partial" | "registered";

export type LiveLearnerDetail = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  batchId: string | null;
  batchName: string | null;
  courseId: string | null;
  courseTitle: string | null;
  registeredCount: number;
  attendedCount: number;
  absentCount: number;
  attendanceRatePct: number | null;
  cohortAvgAttendanceRatePct: number | null;
  totalTimeSeconds: number;
  avgCoveragePct: number | null;
  lastAttendedAt: string | null;
  lastAttendedSessionId: string | null;
  lastAttendedSessionTitle: string | null;
  streakKind: "attended" | "missed" | "none";
  streakCount: number;
  streakLabel: string;
  atRisk: boolean;
  neverAttended: boolean;
  longestGap: {
    missedCount: number;
    label: string;
    fromScheduledAt: string | null;
    toScheduledAt: string | null;
  } | null;
  timing: {
    avgJoinDelayMinutes: number | null;
    avgLeaveEarlyMinutes: number | null;
    cohortAvgJoinDelayMinutes: number | null;
    cohortAvgLeaveEarlyMinutes: number | null;
  };
  monthlyPattern: Array<{
    monthKey: string;
    label: string;
    attendanceRatePct: number | null;
    cohortAvgRatePct: number | null;
    registeredCount: number;
    attendedCount: number;
  }>;
  strip: Array<{
    sessionId: string;
    attendeeId: string | null;
    title: string;
    scheduledAt: string | null;
    status: LiveLearnerDetailSessionStatus;
    coveragePct: number | null;
  }>;
  sessions: Array<{
    sessionId: string;
    attendeeId: string | null;
    title: string;
    courseTitle: string | null;
    batchName: string | null;
    scheduledAt: string | null;
    status: LiveLearnerDetailSessionStatus;
    joinedAt: string | null;
    leftAt: string | null;
    durationSeconds: number | null;
    coveragePct: number | null;
    joinDelayMinutes: number | null;
    leaveEarlyMinutes: number | null;
    cohortAvgDurationSeconds: number | null;
    note: string | null;
  }>;
  related: {
    batchId: string | null;
    batchName: string | null;
    courseId: string | null;
    courseTitle: string | null;
  };
};

export async function fetchLiveClassLearnerAttendanceDetail(
  membershipId: string,
  filters?: {
    scheduledFrom?: string | undefined;
    scheduledTo?: string | undefined;
    courseId?: string | undefined;
    batchId?: string | undefined;
  },
) {
  return clientApi.get<{ data: LiveLearnerDetail }>(
    `/api/v1/reports/live-class-attendance/learners/${membershipId}${buildQuery({
      scheduledFrom: filters?.scheduledFrom,
      scheduledTo: filters?.scheduledTo,
      courseId: filters?.courseId,
      batchId: filters?.batchId,
    })}`,
  );
}

export type LiveAttendeeDetail = {
  id: string;
  sessionId: string;
  sessionTitle: string;
  sessionStatus: string;
  sessionScheduledAt: string | null;
  sessionStartedAt: string | null;
  sessionEndedAt: string | null;
  sessionDurationSeconds: number | null;
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  status: "registered" | "attended" | "absent";
  systemInferredStatus: "registered" | "attended" | "absent";
  contradictsSystemData: boolean;
  registeredAt: string | null;
  batchId: string | null;
  batchName: string | null;
  courseId: string | null;
  courseTitle: string | null;
  joinedAt: string | null;
  leftAt: string | null;
  durationSeconds: number | null;
  coveragePct: number | null;
  joinDelayMinutes: number | null;
  rejoinCount: number;
  longestGapSeconds: number | null;
  overrideReason: string | null;
  overriddenAt: string | null;
  segments: Array<{
    id: string;
    index: number;
    joinedAt: string | null;
    leftAt: string | null;
    durationSeconds: number | null;
    shareOfSessionPct: number | null;
    clientLabel: string | null;
  }>;
  standing: {
    band: "above_median" | "at_median" | "below_median" | "absent" | "unavailable";
    label: string;
    learnerDurationSeconds: number | null;
    medianDurationSeconds: number | null;
    cohortSize: number;
    histogram: number[];
    learnerBucketIndex: number | null;
    medianBucketIndex: number | null;
  };
  historySummary: {
    attendedCount: number;
    totalSessions: number;
    attendanceRatePct: number | null;
  };
  history: Array<{
    sessionId: string;
    attendeeId: string | null;
    title: string;
    scheduledAt: string | null;
    status: string;
    coveragePct: number | null;
    durationSeconds: number | null;
    isCurrent: boolean;
  }>;
};

export async function fetchLiveClassAttendeeDetail(sessionId: string, attendeeId: string) {
  return clientApi.get<{ data: LiveAttendeeDetail }>(
    `/api/v1/reports/live-class-attendance/${sessionId}/attendees/${attendeeId}`,
  );
}

export async function updateLiveClassAttendeeStatus(
  sessionId: string,
  attendeeId: string,
  body: { status: "registered" | "attended" | "absent"; reason?: string },
) {
  return clientApi.patch<{
    data: {
      id: string;
      status: "registered" | "attended" | "absent";
      contradictsSystemData: boolean;
      overrideReason: string | null;
      overriddenAt: string | null;
    };
  }>(
    `/api/v1/reports/live-class-attendance/${sessionId}/attendees/${attendeeId}`,
    body,
    `live-class-attendance-status:${attendeeId}:${Date.now()}`,
    { successMessage: "Attendance status updated." },
  );
}

export type LiveClassSessionLiveMonitor = {
  sessionId: string;
  title: string;
  status: string;
  courseId: string | null;
  courseTitle: string | null;
  batchId: string | null;
  batchName: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  scheduledDurationSeconds: number | null;
  serverNow: string;
  elapsedSeconds: number | null;
  ranForSeconds: number | null;
  frozen: boolean;
  turnout: {
    joinedCount: number;
    registeredCount: number;
    presentCount: number;
    leftCount: number;
    notJoinedCount: number;
    ratePct: number | null;
    joinedLast5Min: number;
  };
  timeline: {
    bucketMinutes: number;
    plannedMinutes: number;
    asOfOffsetMinutes: number;
    points: Array<{ offsetMinutes: number; concurrent: number }>;
    currentConcurrent: number;
    peakConcurrent: number | null;
    peakConcurrentOffsetMinutes: number | null;
    peakConcurrentAt: string | null;
  };
  recentEvents: Array<{
    kind: "joined" | "left";
    at: string;
    membershipId: string;
    attendeeId: string;
    learnerName: string | null;
    email: string | null;
    durationSeconds: number | null;
  }>;
  presence: Array<{
    membershipId: string;
    attendeeId: string;
    learnerName: string | null;
    email: string | null;
    state: "present" | "left" | "not_joined";
    joinedAt: string | null;
    leftAt: string | null;
    durationSeconds: number | null;
  }>;
  notYetJoined: Array<{
    membershipId: string;
    attendeeId: string;
    learnerName: string | null;
    email: string | null;
    batchId: string | null;
    batchName: string | null;
    lastSessionStatus: string | null;
    attendanceRatePct: number | null;
  }>;
};

export async function fetchLiveClassSessionLiveMonitor(sessionId: string) {
  return clientApi.get<{ data: LiveClassSessionLiveMonitor }>(
    `/api/v1/reports/live-class-attendance/${sessionId}/live`,
  );
}

export type LiveSeriesGroupBy = "course" | "batch";

export type LiveSeriesSortBy =
  | "avg_turnout"
  | "sessions_held"
  | "registrations"
  | "never_attending"
  | "title";

export type LiveSeriesListItem = {
  seriesId: string;
  groupBy: LiveSeriesGroupBy;
  title: string;
  subtitle: string | null;
  secondaryId: string | null;
  sessionsHeld: number;
  sessionsTotal: number;
  cancelledCount: number;
  registrations: number;
  avgTurnoutPct: number | null;
  avgCoveragePct: number | null;
  neverAttendingCount: number;
  trendDeltaPts: number | null;
  sparkline: Array<number | null>;
  nextSessionId: string | null;
  nextSessionAt: string | null;
  nextSessionTitle: string | null;
  status: "running" | "finished";
};

export type LiveSeriesListSummary = {
  seriesCount: number;
  runningCount: number;
  finishedCount: number;
  sessionsCount: number;
  registrationsCount: number;
  avgTurnoutPct: number | null;
  bestSeries: { seriesId: string; title: string; avgTurnoutPct: number } | null;
  weakestSeries: { seriesId: string; title: string; avgTurnoutPct: number } | null;
  turnoutTrendPts: number | null;
};

export type LiveSeriesDropOff = {
  stages: Array<{ ordinal: number; label: string; retentionPct: number | null }>;
  biggestDrop: {
    fromOrdinal: number;
    toOrdinal: number;
    dropPts: number;
    label: string;
  } | null;
};

export type LiveSeriesDetail = {
  seriesId: string;
  groupBy: LiveSeriesGroupBy;
  title: string;
  subtitle: string | null;
  avgTurnoutPct: number | null;
  steepestDrop: {
    fromOrdinal: number;
    toOrdinal: number;
    dropPts: number;
    message: string;
  } | null;
  sessions: Array<{
    sessionId: string;
    ordinal: number;
    title: string;
    scheduledAt: string | null;
    status: string;
    cancelled: boolean;
    registeredCount: number;
    attendedCount: number;
    turnoutPct: number | null;
    avgCoveragePct: number | null;
  }>;
};

export async function fetchLiveClassAttendanceSeries(filters?: {
  groupBy?: LiveSeriesGroupBy | undefined;
  scheduledFrom?: string | undefined;
  scheduledTo?: string | undefined;
  q?: string | undefined;
  sortBy?: LiveSeriesSortBy | undefined;
  sortDir?: "asc" | "desc" | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{
    data: {
      groupBy: LiveSeriesGroupBy;
      items: LiveSeriesListItem[];
      pageInfo: PageInfo;
      summary: LiveSeriesListSummary;
      dropOff: LiveSeriesDropOff;
    };
  }>(
    `/api/v1/reports/live-class-attendance/series${buildQuery({
      groupBy: filters?.groupBy ?? "course",
      scheduledFrom: filters?.scheduledFrom,
      scheduledTo: filters?.scheduledTo,
      q: filters?.q,
      sortBy: filters?.sortBy ?? "avg_turnout",
      sortDir: filters?.sortDir ?? "asc",
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function fetchLiveClassAttendanceSeriesDetail(
  seriesId: string,
  filters?: {
    groupBy?: LiveSeriesGroupBy | undefined;
    scheduledFrom?: string | undefined;
    scheduledTo?: string | undefined;
  },
) {
  return clientApi.get<{ data: LiveSeriesDetail }>(
    `/api/v1/reports/live-class-attendance/series/${seriesId}${buildQuery({
      groupBy: filters?.groupBy ?? "course",
      scheduledFrom: filters?.scheduledFrom,
      scheduledTo: filters?.scheduledTo,
    })}`,
  );
}
