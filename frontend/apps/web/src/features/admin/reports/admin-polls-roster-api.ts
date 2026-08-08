"use client";

import { clientApi } from "../../../lib/client-api";

export const POLL_RESPONDENT_COLUMN_OPTIONS = [
  { key: "learner_name", label: "Learner" },
  { key: "email", label: "Email" },
  { key: "option_label", label: "Option" },
  { key: "is_correct", label: "Correct" },
  { key: "responded_at", label: "Responded on" },
] as const;

export type PollRespondentColumnKey = (typeof POLL_RESPONDENT_COLUMN_OPTIONS)[number]["key"];

export type PollsListView =
  | "all"
  | "open"
  | "anonymous"
  | "quiz"
  | "live"
  | "standalone";

export type PollListItem = {
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
  liveSessionTitle: string | null;
  closesAt: string | null;
  isOpen: boolean;
  responseCount: number;
  optionCount: number;
  participationPct: number | null;
  createdAt: string;
};

export type PollsListSummary = {
  totalResponses: number;
  pollCount: number;
  avgParticipationPct: number | null;
  quizPollCount: number;
  avgQuizCorrectPct: number | null;
  openNowCount: number;
  anonymousCount: number;
};

export type PollOptionBreakdown = {
  optionId: string;
  label: string;
  sortOrder: number;
  isCorrect: boolean;
  count: number;
  percent: number;
};

export type PollTimelinePoint = {
  offsetSeconds: number;
  responseCount: number;
};

export type PollTimelineEvent = {
  kind: "opened" | "half" | "closed";
  at: string;
  label: string;
  detail: string | null;
};

export type PollDetail = PollListItem & {
  totalResponses: number;
  uniqueLearnerCount: number;
  eligibleCount: number | null;
  correctCount: number | null;
  correctPct: number | null;
  medianResponseSeconds: number | null;
  openedAt: string;
  closedAt: string | null;
  firstResponseAt: string | null;
  lastResponseAt: string | null;
  options: PollOptionBreakdown[];
  respondentsHidden: boolean;
  timeline: {
    bucketSeconds: number;
    durationSeconds: number;
    points: PollTimelinePoint[];
    earlySharePct: number | null;
    events: PollTimelineEvent[];
  };
};

export type PollRespondentItem = {
  membershipId: string | null;
  learnerName: string | null;
  email: string | null;
  optionId: string;
  optionLabel: string;
  isCorrect: boolean | null;
  responseSeconds: number | null;
  respondedAt: string;
};

export type PollOptionSegment = {
  key: string;
  label: string;
  count: number;
  percent: number;
};

export type PollOptionTimingBucket = {
  offsetSeconds: number;
  optionCount: number;
  overallCount: number;
};

export type PollOptionDetail = {
  pollId: string;
  pollTitle: string;
  pollDescription: string | null;
  quizMode: boolean;
  anonymousVote: boolean;
  isOpen: boolean;
  openedAt: string;
  closedAt: string | null;
  respondentsHidden: boolean;
  option: PollOptionBreakdown;
  totalResponses: number;
  optionCount: number;
  rank: number;
  votesAheadOfNext: number | null;
  medianResponseSeconds: number | null;
  overallMedianResponseSeconds: number | null;
  timingInsight: string | null;
  timing: {
    bucketSeconds: number;
    durationSeconds: number;
    buckets: PollOptionTimingBucket[];
  };
  segments: PollOptionSegment[];
  siblings: PollOptionBreakdown[];
};

export type PollNonRespondentItem = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  batchId: string | null;
  batchName: string | null;
  presence: "present" | "absent";
  watchSeconds: number | null;
  pollsAnswered: number;
  lastResponseAt: string | null;
};

export type PollLiveRecentAnswer = {
  membershipId: string | null;
  learnerName: string | null;
  optionId: string;
  optionLabel: string;
  respondedAt: string;
};

export type PollLiveMonitor = {
  pollId: string;
  title: string;
  description: string | null;
  quizMode: boolean;
  anonymousVote: boolean;
  resultVisibility: string;
  isOpen: boolean;
  durationSeconds: number | null;
  openedAt: string;
  closedAt: string | null;
  closesAt: string | null;
  liveSessionId: string | null;
  liveSessionTitle: string | null;
  serverNow: string;
  secondsRemaining: number | null;
  ranForSeconds: number | null;
  totalResponses: number;
  eligibleCount: number | null;
  participationPct: number | null;
  avgResponseSeconds: number | null;
  correctPct: number | null;
  recentResponseCount: number;
  showCorrectAnswers: boolean;
  options: PollOptionBreakdown[];
  timeline: {
    bucketSeconds: number;
    durationSeconds: number;
    points: PollTimelinePoint[];
  };
  recentAnswers: PollLiveRecentAnswer[];
  events: PollTimelineEvent[];
};

