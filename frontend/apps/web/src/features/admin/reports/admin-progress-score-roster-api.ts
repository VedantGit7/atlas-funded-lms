"use client";

import { clientApi } from "../../../lib/client-api";

export const PROGRESS_LEARNER_COLUMN_OPTIONS = [
  { key: "learner_name", label: "Learner" },
  { key: "email", label: "Email" },
  { key: "completion_pct", label: "Completion %" },
  { key: "completed_lessons", label: "Completed" },
  { key: "total_lessons", label: "Total" },
  { key: "enrolled_type", label: "Enrollment type" },
  { key: "status", label: "Status" },
  { key: "enrolled_at", label: "Enrolled on" },
  { key: "expires_at", label: "Expiry date" },
] as const;

export type ProgressLearnerColumnKey = (typeof PROGRESS_LEARNER_COLUMN_OPTIONS)[number]["key"];

export const SCORE_LEARNER_COLUMN_OPTIONS = [
  { key: "learner_name", label: "Learner" },
  { key: "email", label: "Email" },
  { key: "result_status", label: "Result" },
  { key: "attempt_count", label: "Attempts" },
  { key: "score_pct", label: "Score" },
  { key: "answered_count", label: "Answered" },
  { key: "submitted_at", label: "Submitted on" },
] as const;

export type ScoreLearnerColumnKey = (typeof SCORE_LEARNER_COLUMN_OPTIONS)[number]["key"];

export type ProgressProductType =
  | "course"
  | "test_series"
  | "bundle"
  | "subscription"
  | "mock_test";
export type ScoreProductType = "course" | "test_series" | "bundle" | "mock_test";

export type ProductPublishStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
export type ProgressProductSortBy = "title" | "enrolled_count" | "avg_completion" | "last_activity";

export type ScoreProductSortBy =
  | "title"
  | "attempts"
  | "avg_score"
  | "pass_rate"
  | "last_attempt"
  | "ungraded";

export type ScorePassRateBand = "below_50" | "mid_50_75" | "above_75";

export type ProgressCompletionBands = {
  not_started: number;
  early: number;
  in_progress: number;
  nearly_done: number;
  complete: number;
};

export type ProgressProductItem = {
  id: string;
  title: string;
  slug: string;
  status: ProductPublishStatus;
  enrolledCount: number;
  quizCount: number;
  assessmentId?: string | null | undefined;
  avgCompletionPct: number | null;
  completionBands: ProgressCompletionBands;
  notStartedCount: number;
  lastActivityAt: string | null;
};

export type ScoreProductItem = {
  id: string;
  title: string;
  slug: string;
  status: ProductPublishStatus;
  productType: ScoreProductType;
  assessmentCount: number;
  learnersAttempted: number;
  attemptCount: number;
  avgScorePct: number | null;
  passMarkPct: number | null;
  passRatePct: number | null;
  ungradedCount: number;
  lastAttemptAt: string | null;
};

/** @deprecated Use ProgressProductItem */
export type ProgressCourseItem = ProgressProductItem;

export type ProgressProductsSummary = {
  productCount: number;
  enrolmentCount: number;
};

export type ScoreProductsSummary = {
  productCount: number;
  assessmentCount: number;
  attemptCount: number;
};

export type ProgressLearnerActivityStatus = "active" | "stalled" | "not_started";
export type ProgressLearnerView = "all" | "stalled" | "not_started" | "nearly_done" | "completed";
export type ProgressCompletionBandKey =
  | "not_started"
  | "early"
  | "in_progress"
  | "nearly_done"
  | "complete";

export type ProgressLearnerItem = {
  enrollmentId: string;
  membershipId: string;
  productId: string;
  productType?: ProgressProductType | undefined;
  courseId: string;
  learnerName: string | null;
  email: string | null;
  completionPct: number;
  completedLessons: number;
  totalLessons: number;
  enrolledType: string;
  status: string;
  activityStatus: ProgressLearnerActivityStatus;
  lastLessonTitle: string | null;
  lastActivityAt: string | null;
  enrolledAt: string;
  expiresAt: string | null;
};

