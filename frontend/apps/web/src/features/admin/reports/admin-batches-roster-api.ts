"use client";

import { clientApi } from "../../../lib/client-api";

export const BATCH_LEARNER_COLUMN_OPTIONS = [
  { key: "learner_name", label: "Learner" },
  { key: "email", label: "Email" },
  { key: "activity_at", label: "Last activity" },
  { key: "live_attendance_pct", label: "Live attendance %" },
  { key: "test_score_pct", label: "Test score %" },
  { key: "content_completion_pct", label: "Content completion %" },
  { key: "joined_at", label: "Joined on" },
] as const;

export type BatchLearnerColumnKey = (typeof BATCH_LEARNER_COLUMN_OPTIONS)[number]["key"];

export type BatchHealth = "on_track" | "at_risk" | "critical";

export type BatchListItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  courseId: string | null;
  courseTitle: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  memberCount: number;
  avgContentCompletionPct: number | null;
  avgLiveAttendancePct: number | null;
  avgTestScorePct: number | null;
  lastActivityAt: string | null;
  health: BatchHealth;
  createdAt: string;
};

export type BatchesListSummary = {
  activeBatchCount: number;
  totalLearners: number;
  avgContentCompletionPct: number | null;
  avgLiveAttendancePct: number | null;
  atRiskCount: number;
  endingSoonCount: number;
};

export type BatchDetail = BatchListItem & {
  averages: {
    contentCompletionPct: number | null;
    liveAttendancePct: number | null;
    testScorePct: number | null;
    activeLearnerCount: number;
    atRiskCount: number;
    liveSessionHeldCount: number;
    liveSessionTotalCount: number;
    passMarkPct: number | null;
  };
  overview: {
    needsAttention: Array<{
      membershipId: string;
      learnerName: string | null;
      email: string | null;
      reason: string;
      health: BatchHealth;
      contentCompletionPct: number | null;
      liveAttendancePct: number | null;
      testScorePct: number | null;
    }>;
    upcomingSessions: Array<{
      liveSessionId: string;
      title: string;
      scheduledAt: string | null;
      status: string;
      durationMinutes: number | null;
    }>;
    scoreDistribution: Array<{
      bucket: "below_60" | "from_60_to_80" | "above_80";
      label: string;
      count: number;
    }>;
    cohortTrend: Array<{
      weekLabel: string;
      weekStart: string;
      contentCompletionPct: number | null;
      liveAttendancePct: number | null;
      testScorePct: number | null;
    }>;
  };
};

export type BatchLearnerItem = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  activityAt: string | null;
  liveAttendancePct: number | null;
  liveAttendedCount: number;
  liveSessionCount: number;
  testScorePct: number | null;
  testAttemptCount: number;
  contentCompletionPct: number;
  completedLessons: number;
  totalLessons: number;
  joinedAt: string;
  health: BatchHealth;
};