export type LiveSessionMatrixCellKind =
  | "answered"
  | "missed"
  | "correct"
  | "incorrect"
  | "anonymous";

export type LiveSessionPollReport = {
  session: {
    id: string;
    title: string;
    status: string;
    scheduledAt: string | null;
    startedAt: string | null;
    endedAt: string | null;
    durationSeconds: number | null;
    attendanceCount: number;
    hostLabel: string | null;
    courseId: string | null;
    courseTitle: string | null;
    batchId: string | null;
    batchName: string | null;
    recordingUrl: string | null;
    hasRecording: boolean;
    timezoneLabel: string | null;
  };
  summary: {
    pollsRun: number;
    opinionCount: number;
    quizCount: number;
    avgParticipationPct: number | null;
    mostAnswered: {
      pollId: string;
      title: string;
      responseCount: number;
    } | null;
    leastAnswered: {
      pollId: string;
      title: string;
      responseCount: number;
    } | null;
    answeredEveryPollCount: number;
  };
  timeline: {
    durationSeconds: number;
    insight: string | null;
    attendance: {
      bucketSeconds: number;
      points: Array<{ offsetSeconds: number; concurrent: number }>;
    };
    polls: Array<{
      pollId: string;
      title: string;
      offsetStartSeconds: number;
      offsetEndSeconds: number;
      participationPct: number | null;
      responseCount: number;
    }>;
  };
  polls: Array<{
    pollId: string;
    title: string;
    description: string | null;
    quizMode: boolean;
    anonymousVote: boolean;
    isOpen: boolean;
    pollType: string;
    openedAt: string;
    closedAt: string | null;
    responseCount: number;
    eligibleCount: number | null;
    participationPct: number | null;
    correctPct: number | null;
    options: PollOptionBreakdown[];
  }>;
  matrix: {
    polls: Array<{
      pollId: string;
      title: string;
      openedAt: string;
      anonymousVote: boolean;
      quizMode: boolean;
      participationPct: number | null;
    }>;
    learners: Array<{
      membershipId: string;
      learnerName: string | null;
      email: string | null;
      cells: Array<{ pollId: string; kind: LiveSessionMatrixCellKind }>;
      answeredCount: number;
      trackedPollCount: number;
    }>;
    truncated: boolean;
  };
};