export type ProgressLearnerRosterProduct = {
  id: string;
  title: string;
  slug: string;
  productType: ProgressProductType;
  status: ProductPublishStatus;
  lessonCount: number;
  assessmentCount: number;
  enrolledCount: number;
};

export type ProgressLearnerRosterSummary = {
  avgCompletionPct: number | null;
  completedCount: number;
  stalledCount: number;
  notStartedCount: number;
  expiringWithin30dCount: number;
};

export type ProgressCurriculumLesson = {
  lessonId: string;
  title: string;
  position: number;
  completionPct: number;
  completedCount: number;
};

export type ProgressCurriculumStrip = {
  lessons: ProgressCurriculumLesson[];
  steepestDropOff: {
    lessonId: string;
    title: string;
    completionPct: number;
    dropPct: number;
  } | null;
};

export type ScoreQuizItem = {
  assessmentId: string;
  title: string;
  assessmentType: string;
  lessonId: string | null;
  lessonTitle: string | null;
  questionCount: number | null;
  passMarkPct: number | null;
  attemptCount: number;
  learnerCount: number;
  avgScorePct: number | null;
  passRatePct: number | null;
  ungradedCount: number;
  lastAttemptAt: string | null;
  scoreSpread: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
  } | null;
};

export type ScoreQuizzesProduct = {
  productType: ScoreProductType;
  productId: string;
  title: string;
  slug: string | null;
  status: ProductPublishStatus | null;
};

export type ScoreQuizzesSummary = {
  assessmentCount: number;
  learnersAttempted: number;
  attemptCount: number;
  attemptsPerLearner: number | null;
  avgScorePct: number | null;
  passRatePct: number | null;
  ungradedCount: number;
  medianTimeLabel: string | null;
};

export type ScoreQuizSortBy =
  | "title"
  | "attempts"
  | "avg_score"
  | "pass_rate"
  | "last_attempt"
  | "ungraded";

export type ScoreLearnerView = "all" | "failed" | "ungraded" | "improved_on_retry";
export type ScoreAttemptsFilter = "any" | "first_only" | "more_than_one";
export type ScoreLearnerResultStatus = "pass" | "fail" | "pending" | "in_progress";

export type ScoreLearnerItem = {
  membershipId: string;
  assessmentId: string;
  learnerName: string | null;
  email: string | null;
  resultStatus: ScoreLearnerResultStatus;
  attemptCount: number;
  scorePct: number | null;
  bestScorePct: number | null;
  answeredCount: number;
  questionCount: number | null;
  durationSeconds: number | null;
  submittedAt: string | null;
  startedAt: string | null;
  latestAttemptId: string | null;
  improvedOnRetry: boolean;
};

export type ScoreLearnersAssessment = {
  assessmentId: string;
  title: string;
  assessmentType: string;
  passMarkPercent: number | null;
  questionCount: number;
  lessonId: string | null;
  lessonTitle: string | null;
  productType: ScoreProductType | null;
  productId: string | null;
  productTitle: string | null;
};

export type ScoreLearnersSummary = {
  learnerCount: number;
  passedCount: number;
  attemptCount: number;
  attemptsPerLearner: number | null;
  avgScorePct: number | null;
  passRatePct: number | null;
  ungradedCount: number;
  medianTimeLabel: string | null;
};

export type ScoreItemAnalysisOption = {
  optionId: string;
  label: string;
  sharePct: number;
  isCorrect: boolean;
};

export type ScoreItemAnalysisItem = {
  assessmentItemId: string;
  itemId: string;
  position: number;
  stem: string;
  itemTypeKey: string;
  correctRatePct: number | null;
  avgTimeLabel: string | null;
  discrimination: number | null;
  mostWrongOption: string | null;
  mostWrongSharePct: number | null;
  options: ScoreItemAnalysisOption[];
};