export type BatchLearnerDetail = {
  batchId: string;
  batchKey: string;
  batchName: string;
  courseId: string | null;
  courseTitle: string | null;
  batchStartsAt: string | null;
  batchEndsAt: string | null;
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  joinedAt: string;
  activityAt: string | null;
  health: BatchHealth;
  summary: {
    liveAttendancePct: number | null;
    liveAttendedCount: number;
    livePartialCount: number;
    liveAbsentCount: number;
    liveSessionCount: number;
    testScorePct: number | null;
    bestTestScorePct: number | null;
    testAttemptCount: number;
    contentCompletionPct: number;
    completedLessons: number;
    totalLessons: number;
    daysInBatch: number;
    targetDays: number | null;
    passMarkPct: number | null;
    lastActivityLabel: string | null;
  };
  cohortAverages: {
    contentCompletionPct: number | null;
    liveAttendancePct: number | null;
    testScorePct: number | null;
  };
  standing: {
    completionPercentile: number | null;
    testPercentile: number | null;
    attendancePercentile: number | null;
    completionLabel: string;
    testLabel: string;
    attendanceLabel: string;
  };
  activityHeatmap: {
    cells: Array<{ date: string; count: number }>;
    longestGapDays: number | null;
  };
  membership: {
    membershipId: string;
    joinedAt: string;
    role: string;
    source: string;
    addedBy: string;
  };
  liveAttendance: Array<{
    liveSessionId: string;
    title: string;
    scheduledAt: string | null;
    status: string;
    sessionStatus: string;
    sessionKind: string | null;
    joinedAt: string | null;
    leftAt: string | null;
    durationSeconds: number | null;
    plannedDurationMinutes: number | null;
    attendanceKind: "attended" | "partial" | "absent" | "upcoming";
  }>;
  exams: Array<{
    assessmentId: string;
    assessmentTitle: string;
    attemptId: string;
    attemptStatus: string;
    scorePct: number | null;
    submittedAt: string | null;
    startedAt: string;
    durationSeconds: number | null;
    passMarkPct: number | null;
    outcome: "passed" | "borderline" | "failed" | "in_progress" | "other";
  }>;
  courseProgress: Array<{
    courseId: string;
    courseTitle: string;
    completedLessons: number;
    totalLessons: number;
    completionPct: number;
    lastLessonTitle: string | null;
    statusLabel: "completed" | "in_progress" | "behind" | "not_started";
  }>;
  lessonStrip: Array<{
    lessonId: string;
    title: string;
    sortOrder: number;
    completed: boolean;
    isNext: boolean;
  }>;
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type BatchesListSortBy =
  | "created_at"
  | "member_count"
  | "avg_content_completion_pct"
  | "avg_live_attendance_pct"
  | "avg_test_score_pct"
  | "starts_at"
  | "name";

export type BatchesListWindow =
  | "any"
  | "running"
  | "starting_soon"
  | "ending_soon"
  | "ended";
export type BatchesListHealthFilter = "any" | BatchHealth | "needs_attention";

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

export async function fetchBatchesRoster(filters?: {
  q?: string;
  status?: string;
  window?: BatchesListWindow;
  health?: BatchesListHealthFilter;
  sortBy?: BatchesListSortBy;
  sortDir?: "asc" | "desc";
  page?: number;
  limit?: number;
}) {
  return clientApi.get<{
    data: {
      items: BatchListItem[];
      pageInfo: PageInfo;
      summary: BatchesListSummary;
    };
  }>(
    `/api/v1/reports/batches${buildQuery({
      q: filters?.q,
      status: filters?.status,
      window: filters?.window,
      health: filters?.health,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function fetchBatchDetail(batchId: string) {
  return clientApi.get<{ data: BatchDetail }>(`/api/v1/reports/batches/${batchId}`);
}

export async function fetchBatchLearners(
  batchId: string,
  filters: {
    learnerName?: string;
    joinedFrom?: string;
    joinedTo?: string;
    minCompletion?: number;
    maxCompletion?: number;
    health?: BatchesListHealthFilter;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    columns?: BatchLearnerColumnKey[];
    page?: number;
    limit?: number;
  },
) {
  return clientApi.get<{
    data: {
      batchId: string;
      batchName: string;
      courseId: string | null;
      courseTitle: string | null;
      items: BatchLearnerItem[];
      pageInfo: PageInfo;
      columns: string[];
    };
  }>(
    `/api/v1/reports/batches/${batchId}/learners${buildQuery({
      learnerName: filters.learnerName,
      joinedFrom: filters.joinedFrom,
      joinedTo: filters.joinedTo,
      minCompletion: filters.minCompletion,
      maxCompletion: filters.maxCompletion,
      health: filters.health,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      columns: filters.columns?.join(","),
      page: filters.page ?? 1,
      limit: filters.limit ?? 25,
    })}`,
  );
}

export async function fetchBatchLearnerDetail(batchId: string, membershipId: string) {
  return clientApi.get<{ data: BatchLearnerDetail }>(
    `/api/v1/reports/batches/${batchId}/learners/${membershipId}`,
  );
}

export async function removeBatchLearner(
  batchId: string,
  membershipId: string,
  body: { reason: "transferred" | "withdrawn" | "administrative" | "other"; notes?: string },
) {
  return clientApi.delete<{ data: { removed: boolean; batchId: string; membershipId: string } }>(
    `/api/v1/reports/batches/${batchId}/learners/${membershipId}`,
    "batches-roster-remove-learner",
    body,
    { successMessage: "Learner removed from batch." },
  );
}

export async function sendBatchMessage(body: Record<string, unknown>) {
  return clientApi.post<{
    data: {
      sendGroupId: string;
      deliveredCount: number;
      skippedCount: number;
      failedCount: number;
      recipientCount: number;
      status: "sent" | "partially_failed" | "scheduled" | "failed";
    };
  }>("/api/v1/reports/batches/messages", body, "batches-roster-message", {
    successMessage: "Message queued for matched learners.",
  });
}

export async function exportBatchReport(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/batches/export",
    body,
    "batches-roster-export",
    { successMessage: "Batches export queued." },
  );
}

export type BatchLiveSessionItem = {
  id: string;
  title: string;
  kind: string | null;
  status: string;
  hostLabel: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  plannedDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  rosterCount: number;
  attendedCount: number;
  attendanceRatePct: number | null;
  avgWatchMinutes: number | null;
  lateCount: number;
  recordingUrl: string | null;
  hasRecording: boolean;
};

export type BatchLiveSessionsSummary = {
  avgAttendancePct: number | null;
  sessionsHeldCount: number;
  sessionsTotalCount: number;
  perfectAttendanceCount: number;
  missedThreeOrMoreCount: number;
  avgWatchMinutes: number | null;
  plannedWatchMinutes: number | null;
  rosterCount: number;
};

export type BatchLiveSessionsListData = {
  batchId: string;
  batchKey: string;
  batchName: string;
  courseId: string | null;
  courseTitle: string | null;
  items: BatchLiveSessionItem[];
  pageInfo: PageInfo;
  summary: BatchLiveSessionsSummary;
};

export type BatchLiveSessionsMatrixCellKind =
  | "attended"
  | "partial"
  | "absent"
  | "upcoming"
  | "cancelled"
  | "none";

export type BatchLiveSessionsMatrixData = {
  batchId: string;
  batchName: string;
  sessions: Array<{
    id: string;
    title: string;
    scheduledAt: string | null;
    status: string;
  }>;
  learners: Array<{
    membershipId: string;
    learnerName: string | null;
    email: string | null;
    cells: Array<{ liveSessionId: string; kind: BatchLiveSessionsMatrixCellKind }>;
    attendedCount: number;
    missedCount: number;
  }>;
};

export async function fetchBatchLiveSessions(
  batchId: string,
  filters: {
    q?: string;
    status?: "any" | "upcoming" | "completed" | "cancelled" | "live";
    sortBy?: "scheduled_at" | "title" | "attendance_rate";
    sortDir?: "asc" | "desc";
    page?: number;
    limit?: number;
  } = {},
) {
  return clientApi.get<{ data: BatchLiveSessionsListData }>(
    `/api/v1/reports/batches/${batchId}/live-sessions${buildQuery({
      q: filters.q,
      status: filters.status ?? "any",
      sortBy: filters.sortBy ?? "scheduled_at",
      sortDir: filters.sortDir ?? "desc",
      page: filters.page ?? 1,
      limit: filters.limit ?? 25,
    })}`,
  );
}

export async function fetchBatchLiveSessionsMatrix(
  batchId: string,
  filters: { q?: string; limitLearners?: number; limitSessions?: number } = {},
) {
  return clientApi.get<{ data: BatchLiveSessionsMatrixData }>(
    `/api/v1/reports/batches/${batchId}/live-sessions/matrix${buildQuery({
      q: filters.q,
      limitLearners: filters.limitLearners ?? 100,
      limitSessions: filters.limitSessions ?? 40,
    })}`,
  );
}

export async function fetchBatchLiveSessionAbsentees(
  batchId: string,
  minMissed = 1,
) {
  return clientApi.get<{ data: { membershipIds: string[] } }>(
    `/api/v1/reports/batches/${batchId}/live-sessions/absentees${buildQuery({
      minMissed,
    })}`,
  );
}

export type BatchLiveSessionAttendanceKind =
  | "attended"
  | "partial"
  | "absent"
  | "excused"
  | "upcoming";

export type BatchLiveSessionDetailData = {
  batchId: string;
  batchKey: string;
  batchName: string;
  session: {
    id: string;
    title: string;
    kind: string | null;
    status: string;
    hostLabel: string | null;
    scheduledAt: string | null;
    startedAt: string | null;
    endedAt: string | null;
    plannedDurationMinutes: number | null;
    actualDurationMinutes: number | null;
    recordingUrl: string | null;
    hasRecording: boolean;
    timezoneLabel: string | null;
  };
  nextSession: {
    id: string;
    title: string;
    scheduledAt: string | null;
  } | null;
  summary: {
    attendancePct: number | null;
    attendedCount: number;
    rosterCount: number;
    absentCount: number;
    avgWatchMinutes: number | null;
    plannedWatchMinutes: number | null;
    lateJoinCount: number;
    leftEarlyCount: number;
    peakConcurrent: number | null;
    peakConcurrentAt: string | null;
    peakConcurrentOffsetMinutes: number | null;
  };
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
  rules: {
    attendedMinWatchPct: number;
    partialMinWatchPct: number;
    warningWatchPct: number;
    lateJoinGraceMinutes: number;
  };
};

export type BatchLiveSessionAttendeeItem = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  attendanceKind: BatchLiveSessionAttendanceKind;
  healthRail: "none" | "warning" | "danger";
  joinedAt: string | null;
  leftAt: string | null;
  watchSeconds: number | null;
  watchMinutes: number | null;
  plannedMinutes: number | null;
  watchPct: number | null;
  late: boolean;
  leftEarly: boolean;
  rejoins: number | null;
  deviceLabel: string | null;
};

export async function fetchBatchLiveSessionDetail(batchId: string, sessionId: string) {
  return clientApi.get<{ data: BatchLiveSessionDetailData }>(
    `/api/v1/reports/batches/${batchId}/live-sessions/${sessionId}`,
  );
}

export async function fetchBatchLiveSessionAttendees(
  batchId: string,
  sessionId: string,
  filters: {
    q?: string;
    attendanceKind?: "any" | BatchLiveSessionAttendanceKind;
    sortBy?: "learner_name" | "joined_at" | "left_at" | "watch_pct" | "status" | "rejoins";
    sortDir?: "asc" | "desc";
    page?: number;
    limit?: number;
  } = {},
) {
  return clientApi.get<{
    data: {
      sessionId: string;
      sessionTitle: string;
      items: BatchLiveSessionAttendeeItem[];
      pageInfo: PageInfo;
    };
  }>(
    `/api/v1/reports/batches/${batchId}/live-sessions/${sessionId}/attendees${buildQuery({
      q: filters.q,
      attendanceKind: filters.attendanceKind ?? "any",
      sortBy: filters.sortBy ?? "status",
      sortDir: filters.sortDir ?? "asc",
      page: filters.page ?? 1,
      limit: filters.limit ?? 25,
    })}`,
  );
}

export type BatchExamAssessmentItem = {
  assessmentId: string;
  title: string;
  assessmentType: string;
  typeLabel: "exam" | "quiz" | "other";
  releasedAt: string | null;
  passMarkPct: number | null;
  rosterCount: number;
  attemptedCount: number;
  attemptedPct: number | null;
  avgScorePct: number | null;
  passRatePct: number | null;
  highScorePct: number | null;
  lowScorePct: number | null;
  awaitingGradingCount: number;
  healthRail: "none" | "success" | "warning" | "danger";
  distribution: {
    min: number | null;
    q1: number | null;
    median: number | null;
    q3: number | null;
    max: number | null;
  };
};

export type BatchExamsSummary = {
  avgScorePct: number | null;
  passMarkPct: number;
  passRatePct: number | null;
  passedLearnerCount: number;
  rosterCount: number;
  attemptCount: number;
  attemptsPerLearner: number | null;
  awaitingGradingCount: number;
  notAttemptedCount: number;
  assessmentCount: number;
};

export type BatchExamsListData = {
  batchId: string;
  batchKey: string;
  batchName: string;
  courseId: string | null;
  courseTitle: string | null;
  summary: BatchExamsSummary;
  assessments: BatchExamAssessmentItem[];
};

export type BatchExamsMatrixCellKind = "passed" | "failed" | "awaiting" | "not_attempted";

export type BatchExamsMatrixData = {
  batchId: string;
  batchName: string;
  passMarkPct: number;
  assessments: Array<{
    assessmentId: string;
    title: string;
    shortTitle: string;
    avgScorePct: number | null;
  }>;
  learners: Array<{
    membershipId: string;
    learnerName: string | null;
    email: string | null;
    avgScorePct: number | null;
    healthRail: "none" | "success" | "warning" | "danger";
    cells: Array<{
      assessmentId: string;
      kind: BatchExamsMatrixCellKind;
      scorePct: number | null;
      attemptCount: number;
    }>;
  }>;
  cohortAvgScorePct: number | null;
};

export async function fetchBatchExams(
  batchId: string,
  filters: {
    q?: string;
    sortBy?: "released_at" | "title" | "attempted_pct" | "avg_score" | "pass_rate";
    sortDir?: "asc" | "desc";
  } = {},
) {
  return clientApi.get<{ data: BatchExamsListData }>(
    `/api/v1/reports/batches/${batchId}/exams${buildQuery({
      q: filters.q,
      sortBy: filters.sortBy ?? "released_at",
      sortDir: filters.sortDir ?? "asc",
    })}`,
  );
}

export async function fetchBatchExamsMatrix(
  batchId: string,
  filters: { q?: string; limitLearners?: number } = {},
) {
  return clientApi.get<{ data: BatchExamsMatrixData }>(
    `/api/v1/reports/batches/${batchId}/exams/matrix${buildQuery({
      q: filters.q,
      limitLearners: filters.limitLearners ?? 100,
    })}`,
  );
}

export async function fetchBatchExamsBelowPass(batchId: string) {
  return clientApi.get<{ data: { membershipIds: string[]; passMarkPct: number } }>(
    `/api/v1/reports/batches/${batchId}/exams/below-pass`,
  );
}

export type BatchContentLessonType =
  | "video"
  | "article"
  | "quiz"
  | "project"
  | "interactive"
  | "other";

export type BatchContentFunnelLesson = {
  lessonId: string;
  moduleId: string;
  moduleTitle: string;
  modulePosition: number;
  lessonPosition: number;
  sequenceNumber: number;
  title: string;
  lessonType: BatchContentLessonType;
  typeLabel: string;
  completedCount: number;
  rosterCount: number;
  completionPct: number | null;
  medianDurationSeconds: number | null;
  medianDurationLabel: string | null;
  dropOffPct: number | null;
  healthRail: "none" | "warning" | "danger";
};

export type BatchContentReportData = {
  batchId: string;
  batchKey: string;
  batchName: string;
  courseId: string | null;
  courseTitle: string | null;
  startsAt: string | null;
  endsAt: string | null;
  summary: {
    avgCompletionPct: number | null;
    avgCompletedLessons: number | null;
    totalLessons: number;
    finishedCount: number;
    stalledCount: number;
    neverStartedCount: number;
    medianDaysToFinish: number | null;
    rosterCount: number;
    stalledDaysThreshold: number;
    weeksBehindSchedule: number | null;
    paceLabel: string | null;
  };
  completionSpread: {
    band0to25: number;
    band26to50: number;
    band51to75: number;
    band76to100: number;
  };
  paceSeries: Array<{
    weekLabel: string;
    weekStart: string;
    completionPct: number | null;
    expectedPct: number | null;
  }>;
  modules: Array<{
    moduleId: string;
    title: string;
    position: number;
    lessons: BatchContentFunnelLesson[];
  }>;
};

export type BatchContentLearnerItem = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  completionPct: number;
  completedLessons: number;
  totalLessons: number;
  lastLessonTitle: string | null;
  lastLessonSequence: number | null;
  lastActivityAt: string | null;
  daysSinceActivity: number | null;
  projectedFinishAt: string | null;
  projectedFinishLabel: string;
  willFinishInWindow: boolean | null;
  activityStatus: "active" | "stalled" | "never_started" | "finished";
  healthRail: "none" | "success" | "warning" | "danger";
};

export async function fetchBatchContent(batchId: string) {
  return clientApi.get<{ data: BatchContentReportData }>(
    `/api/v1/reports/batches/${batchId}/content`,
  );
}

export async function fetchBatchContentLearners(
  batchId: string,
  filters: {
    q?: string;
    view?: "any" | "stalled" | "never_started" | "finished" | "in_progress";
    sortBy?:
      | "learner_name"
      | "completion_pct"
      | "days_since"
      | "projected_finish"
      | "last_activity";
    sortDir?: "asc" | "desc";
    page?: number;
    limit?: number;
  } = {},
) {
  return clientApi.get<{
    data: {
      batchId: string;
      items: BatchContentLearnerItem[];
      pageInfo: PageInfo;
    };
  }>(
    `/api/v1/reports/batches/${batchId}/content/learners${buildQuery({
      q: filters.q,
      view: filters.view ?? "any",
      sortBy: filters.sortBy ?? "completion_pct",
      sortDir: filters.sortDir ?? "asc",
      page: filters.page ?? 1,
      limit: filters.limit ?? 25,
    })}`,
  );
}

export async function fetchBatchContentStalled(batchId: string) {
  return clientApi.get<{
    data: { membershipIds: string[]; stalledDaysThreshold: number };
  }>(`/api/v1/reports/batches/${batchId}/content/stalled`);
}

export type BatchMessageHistoryItem = {
  sendGroupId: string;
  subject: string;
  audienceLabel: string;
  recipientCount: number;
  deliveredCount: number;
  skippedCount: number;
  failedCount: number;
  openedCount: number | null;
  clickedCount: number | null;
  channels: Array<"email" | "in_app">;
  status: "sent" | "partially_failed" | "scheduled" | "failed";
  sentAt: string | null;
  scheduledAt: string | null;
  sentByLabel: string | null;
  isAutomated: boolean;
};

export type BatchMessageAudienceKey =
  | "whole_batch"
  | "at_risk"
  | "missed_last_session"
  | "below_pass"
  | "stalled";

export type BatchMessageAudience = {
  key: BatchMessageAudienceKey;
  label: string;
  count: number;
  membershipIds: string[];
};

export type BatchMessageNudge = {
  id: string;
  title: string;
  triggerKey: string;
  triggerLabel: string;
  enabled: boolean;
};

export type BatchMessagesListData = {
  batchId: string;
  batchKey: string;
  batchName: string;
  courseId: string | null;
  courseTitle: string | null;
  rosterCount: number;
  items: BatchMessageHistoryItem[];
  pageInfo: PageInfo;
};

export async function fetchBatchMessages(
  batchId: string,
  filters: { page?: number; limit?: number } = {},
) {
  return clientApi.get<{ data: BatchMessagesListData }>(
    `/api/v1/reports/batches/${batchId}/messages${buildQuery({
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    })}`,
  );
}

export async function fetchBatchMessageAudiences(batchId: string) {
  return clientApi.get<{
    data: { batchId: string; audiences: BatchMessageAudience[] };
  }>(`/api/v1/reports/batches/${batchId}/messages/audiences`);
}

export async function fetchBatchMessageNudges(batchId: string) {
  return clientApi.get<{
    data: { batchId: string; nudges: BatchMessageNudge[] };
  }>(`/api/v1/reports/batches/${batchId}/messages/nudges`);
}

export async function updateBatchMessageNudges(
  batchId: string,
  nudges: BatchMessageNudge[],
) {
  return clientApi.patch<{
    data: { batchId: string; nudges: BatchMessageNudge[] };
  }>(
    `/api/v1/reports/batches/${batchId}/messages/nudges`,
    { nudges },
    "batches-roster-message-nudges",
    { successMessage: "Automated nudges updated." },
  );
}

export async function retryBatchMessage(batchId: string, sendGroupId: string) {
  return clientApi.post<{
    data: {
      sendGroupId: string;
      deliveredCount: number;
      skippedCount: number;
      failedCount: number;
      recipientCount: number;
      status: "sent" | "partially_failed" | "scheduled" | "failed";
    };
  }>(
    `/api/v1/reports/batches/${batchId}/messages/retry`,
    { sendGroupId },
    "batches-roster-message-retry",
    { successMessage: "Retry queued for failed deliveries." },
  );
}

export type BatchesCompareNormalize = "week_of_batch" | "absolute_dates";

export type BatchCompareSpread = {
  band0to25: number;
  band26to50: number;
  band51to75: number;
  band76to100: number;
};

export type BatchCompareTrendPoint = {
  weekIndex: number;
  weekLabel: string;
  weekStart: string | null;
  contentCompletionPct: number | null;
};

export type BatchCompareMetrics = {
  learners: number;
  contentCompletionPct: number | null;
  liveAttendancePct: number | null;
  testScorePct: number | null;
  passRatePct: number | null;
  activeLast14Days: number;
  atRiskLearners: number;
  sessionsHeld: number;
  avgWatchMinutes: number | null;
  medianDaysToFinish: number | null;
};

export type BatchCompareItem = {
  id: string;
  key: string;
  name: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  isRunning: boolean;
  currentWeekIndex: number | null;
  metrics: BatchCompareMetrics;
  completionSpread: BatchCompareSpread;
  trend: BatchCompareTrendPoint[];
};

export type BatchesCompareData = {
  normalize: BatchesCompareNormalize;
  items: BatchCompareItem[];
};

export async function fetchBatchesCompare(
  batchIds: string[],
  normalize: BatchesCompareNormalize = "week_of_batch",
) {
  const params = new URLSearchParams();
  params.set("batchIds", batchIds.join(","));
  params.set("normalize", normalize);
  return clientApi.get<{ data: BatchesCompareData }>(
    `/api/v1/reports/batches/compare?${params.toString()}`,
  );
}