export type PollNonRespondentsSummary = {
  audienceKnown: boolean;
  audienceSource: "none" | "live_session" | "batch";
  liveSessionId: string | null;
  liveSessionTitle: string | null;
  batchId: string | null;
  batchName: string | null;
  pollTitle: string;
  pollIsOpen: boolean;
  anonymousVote: boolean;
  eligibleCount: number;
  respondentCount: number;
  nonRespondentCount: number;
  presentNonRespondentCount: number;
  absentNonRespondentCount: number;
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

export async function fetchPollsRoster(filters?: {
  q?: string;
  status?: string;
  pollType?: string;
  view?: PollsListView;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
}) {
  return clientApi.get<{
    data: {
      items: PollListItem[];
      pageInfo: PageInfo;
      summary: PollsListSummary;
    };
  }>(
    `/api/v1/reports/polls${buildQuery({
      q: filters?.q,
      status: filters?.status,
      pollType: filters?.pollType,
      view: filters?.view,
      createdFrom: filters?.createdFrom,
      createdTo: filters?.createdTo,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function fetchPollDetail(pollId: string) {
  return clientApi.get<{ data: PollDetail }>(`/api/v1/reports/polls/${pollId}`);
}

export async function fetchPollLiveMonitor(pollId: string) {
  return clientApi.get<{ data: PollLiveMonitor }>(`/api/v1/reports/polls/${pollId}/live`);
}

export async function fetchLiveSessionPollReport(liveSessionId: string) {
  return clientApi.get<{ data: LiveSessionPollReport }>(
    `/api/v1/reports/polls/live-sessions/${liveSessionId}`,
  );
}

export type LiveSessionPollListItem = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  hostLabel: string | null;
  attendanceCount: number;
  pollCount: number;
  quizPollCount: number;
  totalResponses: number;
  avgParticipationPct: number | null;
  batchId: string | null;
  batchName: string | null;
  courseTitle: string | null;
};

export async function fetchLiveSessionsWithPolls(filters?: {
  q?: string;
  page?: number;
  limit?: number;
}) {
  return clientApi.get<{
    data: {
      items: LiveSessionPollListItem[];
      pageInfo: PageInfo;
    };
  }>(
    `/api/v1/reports/polls/live-sessions${buildQuery({
      q: filters?.q,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function closePollLive(pollId: string) {
  return clientApi.post<{ data: PollLiveMonitor }>(
    `/api/v1/reports/polls/${pollId}/live/close`,
    {},
    "poll-live-close",
    { successMessage: "Poll closed." },
  );
}

export async function extendPollLive(pollId: string, seconds = 30) {
  return clientApi.post<{ data: PollLiveMonitor }>(
    `/api/v1/reports/polls/${pollId}/live/extend`,
    { seconds },
    "poll-live-extend",
    { successMessage: `Poll extended by ${seconds}s.` },
  );
}

export async function fetchPollOptionDetail(pollId: string, optionId: string) {
  return clientApi.get<{ data: PollOptionDetail }>(
    `/api/v1/reports/polls/${pollId}/options/${optionId}`,
  );
}

export async function fetchPollNonRespondents(
  pollId: string,
  filters?: {
    q?: string;
    presence?: "any" | "present" | "absent";
    excludeAbsent?: boolean;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    page?: number;
    limit?: number;
  },
) {
  return clientApi.get<{
    data: {
      pollId: string;
      summary: PollNonRespondentsSummary;
      items: PollNonRespondentItem[];
      pageInfo: PageInfo;
    };
  }>(
    `/api/v1/reports/polls/${pollId}/non-respondents${buildQuery({
      q: filters?.q,
      presence: filters?.presence,
      excludeAbsent: filters?.excludeAbsent ? "true" : undefined,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function fetchPollRespondents(
  pollId: string,
  filters: {
    learnerName?: string;
    optionId?: string;
    isCorrect?: "any" | "correct" | "incorrect";
    respondedFrom?: string;
    respondedTo?: string;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    columns?: PollRespondentColumnKey[];
    page?: number;
  },
) {
  return clientApi.get<{
    data: {
      pollId: string;
      pollTitle: string;
      anonymousVote: boolean;
      respondentsHidden: boolean;
      items: PollRespondentItem[];
      pageInfo: PageInfo;
      columns: string[];
    };
  }>(
    `/api/v1/reports/polls/${pollId}/respondents${buildQuery({
      learnerName: filters.learnerName,
      optionId: filters.optionId,
      isCorrect: filters.isCorrect,
      respondedFrom: filters.respondedFrom,
      respondedTo: filters.respondedTo,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      columns: filters.columns?.join(","),
      page: filters.page ?? 1,
      limit: 25,
    })}`,
  );
}

export async function exportPollReport(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/polls/export",
    body,
    "polls-roster-export",
    { successMessage: "Polls export queued." },
  );
}

export type PollCompareAlignBy = "label" | "order";

export type PollCompareOptionCell = {
  pollId: string;
  optionId: string | null;
  label: string | null;
  count: number | null;
  percent: number | null;
  isCorrect: boolean | null;
  deltaPctVsLeft: number | null;
};

export type PollCompareOptionRow = {
  key: string;
  label: string;
  cells: PollCompareOptionCell[];
};

export type PollCompareItem = {
  id: string;
  title: string;
  shortName: string;
  quizMode: boolean;
  anonymousVote: boolean;
  liveSessionId: string | null;
  liveSessionTitle: string | null;
  createdAt: string;
  openedAt: string;
  closedAt: string | null;
  responseCount: number;
  eligibleCount: number | null;
  participationPct: number | null;
  medianResponseSeconds: number | null;
  correctPct: number | null;
  earlySharePct: number | null;
  nonRespondentCount: number | null;
  options: PollOptionBreakdown[];
};

export type PollsCompareData = {
  alignBy: PollCompareAlignBy;
  optionsAligned: boolean;
  polls: PollCompareItem[];
  optionRows: PollCompareOptionRow[];
  trendInsight: string | null;
};

export async function fetchPollsCompare(
  pollIds: string[],
  alignBy: PollCompareAlignBy = "label",
) {
  const params = new URLSearchParams();
  params.set("pollIds", pollIds.join(","));
  params.set("alignBy", alignBy);
  return clientApi.get<{ data: PollsCompareData }>(
    `/api/v1/reports/polls/compare?${params.toString()}`,
  );
}