export type ScoreAttemptHistoryItem = {
  attemptId: string;
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  attemptNumber: number;
  scorePct: number | null;
  resultStatus: ScoreLearnerResultStatus;
  answeredCount: number;
  questionCount: number | null;
  startedAt: string | null;
  submittedAt: string | null;
  durationSeconds: number | null;
  flags: string[];
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

export async function fetchProgressProducts(
  productType: ProgressProductType,
  filters?: {
    q?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    status?: ProductPublishStatus | "" | undefined;
    sortBy?: ProgressProductSortBy | undefined;
    sortDir?: "asc" | "desc" | undefined;
  },
) {
  return clientApi.get<{
    data: {
      items: ProgressProductItem[];
      pageInfo: PageInfo;
      summary: ProgressProductsSummary;
    };
  }>(
    `/api/v1/reports/progress-score/progress/${productType}${buildQuery({
      q: filters?.q,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
      status: filters?.status || undefined,
      sortBy: filters?.sortBy ?? "enrolled_count",
      sortDir: filters?.sortDir ?? "desc",
    })}`,
  );
}

export async function fetchProgressCourses(filters?: {
  q?: string | undefined;
  page?: number | undefined;
}) {
  return fetchProgressProducts("course", filters);
}

export async function fetchProgressLearners(
  productType: ProgressProductType,
  productId: string,
  filters: {
    enrolledFrom?: string | undefined;
    enrolledTo?: string | undefined;
    learnerName?: string | undefined;
    enrolledType?: string | undefined;
    status?: string | undefined;
    view?: ProgressLearnerView | undefined;
    completionBand?: ProgressCompletionBandKey | "" | undefined;
    activityStatus?: ProgressLearnerActivityStatus | "" | undefined;
    sortBy?: string | undefined;
    sortDir?: "asc" | "desc" | undefined;
    columns?: ProgressLearnerColumnKey[] | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  },
) {
  return clientApi.get<{
    data: {
      productId: string;
      productTitle: string;
      productType?: ProgressProductType | undefined;
      courseId: string;
      courseTitle: string;
      product: ProgressLearnerRosterProduct;
      summary: ProgressLearnerRosterSummary;
      curriculum: ProgressCurriculumStrip;
      items: ProgressLearnerItem[];
      pageInfo: PageInfo;
      columns: string[];
    };
  }>(
    `/api/v1/reports/progress-score/progress/${productType}/${productId}/learners${buildQuery({
      enrolledFrom: filters.enrolledFrom,
      enrolledTo: filters.enrolledTo,
      learnerName: filters.learnerName,
      enrolledType: filters.enrolledType,
      status: filters.status,
      view: filters.view ?? "all",
      completionBand: filters.completionBand || undefined,
      activityStatus: filters.activityStatus || undefined,
      sortBy: filters.sortBy ?? "last_activity_at",
      sortDir: filters.sortDir ?? "desc",
      columns: filters.columns?.join(","),
      page: filters.page ?? 1,
      limit: filters.limit ?? 25,
    })}`,
  );
}

export async function fetchScoreProducts(
  productType: ScoreProductType,
  filters?: {
    q?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    status?: ProductPublishStatus | "" | undefined;
    passRateBand?: ScorePassRateBand | "" | undefined;
    hasUngraded?: boolean | undefined;
    sortBy?: ScoreProductSortBy | undefined;
    sortDir?: "asc" | "desc" | undefined;
  },
) {
  return clientApi.get<{
    data: {
      items: ScoreProductItem[];
      pageInfo: PageInfo;
      summary: ScoreProductsSummary;
    };
  }>(
    `/api/v1/reports/progress-score/scores/${productType}${buildQuery({
      q: filters?.q,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
      status: filters?.status || undefined,
      passRateBand: filters?.passRateBand || undefined,
      hasUngraded: filters?.hasUngraded === true ? "true" : undefined,
      sortBy: filters?.sortBy ?? "attempts",
      sortDir: filters?.sortDir ?? "desc",
    })}`,
  );
}

export async function fetchScoreCourses(filters?: {
  q?: string | undefined;
  page?: number | undefined;
}) {
  return fetchScoreProducts("course", filters);
}

export async function fetchScoreQuizzes(
  productType: ScoreProductType,
  productId: string,
  filters?: {
    q?: string | undefined;
    assessmentType?: string | undefined;
    lessonId?: string | undefined;
    passRateBand?: ScorePassRateBand | "" | undefined;
    hasUngraded?: boolean | undefined;
    sortBy?: ScoreQuizSortBy | undefined;
    sortDir?: "asc" | "desc" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  },
) {
  return clientApi.get<{
    data: {
      product: ScoreQuizzesProduct;
      courseId: string;
      courseTitle: string;
      summary: ScoreQuizzesSummary;
      items: ScoreQuizItem[];
      pageInfo: PageInfo;
    };
  }>(
    `/api/v1/reports/progress-score/scores/${productType}/${productId}/quizzes${buildQuery({
      q: filters?.q,
      assessmentType: filters?.assessmentType,
      lessonId: filters?.lessonId,
      passRateBand: filters?.passRateBand || undefined,
      hasUngraded: filters?.hasUngraded === true ? "true" : undefined,
      sortBy: filters?.sortBy ?? "title",
      sortDir: filters?.sortDir ?? "asc",
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function fetchScoreLearners(
  assessmentId: string,
  filters: {
    submittedFrom?: string | undefined;
    submittedTo?: string | undefined;
    learnerName?: string | undefined;
    resultStatus?: ScoreLearnerResultStatus | "" | undefined;
    minScore?: number | undefined;
    maxScore?: number | undefined;
    minAttempts?: number | undefined;
    attemptsFilter?: ScoreAttemptsFilter | undefined;
    view?: ScoreLearnerView | undefined;
    sortBy?: string | undefined;
    sortDir?: "asc" | "desc" | undefined;
    columns?: ScoreLearnerColumnKey[] | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  },
) {
  return clientApi.get<{
    data: {
      assessment: ScoreLearnersAssessment;
      assessmentId: string;
      assessmentTitle: string;
      courseId: string | null;
      courseTitle: string | null;
      passMarkPercent: number | null;
      summary: ScoreLearnersSummary;
      items: ScoreLearnerItem[];
      pageInfo: PageInfo;
      columns: string[];
    };
  }>(
    `/api/v1/reports/progress-score/scores/quizzes/${assessmentId}/learners${buildQuery({
      submittedFrom: filters.submittedFrom,
      submittedTo: filters.submittedTo,
      learnerName: filters.learnerName,
      resultStatus: filters.resultStatus || undefined,
      minScore: filters.minScore,
      maxScore: filters.maxScore,
      minAttempts: filters.minAttempts,
      attemptsFilter:
        filters.attemptsFilter && filters.attemptsFilter !== "any"
          ? filters.attemptsFilter
          : undefined,
      view: filters.view ?? "all",
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      columns: filters.columns?.join(","),
      page: filters.page ?? 1,
      limit: filters.limit ?? 25,
    })}`,
  );
}

export async function fetchScoreItemAnalysis(assessmentId: string) {
  return clientApi.get<{
    data: {
      assessmentId: string;
      belowFortyCount: number;
      items: ScoreItemAnalysisItem[];
    };
  }>(`/api/v1/reports/progress-score/scores/quizzes/${assessmentId}/item-analysis`);
}

export async function fetchScoreAttemptHistory(
  assessmentId: string,
  filters?: {
    resultStatus?: ScoreLearnerResultStatus | "" | undefined;
    submittedFrom?: string | undefined;
    submittedTo?: string | undefined;
    flag?: "tab_switched" | "after_time_limit" | "graded_manually" | "" | undefined;
    learnerName?: string | undefined;
    sortBy?: "submitted_at" | "started_at" | "score_pct" | "attempt_number" | undefined;
    sortDir?: "asc" | "desc" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  },
) {
  return clientApi.get<{
    data: {
      assessmentId: string;
      items: ScoreAttemptHistoryItem[];
      pageInfo: PageInfo;
    };
  }>(
    `/api/v1/reports/progress-score/scores/quizzes/${assessmentId}/attempts${buildQuery({
      resultStatus: filters?.resultStatus || undefined,
      submittedFrom: filters?.submittedFrom,
      submittedTo: filters?.submittedTo,
      flag: filters?.flag || undefined,
      learnerName: filters?.learnerName,
      sortBy: filters?.sortBy ?? "submitted_at",
      sortDir: filters?.sortDir ?? "desc",
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function regradeScoreAttempts(
  assessmentId: string,
  body: {
    scope: "selected" | "all";
    attemptIds?: string[] | undefined;
    membershipIds?: string[] | undefined;
    notifyLearners?: boolean | undefined;
  },
) {
  return clientApi.post<{
    data: {
      assessmentId: string;
      regradedCount: number;
      skippedCount: number;
      answerKeyVersion: string;
      notifiedCount: number;
    };
  }>(
    `/api/v1/reports/progress-score/scores/quizzes/${assessmentId}/regrade`,
    body,
    "progress-score-regrade",
    { successMessage: "Attempts regraded against the current answer key." },
  );
}

export type ScoreQuestionOutcome = "correct" | "incorrect" | "unanswered" | "needs_grading";

export type ScoreAttemptReviewData = {
  assessment: {
    assessmentId: string;
    title: string;
    assessmentType: string;
    passMarkPercent: number | null;
    timeLimitSeconds: number | null;
    attemptsAllowed: number;
    productType: ScoreProductType | null;
    productId: string | null;
    productTitle: string | null;
    courseId: string | null;
    courseTitle: string | null;
  };
  learner: {
    membershipId: string;
    learnerName: string | null;
    email: string | null;
  };
  attempt: {
    attemptId: string;
    attemptNumber: number;
    ofAllowed: number;
    status: string;
    resultStatus: "pass" | "fail" | "pending" | "in_progress" | "voided";
    scorePct: number | null;
    startedAt: string | null;
    submittedAt: string | null;
    durationSeconds: number | null;
    shortId: string;
  };
  summary: {
    correctCount: number;
    answeredCount: number;
    unansweredCount: number;
    questionCount: number;
    timeLimitSeconds: number | null;
    pointsShortfall: number | null;
    needsGradingCount: number;
  };
  questions: Array<{
    assessmentItemId: string;
    itemId: string;
    position: number;
    stem: string;
    itemTypeKey: string;
    pointsMax: number;
    pointsAwarded: number | null;
    outcome: ScoreQuestionOutcome;
    durationSeconds: number | null;
    cohortCorrectRatePct: number | null;
    options: Array<{
      optionId: string;
      label: string;
      isCorrect: boolean;
      selectedByLearner: boolean;
    }>;
    learnerAnswerText: string | null;
    selectedOptionIds: string[];
    correctOptionIds: string[];
    feedback: string | null;
    isManual: boolean;
  }>;
  history: Array<{
    attemptId: string | null;
    attemptNumber: number;
    scorePct: number | null;
    scoreDelta: number | null;
    resultStatus: "pass" | "fail" | "pending" | "in_progress" | "voided";
    submittedAt: string | null;
    isCurrent: boolean;
    isAvailableSlot: boolean;
  }>;
  integrity: Array<{
    key: string;
    label: string;
    severity: "clear" | "low" | "medium" | "high";
    recordedAt: string | null;
  }>;
  nav: {
    prevAttemptId: string | null;
    nextAttemptId: string | null;
  };
  grants: {
    extraAttemptsGranted: number;
    effectiveAttemptsAllowed: number;
  };
};

export async function fetchScoreAttemptReview(assessmentId: string, attemptId: string) {
  return clientApi.get<{ data: ScoreAttemptReviewData }>(
    `/api/v1/reports/progress-score/scores/quizzes/${assessmentId}/attempts/${attemptId}`,
  );
}

export async function saveAttemptGrading(
  assessmentId: string,
  attemptId: string,
  body: {
    items: Array<{
      assessmentItemId: string;
      pointsAwarded: number;
      feedback?: string | undefined;
    }>;
    notifyLearner?: boolean | undefined;
  },
) {
  return clientApi.post<{
    data: {
      attemptId: string;
      scorePct: number | null;
      resultStatus: string;
      gradedItemCount: number;
      notified: boolean;
    };
  }>(
    `/api/v1/reports/progress-score/scores/quizzes/${assessmentId}/attempts/${attemptId}/grade`,
    body,
    "progress-score-attempt-grade",
    { successMessage: "Grading saved." },
  );
}

export async function voidScoreAttempt(
  assessmentId: string,
  attemptId: string,
  body: { reason: string },
) {
  return clientApi.post<{ data: { attemptId: string; status: "VOIDED" } }>(
    `/api/v1/reports/progress-score/scores/quizzes/${assessmentId}/attempts/${attemptId}/void`,
    body,
    "progress-score-attempt-void",
    { successMessage: "Attempt voided." },
  );
}

export async function resetScoreAttempt(
  assessmentId: string,
  attemptId: string,
  body?: { reason?: string | undefined },
) {
  return clientApi.post<{ data: { attemptId: string; status: "VOIDED" } }>(
    `/api/v1/reports/progress-score/scores/quizzes/${assessmentId}/attempts/${attemptId}/reset`,
    body ?? {},
    "progress-score-attempt-reset",
    { successMessage: "Attempt reset." },
  );
}

export async function grantExtraScoreAttempt(
  assessmentId: string,
  attemptId: string,
  body?: { count?: number | undefined; reason?: string | undefined },
) {
  return clientApi.post<{
    data: {
      assessmentId: string;
      membershipId: string;
      extraAttemptsGranted: number;
      effectiveAttemptsAllowed: number;
    };
  }>(
    `/api/v1/reports/progress-score/scores/quizzes/${assessmentId}/attempts/${attemptId}/grant-extra-attempt`,
    body ?? { count: 1 },
    "progress-score-grant-extra",
    { successMessage: "Extra attempt granted." },
  );
}

export async function createProgressGroup(body: Record<string, unknown>) {
  return clientApi.post<{
    data: { batchId: string; key: string; name: string; memberCount: number };
  }>("/api/v1/reports/progress-score/progress/groups", body, "progress-score-progress-group", {
    successMessage: "Group created from progress report.",
  });
}

export async function sendProgressMessage(body: Record<string, unknown>) {
  return clientApi.post<{
    data: {
      campaignId: string;
      deliveredCount: number;
      skippedCount: number;
      failedCount: number;
      recipientCount: number;
    };
  }>("/api/v1/reports/progress-score/progress/messages", body, "progress-score-progress-message", {
    successMessage: "Message queued for matched learners.",
  });
}

export async function exportProgressReport(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/progress-score/progress/export",
    body,
    "progress-score-progress-export",
    { successMessage: "Progress export queued." },
  );
}

export async function createScoreGroup(body: Record<string, unknown>) {
  return clientApi.post<{
    data: { batchId: string; key: string; name: string; memberCount: number };
  }>("/api/v1/reports/progress-score/scores/groups", body, "progress-score-scores-group", {
    successMessage: "Group created from scores report.",
  });
}

export async function sendScoreMessage(body: Record<string, unknown>) {
  return clientApi.post<{
    data: {
      campaignId: string;
      deliveredCount: number;
      skippedCount: number;
      failedCount: number;
      recipientCount: number;
    };
  }>("/api/v1/reports/progress-score/scores/messages", body, "progress-score-scores-message", {
    successMessage: "Message queued for matched learners.",
  });
}

/* ── Cohorts ledger ──────────────────────────────────────────────────── */

export type CohortGroupItem = {
  batchId: string;
  key: string;
  name: string;
  description: string | null;
  sourceKind: "progress" | "scores";
  productType: string | null;
  productId: string | null;
  productTitle: string | null;
  assessmentId: string | null;
  assessmentTitle: string | null;
  criteriaSummary: string | null;
  memberCount: number;
  syncType: "static" | "live";
  createdAt: string;
  createdByLabel: string | null;
};

export type CohortMessageItem = {
  campaignId: string;
  subject: string;
  audienceCaption: string | null;
  sourceKind: "progress" | "scores";
  productTitle: string | null;
  assessmentTitle: string | null;
  deliveredCount: number;
  skippedCount: number;
  failedCount: number;
  openedCount: number | null;
  recipientCount: number;
  status: "sent" | "partially_failed" | "failed";
  sentByLabel: string | null;
  sentAt: string;
  reportHref: string | null;
};

export async function fetchCohortGroups(filters?: {
  q?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{
    data: { items: CohortGroupItem[]; pageInfo: PageInfo };
  }>(
    `/api/v1/reports/progress-score/cohorts/groups${buildQuery({
      q: filters?.q,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function fetchCohortMessages(filters?: {
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{
    data: { items: CohortMessageItem[]; pageInfo: PageInfo };
  }>(
    `/api/v1/reports/progress-score/cohorts/messages${buildQuery({
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function retryCohortMessage(campaignId: string) {
  return clientApi.post<{
    data: {
      campaignId: string;
      deliveredCount: number;
      skippedCount: number;
      failedCount: number;
      recipientCount: number;
    };
  }>(
    `/api/v1/reports/progress-score/cohorts/messages/${campaignId}/retry`,
    {},
    "progress-score-cohort-retry",
    { successMessage: "Retry queued for failed deliveries." },
  );
}

export async function exportScoreReport(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/progress-score/scores/export",
    body,
    "progress-score-scores-export",
    { successMessage: "Scores export queued." },
  );
}

/* ── Individual learner progress detail ─────────────────────────────── */

export type ProgressLearnerLessonStatus = "completed" | "in_progress" | "not_started";
export type ProgressLearnerLessonType = "video" | "quiz" | "reading" | "interactive" | "other";

export type ProgressLearnerDetail = {
  product: {
    productType: ProgressProductType;
    productId: string;
    title: string;
  };
  learner: {
    enrollmentId: string;
    membershipId: string;
    displayName: string;
    email: string | null;
    avatarUrl: string | null;
    paymentStatus: "paid" | "comped" | "trial" | "unknown";
    accessStatus: "active" | "expired" | "revoked" | "pending";
    expiresAt: string | null;
  };
  summary: {
    completionPct: number;
    completedLessons: number;
    totalLessons: number;
    timeOnContentLabel: string | null;
    lastActiveAt: string | null;
    assessmentsPassed: number;
    assessmentsTotal: number;
  };
  modules: Array<{
    moduleId: string;
    title: string;
    position: number;
    completedLessons: number;
    totalLessons: number;
    lessons: Array<{
      lessonId: string;
      title: string;
      lessonType: ProgressLearnerLessonType;
      position: number;
      status: ProgressLearnerLessonStatus;
      progressPct: number;
      durationLabel: string | null;
      completedAt: string | null;
      lastSeenAt: string | null;
      outOfOrder: boolean;
      quizScorePct: number | null;
      quizAttemptId: string | null;
    }>;
  }>;
  activity: {
    days: Array<{ date: string; count: number; level: number }>;
    longestGapDays: number | null;
    longestGapLabel: string | null;
  };
  assessments: Array<{
    assessmentId: string;
    title: string;
    scorePct: number | null;
    resultStatus: "pass" | "fail" | "pending" | "in_progress";
    attemptNumber: number | null;
    attemptId: string | null;
    submittedAt: string | null;
  }>;
  enrolment: {
    enrollmentId: string;
    enrolledType: string;
    sourceLabel: string | null;
    grantedByLabel: string | null;
    enrolledAt: string;
    certificateIssued: boolean;
    certificateLabel: string | null;
  };
  capabilities: {
    canResetProgress: boolean;
    canExtendAccess: boolean;
    canMessage: boolean;
    curriculumAvailable: boolean;
  };
};

export async function fetchProgressLearnerDetail(
  productType: ProgressProductType,
  productId: string,
  enrollmentId: string,
) {
  return clientApi.get<{ data: ProgressLearnerDetail }>(
    `/api/v1/reports/progress-score/progress/${productType}/${productId}/learners/${enrollmentId}`,
  );
}

export async function resetProgressLearner(
  productType: ProgressProductType,
  productId: string,
  enrollmentId: string,
  body: { clearAssessmentAttempts: boolean; reason: string },
) {
  return clientApi.post<{
    data: { enrollmentId: string; lessonsCleared: number; attemptsCleared: number };
  }>(
    `/api/v1/reports/progress-score/progress/${productType}/${productId}/learners/${enrollmentId}/reset`,
    body,
    `progress-learner-reset-${enrollmentId}`,
    { successMessage: "Progress reset." },
  );
}

export async function extendProgressLearnerAccess(
  productType: ProgressProductType,
  productId: string,
  enrollmentId: string,
  body: { expiresAt: string; reason?: string | undefined },
) {
  return clientApi.post<{
    data: { enrollmentId: string; expiresAt: string | null };
  }>(
    `/api/v1/reports/progress-score/progress/${productType}/${productId}/learners/${enrollmentId}/extend`,
    body,
    `progress-learner-extend-${enrollmentId}`,
    { successMessage: "Access extended." },
  );
}
