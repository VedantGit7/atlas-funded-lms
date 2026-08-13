import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const PROGRESS_PRODUCT_TYPES = ["course", "test_series", "bundle", "subscription"] as const;

export type ProgressProductType = (typeof PROGRESS_PRODUCT_TYPES)[number];

export const SCORE_PRODUCT_TYPES = ["course", "test_series", "bundle", "mock_test"] as const;

export type ScoreProductType = (typeof SCORE_PRODUCT_TYPES)[number];

export const ENROLLMENT_TYPES = [
  "free",
  "paid",
  "complimentary",
  "manual",
  "offline",
  "trial",
] as const;

export const PROGRESS_LEARNER_COLUMNS = [
  "learner_name",
  "email",
  "completion_pct",
  "completed_lessons",
  "total_lessons",
  "enrolled_type",
  "status",
  "enrolled_at",
  "expires_at",
] as const;

export type ProgressLearnerColumn = (typeof PROGRESS_LEARNER_COLUMNS)[number];

export const SCORE_LEARNER_COLUMNS = [
  "learner_name",
  "email",
  "result_status",
  "attempt_count",
  "score_pct",
  "answered_count",
  "submitted_at",
] as const;

export type ScoreLearnerColumn = (typeof SCORE_LEARNER_COLUMNS)[number];

function parseColumns(allowed: readonly string[], value: unknown): string[] {
  const allowedSet = new Set<string>(allowed);
  if (Array.isArray(value)) {
    const selected = value.filter(
      (column): column is string => typeof column === "string" && allowedSet.has(column),
    );
    return selected.length > 0 ? selected : [...allowed];
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return [...allowed];
  }
  const selected = value
    .split(",")
    .map((part) => part.trim())
    .filter((column) => allowedSet.has(column));
  return selected.length > 0 ? selected : [...allowed];
}

const pageInfoSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const PRODUCT_PUBLISH_STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;

export type ProductPublishStatus = (typeof PRODUCT_PUBLISH_STATUSES)[number];

export const PROGRESS_PRODUCT_SORT_BY = [
  "title",
  "enrolled_count",
  "avg_completion",
  "last_activity",
] as const;

export type ProgressProductSortBy = (typeof PROGRESS_PRODUCT_SORT_BY)[number];

export const progressCoursesQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ProgressCoursesQuery = z.output<typeof progressCoursesQuerySchema>;

export const progressProductsQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(PRODUCT_PUBLISH_STATUSES).optional(),
    sortBy: z.enum(PROGRESS_PRODUCT_SORT_BY).default("enrolled_count"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ProgressProductsQuery = z.output<typeof progressProductsQuerySchema>;

export const SCORE_PRODUCT_SORT_BY = [
  "title",
  "attempts",
  "avg_score",
  "pass_rate",
  "last_attempt",
  "ungraded",
] as const;

export type ScoreProductSortBy = (typeof SCORE_PRODUCT_SORT_BY)[number];

export const SCORE_PASS_RATE_BANDS = ["below_50", "mid_50_75", "above_75"] as const;

export type ScorePassRateBand = (typeof SCORE_PASS_RATE_BANDS)[number];

export const scoreProductsQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(PRODUCT_PUBLISH_STATUSES).optional(),
    passRateBand: z.enum(SCORE_PASS_RATE_BANDS).optional(),
    hasUngraded: z
      .union([z.literal("true"), z.literal("false"), z.boolean()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (typeof value === "boolean") return value;
        return value === "true";
      }),
    sortBy: z.enum(SCORE_PRODUCT_SORT_BY).default("attempts"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ScoreProductsQuery = z.output<typeof scoreProductsQuerySchema>;

export const scoreProductItemSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    slug: z.string(),
    status: z.enum(PRODUCT_PUBLISH_STATUSES),
    productType: z.enum(SCORE_PRODUCT_TYPES),
    assessmentCount: z.number().int().nonnegative(),
    learnersAttempted: z.number().int().nonnegative(),
    attemptCount: z.number().int().nonnegative(),
    avgScorePct: z.number().min(0).max(100).nullable(),
    passMarkPct: z.number().min(0).max(100).nullable(),
    passRatePct: z.number().min(0).max(100).nullable(),
    ungradedCount: z.number().int().nonnegative(),
    lastAttemptAt: z.iso.datetime().nullable(),
  })
  .strict();

export const scoreProductsSummarySchema = z
  .object({
    productCount: z.number().int().nonnegative(),
    assessmentCount: z.number().int().nonnegative(),
    attemptCount: z.number().int().nonnegative(),
  })
  .strict();

export const scoreProductsListResponseSchema = z.object({
  data: z.object({
    items: z.array(scoreProductItemSchema),
    pageInfo: pageInfoSchema,
    summary: scoreProductsSummarySchema,
  }),
});

export const progressCompletionBandsSchema = z
  .object({
    not_started: z.number().int().nonnegative(),
    early: z.number().int().nonnegative(),
    in_progress: z.number().int().nonnegative(),
    nearly_done: z.number().int().nonnegative(),
    complete: z.number().int().nonnegative(),
  })
  .strict();

export const progressCourseItemSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    slug: z.string(),
    enrolledCount: z.number().int().nonnegative(),
    quizCount: z.number().int().nonnegative(),
  })
  .strict();

export const progressProductItemSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    slug: z.string(),
    status: z.enum(PRODUCT_PUBLISH_STATUSES),
    enrolledCount: z.number().int().nonnegative(),
    quizCount: z.number().int().nonnegative(),
    assessmentId: z.uuid().nullable().optional(),
    avgCompletionPct: z.number().min(0).max(100).nullable(),
    completionBands: progressCompletionBandsSchema,
    notStartedCount: z.number().int().nonnegative(),
    lastActivityAt: z.iso.datetime().nullable(),
  })
  .strict();

export const progressProductsSummarySchema = z
  .object({
    productCount: z.number().int().nonnegative(),
    enrolmentCount: z.number().int().nonnegative(),
  })
  .strict();

export const progressCoursesListResponseSchema = z.object({
  data: z.object({
    items: z.array(progressCourseItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const progressProductsListResponseSchema = z.object({
  data: z.object({
    items: z.array(progressProductItemSchema),
    pageInfo: pageInfoSchema,
    summary: progressProductsSummarySchema,
  }),
});

export const courseIdParamsSchema = z
  .object({
    courseId: z.uuid(),
  })
  .strict();

export const productIdParamsSchema = z
  .object({
    productId: z.uuid(),
  })
  .strict();

export const progressProductTypeParamsSchema = z
  .object({
    productType: z.enum(PROGRESS_PRODUCT_TYPES),
  })
  .strict();

export const progressProductLearnersParamsSchema = z
  .object({
    productType: z.enum(PROGRESS_PRODUCT_TYPES),
    productId: z.uuid(),
  })
  .strict();

export const scoreProductTypeParamsSchema = z
  .object({
    productType: z.enum(SCORE_PRODUCT_TYPES),
  })
  .strict();

export const scoreProductQuizzesParamsSchema = z
  .object({
    productType: z.enum(SCORE_PRODUCT_TYPES),
    productId: z.uuid(),
  })
  .strict();

export const PROGRESS_LEARNER_ACTIVITY_STATUSES = ["active", "stalled", "not_started"] as const;

export type ProgressLearnerActivityStatus = (typeof PROGRESS_LEARNER_ACTIVITY_STATUSES)[number];

export const PROGRESS_LEARNER_VIEWS = [
  "all",
  "stalled",
  "not_started",
  "nearly_done",
  "completed",
] as const;

export type ProgressLearnerView = (typeof PROGRESS_LEARNER_VIEWS)[number];

export const PROGRESS_COMPLETION_BANDS = [
  "not_started",
  "early",
  "in_progress",
  "nearly_done",
  "complete",
] as const;

export type ProgressCompletionBandKey = (typeof PROGRESS_COMPLETION_BANDS)[number];

export const progressLearnersQuerySchema = rejectClientTenantFields
  .extend({
    enrolledFrom: z.iso.datetime().optional(),
    enrolledTo: z.iso.datetime().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    enrolledType: z.enum(ENROLLMENT_TYPES).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    view: z.enum(PROGRESS_LEARNER_VIEWS).default("all"),
    completionBand: z.enum(PROGRESS_COMPLETION_BANDS).optional(),
    activityStatus: z.enum(PROGRESS_LEARNER_ACTIVITY_STATUSES).optional(),
    sortBy: z
      .enum(["enrolled_at", "expires_at", "completion_pct", "learner_name", "last_activity_at"])
      .default("last_activity_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(
      (value) => parseColumns(PROGRESS_LEARNER_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ProgressLearnersQuery = z.output<typeof progressLearnersQuerySchema>;

export const progressLearnerItemSchema = z
  .object({
    enrollmentId: z.uuid(),
    membershipId: z.uuid(),
    productId: z.uuid(),
    productType: z.enum(PROGRESS_PRODUCT_TYPES).optional(),
    courseId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    completionPct: z.number().int().min(0).max(100),
    completedLessons: z.number().int().nonnegative(),
    totalLessons: z.number().int().nonnegative(),
    enrolledType: z.string(),
    status: z.string(),
    activityStatus: z.enum(PROGRESS_LEARNER_ACTIVITY_STATUSES),
    lastLessonTitle: z.string().nullable(),
    lastActivityAt: z.iso.datetime().nullable(),
    enrolledAt: z.iso.datetime(),
    expiresAt: z.iso.datetime().nullable(),
  })
  .strict();

export const progressLearnerRosterProductSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    slug: z.string(),
    productType: z.enum(PROGRESS_PRODUCT_TYPES),
    status: z.enum(PRODUCT_PUBLISH_STATUSES),
    lessonCount: z.number().int().nonnegative(),
    assessmentCount: z.number().int().nonnegative(),
    enrolledCount: z.number().int().nonnegative(),
  })
  .strict();

export const progressLearnerRosterSummarySchema = z
  .object({
    avgCompletionPct: z.number().min(0).max(100).nullable(),
    completedCount: z.number().int().nonnegative(),
    stalledCount: z.number().int().nonnegative(),
    notStartedCount: z.number().int().nonnegative(),
    expiringWithin30dCount: z.number().int().nonnegative(),
  })
  .strict();

export const progressCurriculumLessonSchema = z
  .object({
    lessonId: z.uuid(),
    title: z.string(),
    position: z.number().int().nonnegative(),
    completionPct: z.number().int().min(0).max(100),
    completedCount: z.number().int().nonnegative(),
  })
  .strict();

export const progressCurriculumStripSchema = z
  .object({
    lessons: z.array(progressCurriculumLessonSchema),
    steepestDropOff: z
      .object({
        lessonId: z.uuid(),
        title: z.string(),
        completionPct: z.number().int().min(0).max(100),
        dropPct: z.number().int(),
      })
      .nullable(),
  })
  .strict();

export const progressLearnersListResponseSchema = z.object({
  data: z.object({
    productId: z.uuid(),
    productTitle: z.string(),
    productType: z.enum(PROGRESS_PRODUCT_TYPES).optional(),
    courseId: z.uuid(),
    courseTitle: z.string(),
    product: progressLearnerRosterProductSchema,
    summary: progressLearnerRosterSummarySchema,
    curriculum: progressCurriculumStripSchema,
    items: z.array(progressLearnerItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
  }),
});

export const scoreQuizzesQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    assessmentType: z.string().trim().min(1).max(64).optional(),
    lessonId: z.uuid().optional(),
    passRateBand: z.enum(SCORE_PASS_RATE_BANDS).optional(),
    hasUngraded: z
      .union([z.literal("true"), z.literal("false"), z.boolean()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (typeof value === "boolean") return value;
        return value === "true";
      }),
    sortBy: z
      .enum(["title", "attempts", "avg_score", "pass_rate", "last_attempt", "ungraded"])
      .default("title"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ScoreQuizzesQuery = z.output<typeof scoreQuizzesQuerySchema>;

export const scoreQuizItemSchema = z
  .object({
    assessmentId: z.uuid(),
    title: z.string(),
    assessmentType: z.string(),
    lessonId: z.uuid().nullable(),
    lessonTitle: z.string().nullable(),
    questionCount: z.number().int().nonnegative().nullable(),
    passMarkPct: z.number().min(0).max(100).nullable(),
    attemptCount: z.number().int().nonnegative(),
    learnerCount: z.number().int().nonnegative(),
    avgScorePct: z.number().min(0).max(100).nullable(),
    passRatePct: z.number().min(0).max(100).nullable(),
    ungradedCount: z.number().int().nonnegative(),
    lastAttemptAt: z.iso.datetime().nullable(),
    scoreSpread: z
      .object({
        min: z.number().min(0).max(100),
        q1: z.number().min(0).max(100),
        median: z.number().min(0).max(100),
        q3: z.number().min(0).max(100),
        max: z.number().min(0).max(100),
      })
      .nullable(),
  })
  .strict();

export const scoreQuizzesProductSchema = z
  .object({
    productType: z.enum(SCORE_PRODUCT_TYPES),
    productId: z.uuid(),
    title: z.string(),
    slug: z.string().nullable(),
    status: z.enum(PRODUCT_PUBLISH_STATUSES).nullable(),
  })
  .strict();

export const scoreQuizzesSummarySchema = z
  .object({
    assessmentCount: z.number().int().nonnegative(),
    learnersAttempted: z.number().int().nonnegative(),
    attemptCount: z.number().int().nonnegative(),
    attemptsPerLearner: z.number().nonnegative().nullable(),
    avgScorePct: z.number().min(0).max(100).nullable(),
    passRatePct: z.number().min(0).max(100).nullable(),
    ungradedCount: z.number().int().nonnegative(),
    medianTimeLabel: z.string().nullable(),
  })
  .strict();

export const scoreQuizzesListResponseSchema = z.object({
  data: z.object({
    product: scoreQuizzesProductSchema,
    courseId: z.uuid(),
    courseTitle: z.string(),
    summary: scoreQuizzesSummarySchema,
    items: z.array(scoreQuizItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const assessmentIdParamsSchema = z
  .object({
    assessmentId: z.uuid(),
  })
  .strict();

export const SCORE_LEARNER_VIEWS = ["all", "failed", "ungraded", "improved_on_retry"] as const;

export type ScoreLearnerView = (typeof SCORE_LEARNER_VIEWS)[number];

export const SCORE_ATTEMPTS_FILTERS = ["any", "first_only", "more_than_one"] as const;

export type ScoreAttemptsFilter = (typeof SCORE_ATTEMPTS_FILTERS)[number];

export const scoreLearnersQuerySchema = rejectClientTenantFields
  .extend({
    submittedFrom: z.iso.datetime().optional(),
    submittedTo: z.iso.datetime().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    resultStatus: z.enum(["pass", "fail", "pending", "in_progress"]).optional(),
    minScore: z.coerce.number().min(0).max(100).optional(),
    maxScore: z.coerce.number().min(0).max(100).optional(),
    minAttempts: z.coerce.number().int().min(0).max(1000).optional(),
    attemptsFilter: z.enum(SCORE_ATTEMPTS_FILTERS).optional(),
    view: z.enum(SCORE_LEARNER_VIEWS).default("all"),
    sortBy: z
      .enum(["submitted_at", "score_pct", "attempt_count", "learner_name"])
      .default("submitted_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(
      (value) => parseColumns(SCORE_LEARNER_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ScoreLearnersQuery = z.output<typeof scoreLearnersQuerySchema>;

export const scoreLearnerItemSchema = z
  .object({
    membershipId: z.uuid(),
    assessmentId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    resultStatus: z.enum(["pass", "fail", "pending", "in_progress"]),
    attemptCount: z.number().int().nonnegative(),
    scorePct: z.number().nullable(),
    bestScorePct: z.number().nullable(),
    answeredCount: z.number().int().nonnegative(),
    questionCount: z.number().int().nonnegative().nullable(),
    durationSeconds: z.number().nonnegative().nullable(),
    submittedAt: z.iso.datetime().nullable(),
    startedAt: z.iso.datetime().nullable(),
    latestAttemptId: z.uuid().nullable(),
    improvedOnRetry: z.boolean(),
  })
  .strict();

export const scoreLearnersAssessmentSchema = z
  .object({
    assessmentId: z.uuid(),
    title: z.string(),
    assessmentType: z.string(),
    passMarkPercent: z.number().nullable(),
    questionCount: z.number().int().nonnegative(),
    lessonId: z.uuid().nullable(),
    lessonTitle: z.string().nullable(),
    productType: z.enum(SCORE_PRODUCT_TYPES).nullable(),
    productId: z.uuid().nullable(),
    productTitle: z.string().nullable(),
  })
  .strict();

export const scoreLearnersSummarySchema = z
  .object({
    learnerCount: z.number().int().nonnegative(),
    passedCount: z.number().int().nonnegative(),
    attemptCount: z.number().int().nonnegative(),
    attemptsPerLearner: z.number().nonnegative().nullable(),
    avgScorePct: z.number().min(0).max(100).nullable(),
    passRatePct: z.number().min(0).max(100).nullable(),
    ungradedCount: z.number().int().nonnegative(),
    medianTimeLabel: z.string().nullable(),
  })
  .strict();

export const scoreLearnersListResponseSchema = z.object({
  data: z.object({
    assessment: scoreLearnersAssessmentSchema,
    assessmentId: z.uuid(),
    assessmentTitle: z.string(),
    courseId: z.uuid().nullable(),
    courseTitle: z.string().nullable(),
    passMarkPercent: z.number().nullable(),
    summary: scoreLearnersSummarySchema,
    items: z.array(scoreLearnerItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
  }),
});

export const scoreItemAnalysisOptionSchema = z
  .object({
    optionId: z.string(),
    label: z.string(),
    sharePct: z.number().min(0).max(100),
    isCorrect: z.boolean(),
  })
  .strict();

export const scoreItemAnalysisItemSchema = z
  .object({
    assessmentItemId: z.uuid(),
    itemId: z.uuid(),
    position: z.number().int().nonnegative(),
    stem: z.string(),
    itemTypeKey: z.string(),
    correctRatePct: z.number().min(0).max(100).nullable(),
    avgTimeLabel: z.string().nullable(),
    discrimination: z.number().min(-1).max(1).nullable(),
    mostWrongOption: z.string().nullable(),
    mostWrongSharePct: z.number().min(0).max(100).nullable(),
    options: z.array(scoreItemAnalysisOptionSchema),
  })
  .strict();

export const scoreItemAnalysisResponseSchema = z.object({
  data: z.object({
    assessmentId: z.uuid(),
    belowFortyCount: z.number().int().nonnegative(),
    items: z.array(scoreItemAnalysisItemSchema),
  }),
});

export const scoreAttemptHistoryQuerySchema = rejectClientTenantFields
  .extend({
    resultStatus: z.enum(["pass", "fail", "pending", "in_progress"]).optional(),
    submittedFrom: z.iso.datetime().optional(),
    submittedTo: z.iso.datetime().optional(),
    flag: z.enum(["tab_switched", "after_time_limit", "graded_manually"]).optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    sortBy: z
      .enum(["submitted_at", "started_at", "score_pct", "attempt_number"])
      .default("submitted_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ScoreAttemptHistoryQuery = z.output<typeof scoreAttemptHistoryQuerySchema>;

export const scoreAttemptHistoryItemSchema = z
  .object({
    attemptId: z.uuid(),
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    attemptNumber: z.number().int().positive(),
    scorePct: z.number().nullable(),
    resultStatus: z.enum(["pass", "fail", "pending", "in_progress"]),
    answeredCount: z.number().int().nonnegative(),
    questionCount: z.number().int().nonnegative().nullable(),
    startedAt: z.iso.datetime().nullable(),
    submittedAt: z.iso.datetime().nullable(),
    durationSeconds: z.number().nonnegative().nullable(),
    flags: z.array(z.string()),
  })
  .strict();

export const scoreAttemptHistoryResponseSchema = z.object({
  data: z.object({
    assessmentId: z.uuid(),
    items: z.array(scoreAttemptHistoryItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const regradeScoreAttemptsBodySchema = rejectClientTenantFields
  .extend({
    scope: z.enum(["selected", "all"]),
    attemptIds: z.array(z.uuid()).max(2000).optional(),
    membershipIds: z.array(z.uuid()).max(2000).optional(),
    notifyLearners: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scope === "selected") {
      const hasAttempts = (value.attemptIds?.length ?? 0) > 0;
      const hasMembers = (value.membershipIds?.length ?? 0) > 0;
      if (!hasAttempts && !hasMembers) {
        ctx.addIssue({
          code: "custom",
          message: "attemptIds or membershipIds required when scope is selected",
          path: ["attemptIds"],
        });
      }
    }
  });

export type RegradeScoreAttemptsBody = z.output<typeof regradeScoreAttemptsBodySchema>;

export const regradeScoreAttemptsResponseSchema = z.object({
  data: z.object({
    assessmentId: z.uuid(),
    regradedCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    answerKeyVersion: z.string(),
    notifiedCount: z.number().int().nonnegative(),
  }),
});

export const scoreAttemptReviewParamsSchema = z
  .object({
    assessmentId: z.uuid(),
    attemptId: z.uuid(),
  })
  .strict();

export type ScoreAttemptReviewParams = z.output<typeof scoreAttemptReviewParamsSchema>;

export const SCORE_QUESTION_OUTCOMES = [
  "correct",
  "incorrect",
  "unanswered",
  "needs_grading",
] as const;

export type ScoreQuestionOutcome = (typeof SCORE_QUESTION_OUTCOMES)[number];

export const scoreAttemptReviewOptionSchema = z
  .object({
    optionId: z.uuid(),
    label: z.string(),
    isCorrect: z.boolean(),
    selectedByLearner: z.boolean(),
  })
  .strict();

export const scoreAttemptReviewQuestionSchema = z
  .object({
    assessmentItemId: z.uuid(),
    itemId: z.uuid(),
    position: z.number().int().nonnegative(),
    stem: z.string(),
    itemTypeKey: z.string(),
    pointsMax: z.number().nonnegative(),
    pointsAwarded: z.number().nullable(),
    outcome: z.enum(SCORE_QUESTION_OUTCOMES),
    durationSeconds: z.number().nonnegative().nullable(),
    cohortCorrectRatePct: z.number().min(0).max(100).nullable(),
    options: z.array(scoreAttemptReviewOptionSchema),
    learnerAnswerText: z.string().nullable(),
    selectedOptionIds: z.array(z.string()),
    correctOptionIds: z.array(z.string()),
    feedback: z.string().nullable(),
    isManual: z.boolean(),
  })
  .strict();

export const scoreAttemptReviewHistoryItemSchema = z
  .object({
    attemptId: z.uuid().nullable(),
    attemptNumber: z.number().int().positive(),
    scorePct: z.number().nullable(),
    scoreDelta: z.number().nullable(),
    resultStatus: z.enum(["pass", "fail", "pending", "in_progress", "voided"]),
    submittedAt: z.iso.datetime().nullable(),
    isCurrent: z.boolean(),
    isAvailableSlot: z.boolean(),
  })
  .strict();

export const scoreAttemptReviewIntegrityItemSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    severity: z.enum(["clear", "low", "medium", "high"]),
    recordedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const scoreAttemptReviewResponseSchema = z.object({
  data: z.object({
    assessment: z
      .object({
        assessmentId: z.uuid(),
        title: z.string(),
        assessmentType: z.string(),
        passMarkPercent: z.number().nullable(),
        timeLimitSeconds: z.number().int().nullable(),
        attemptsAllowed: z.number().int().positive(),
        productType: z.enum(SCORE_PRODUCT_TYPES).nullable(),
        productId: z.uuid().nullable(),
        productTitle: z.string().nullable(),
        courseId: z.uuid().nullable(),
        courseTitle: z.string().nullable(),
      })
      .strict(),
    learner: z
      .object({
        membershipId: z.uuid(),
        learnerName: z.string().nullable(),
        email: z.string().nullable(),
      })
      .strict(),
    attempt: z
      .object({
        attemptId: z.uuid(),
        attemptNumber: z.number().int().positive(),
        ofAllowed: z.number().int().positive(),
        status: z.string(),
        resultStatus: z.enum(["pass", "fail", "pending", "in_progress", "voided"]),
        scorePct: z.number().nullable(),
        startedAt: z.iso.datetime().nullable(),
        submittedAt: z.iso.datetime().nullable(),
        durationSeconds: z.number().nonnegative().nullable(),
        shortId: z.string(),
      })
      .strict(),
    summary: z
      .object({
        correctCount: z.number().int().nonnegative(),
        answeredCount: z.number().int().nonnegative(),
        unansweredCount: z.number().int().nonnegative(),
        questionCount: z.number().int().nonnegative(),
        timeLimitSeconds: z.number().int().nullable(),
        pointsShortfall: z.number().nullable(),
        needsGradingCount: z.number().int().nonnegative(),
      })
      .strict(),
    questions: z.array(scoreAttemptReviewQuestionSchema),
    history: z.array(scoreAttemptReviewHistoryItemSchema),
    integrity: z.array(scoreAttemptReviewIntegrityItemSchema),
    nav: z
      .object({
        prevAttemptId: z.uuid().nullable(),
        nextAttemptId: z.uuid().nullable(),
      })
      .strict(),
    grants: z
      .object({
        extraAttemptsGranted: z.number().int().nonnegative(),
        effectiveAttemptsAllowed: z.number().int().positive(),
      })
      .strict(),
  }),
});

export type ScoreAttemptReviewResponse = z.infer<typeof scoreAttemptReviewResponseSchema>;

export const saveAttemptGradingBodySchema = rejectClientTenantFields
  .extend({
    items: z
      .array(
        z
          .object({
            assessmentItemId: z.uuid(),
            pointsAwarded: z.number().min(0).max(10000),
            feedback: z.string().trim().max(5000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    notifyLearner: z.boolean().default(false),
  })
  .strict();

export type SaveAttemptGradingBody = z.output<typeof saveAttemptGradingBodySchema>;

export const saveAttemptGradingResponseSchema = z.object({
  data: z.object({
    attemptId: z.uuid(),
    scorePct: z.number().nullable(),
    resultStatus: z.enum(["pass", "fail", "pending", "in_progress", "voided"]),
    gradedItemCount: z.number().int().nonnegative(),
    notified: z.boolean(),
  }),
});

export const voidAttemptBodySchema = rejectClientTenantFields
  .extend({
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();

export type VoidAttemptBody = z.output<typeof voidAttemptBodySchema>;

export const voidAttemptResponseSchema = z.object({
  data: z.object({
    attemptId: z.uuid(),
    status: z.literal("VOIDED"),
  }),
});

export const resetAttemptBodySchema = rejectClientTenantFields
  .extend({
    reason: z.string().trim().max(2000).optional(),
  })
  .strict();

export type ResetAttemptBody = z.output<typeof resetAttemptBodySchema>;

export const resetAttemptResponseSchema = z.object({
  data: z.object({
    attemptId: z.uuid(),
    status: z.literal("VOIDED"),
  }),
});

export const grantExtraAttemptBodySchema = rejectClientTenantFields
  .extend({
    count: z.coerce.number().int().min(1).max(10).default(1),
    reason: z.string().trim().max(2000).optional(),
  })
  .strict();

export type GrantExtraAttemptBody = z.output<typeof grantExtraAttemptBodySchema>;

export const grantExtraAttemptResponseSchema = z.object({
  data: z.object({
    assessmentId: z.uuid(),
    membershipId: z.uuid(),
    extraAttemptsGranted: z.number().int().nonnegative(),
    effectiveAttemptsAllowed: z.number().int().positive(),
  }),
});

const progressAudienceFieldsSchema = rejectClientTenantFields
  .extend({
    productType: z.enum(PROGRESS_PRODUCT_TYPES).default("course"),
    productId: z.uuid().optional(),
    courseId: z.uuid().optional(),
    membershipIds: z.array(z.uuid()).min(1).max(2000).optional(),
    enrolledFrom: z.iso.datetime().optional(),
    enrolledTo: z.iso.datetime().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    enrolledType: z.enum(ENROLLMENT_TYPES).optional(),
    status: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

function refineProgressAudienceProduct(
  value: z.infer<typeof progressAudienceFieldsSchema>,
  ctx: z.RefinementCtx,
) {
  const resolvedProductId =
    value.productId ?? (value.productType === "course" ? value.courseId : undefined);
  if (!resolvedProductId) {
    ctx.addIssue({
      code: "custom",
      message: "productId or courseId is required",
      path: ["productId"],
    });
  }
}

export const progressAudienceBodySchema = progressAudienceFieldsSchema.superRefine(
  refineProgressAudienceProduct,
);

export const createProgressGroupBodySchema = progressAudienceFieldsSchema
  .extend({
    title: z.string().trim().min(1).max(256),
    description: z.string().trim().max(2000).optional(),
    alsoAddToBatchId: z.uuid().optional(),
  })
  .strict()
  .superRefine(refineProgressAudienceProduct);

export const createProgressGroupResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    key: z.string(),
    name: z.string(),
    memberCount: z.number().int().nonnegative(),
  }),
});

export const sendProgressMessageBodySchema = progressAudienceFieldsSchema
  .extend({
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(10000),
    excludeMessagedWithinDays: z.coerce.number().int().min(0).max(90).optional(),
    audienceCaption: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine(refineProgressAudienceProduct);

export const sendProgressMessageResponseSchema = z.object({
  data: z.object({
    campaignId: z.uuid(),
    deliveredCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    recipientCount: z.number().int().nonnegative(),
  }),
});

export const scoreAudienceBodySchema = rejectClientTenantFields
  .extend({
    assessmentId: z.uuid(),
    membershipIds: z.array(z.uuid()).min(1).max(2000).optional(),
    submittedFrom: z.iso.datetime().optional(),
    submittedTo: z.iso.datetime().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    resultStatus: z.enum(["pass", "fail", "pending", "in_progress"]).optional(),
    minScore: z.number().min(0).max(100).optional(),
    maxScore: z.number().min(0).max(100).optional(),
  })
  .strict();

export const createScoreGroupBodySchema = scoreAudienceBodySchema
  .extend({
    title: z.string().trim().min(1).max(256),
    description: z.string().trim().max(2000).optional(),
    alsoAddToBatchId: z.uuid().optional(),
  })
  .strict();

export const sendScoreMessageBodySchema = scoreAudienceBodySchema
  .extend({
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(10000),
    excludeMessagedWithinDays: z.coerce.number().int().min(0).max(90).optional(),
    audienceCaption: z.string().trim().max(500).optional(),
  })
  .strict();

export const exportProgressScoreBodySchema = rejectClientTenantFields
  .extend({
    tab: z.enum(["progress", "scores"]).default("progress"),
    productType: z
      .enum(["course", "test_series", "bundle", "subscription", "mock_test"])
      .optional(),
    productId: z.uuid().optional(),
    courseId: z.uuid().optional(),
    assessmentId: z.uuid().optional(),
    enrolledFrom: z.iso.datetime().optional(),
    enrolledTo: z.iso.datetime().optional(),
    submittedFrom: z.iso.datetime().optional(),
    submittedTo: z.iso.datetime().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    enrolledType: z.enum(ENROLLMENT_TYPES).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    resultStatus: z.enum(["pass", "fail", "pending", "in_progress"]).optional(),
    sortBy: z.string().trim().min(1).max(64).optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    columns: z.array(z.string().min(1)).min(1).max(30).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportProgressScoreResponseSchema = z.object({
  data: z.object({
    runId: z.uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});

/* ── Individual learner progress (drill-down) ─────────────────────────── */

export const progressLearnerDetailParamsSchema = z
  .object({
    productType: z.enum(PROGRESS_PRODUCT_TYPES),
    productId: z.uuid(),
    enrollmentId: z.uuid(),
  })
  .strict();

export const progressLearnerLessonStatusSchema = z.enum([
  "completed",
  "in_progress",
  "not_started",
]);

export const progressLearnerLessonTypeSchema = z.enum([
  "video",
  "quiz",
  "reading",
  "interactive",
  "other",
]);

export const progressLearnerLessonRowSchema = z.object({
  lessonId: z.uuid(),
  title: z.string(),
  lessonType: progressLearnerLessonTypeSchema,
  position: z.number().int().nonnegative(),
  status: progressLearnerLessonStatusSchema,
  progressPct: z.number().min(0).max(100),
  durationLabel: z.string().nullable(),
  completedAt: z.iso.datetime().nullable(),
  lastSeenAt: z.iso.datetime().nullable(),
  outOfOrder: z.boolean(),
  quizScorePct: z.number().min(0).max(100).nullable(),
  quizAttemptId: z.uuid().nullable(),
});

export const progressLearnerModuleSchema = z.object({
  moduleId: z.uuid(),
  title: z.string(),
  position: z.number().int().nonnegative(),
  completedLessons: z.number().int().nonnegative(),
  totalLessons: z.number().int().nonnegative(),
  lessons: z.array(progressLearnerLessonRowSchema),
});

export const progressLearnerActivityDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().nonnegative(),
  level: z.number().int().min(0).max(4),
});

export const progressLearnerAssessmentSchema = z.object({
  assessmentId: z.uuid(),
  title: z.string(),
  scorePct: z.number().min(0).max(100).nullable(),
  resultStatus: z.enum(["pass", "fail", "pending", "in_progress"]),
  attemptNumber: z.number().int().positive().nullable(),
  attemptId: z.uuid().nullable(),
  submittedAt: z.iso.datetime().nullable(),
});

export const progressLearnerDetailResponseSchema = z.object({
  data: z.object({
    product: z.object({
      productType: z.enum(PROGRESS_PRODUCT_TYPES),
      productId: z.uuid(),
      title: z.string(),
    }),
    learner: z.object({
      enrollmentId: z.uuid(),
      membershipId: z.uuid(),
      displayName: z.string(),
      email: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      paymentStatus: z.enum(["paid", "comped", "trial", "unknown"]),
      accessStatus: z.enum(["active", "expired", "revoked", "pending"]),
      expiresAt: z.iso.datetime().nullable(),
    }),
    summary: z.object({
      completionPct: z.number().min(0).max(100),
      completedLessons: z.number().int().nonnegative(),
      totalLessons: z.number().int().nonnegative(),
      timeOnContentLabel: z.string().nullable(),
      lastActiveAt: z.iso.datetime().nullable(),
      assessmentsPassed: z.number().int().nonnegative(),
      assessmentsTotal: z.number().int().nonnegative(),
    }),
    modules: z.array(progressLearnerModuleSchema),
    activity: z.object({
      days: z.array(progressLearnerActivityDaySchema),
      longestGapDays: z.number().int().nonnegative().nullable(),
      longestGapLabel: z.string().nullable(),
    }),
    assessments: z.array(progressLearnerAssessmentSchema),
    enrolment: z.object({
      enrollmentId: z.uuid(),
      enrolledType: z.string(),
      sourceLabel: z.string().nullable(),
      grantedByLabel: z.string().nullable(),
      enrolledAt: z.iso.datetime(),
      certificateIssued: z.boolean(),
      certificateLabel: z.string().nullable(),
    }),
    capabilities: z.object({
      canResetProgress: z.boolean(),
      canExtendAccess: z.boolean(),
      canMessage: z.boolean(),
      curriculumAvailable: z.boolean(),
    }),
  }),
});

export const resetProgressLearnerBodySchema = rejectClientTenantFields
  .extend({
    clearAssessmentAttempts: z.boolean().default(false),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();

export const resetProgressLearnerResponseSchema = z.object({
  data: z.object({
    enrollmentId: z.uuid(),
    lessonsCleared: z.number().int().nonnegative(),
    attemptsCleared: z.number().int().nonnegative(),
  }),
});

export const extendProgressLearnerBodySchema = rejectClientTenantFields
  .extend({
    expiresAt: z.iso.datetime(),
    reason: z.string().trim().max(2000).optional(),
  })
  .strict();

export const extendProgressLearnerResponseSchema = z.object({
  data: z.object({
    enrollmentId: z.uuid(),
    expiresAt: z.iso.datetime().nullable(),
  }),
});

export type ProgressLearnerDetailResponse = z.infer<typeof progressLearnerDetailResponseSchema>;
export type ResetProgressLearnerBody = z.infer<typeof resetProgressLearnerBodySchema>;
export type ExtendProgressLearnerBody = z.infer<typeof extendProgressLearnerBodySchema>;

/* ── Cohorts ledger (Screen 9) ─────────────────────────────────────────── */

export const cohortGroupsQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type CohortGroupsQuery = z.output<typeof cohortGroupsQuerySchema>;

export const cohortGroupItemSchema = z
  .object({
    batchId: z.uuid(),
    key: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    sourceKind: z.enum(["progress", "scores"]),
    productType: z.string().nullable(),
    productId: z.uuid().nullable(),
    productTitle: z.string().nullable(),
    assessmentId: z.uuid().nullable(),
    assessmentTitle: z.string().nullable(),
    criteriaSummary: z.string().nullable(),
    memberCount: z.number().int().nonnegative(),
    syncType: z.enum(["static", "live"]),
    createdAt: z.iso.datetime(),
    createdByLabel: z.string().nullable(),
  })
  .strict();

export const cohortGroupsResponseSchema = z.object({
  data: z.object({
    items: z.array(cohortGroupItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export type CohortGroupsResponse = z.infer<typeof cohortGroupsResponseSchema>;

export const cohortMessagesQuerySchema = rejectClientTenantFields
  .extend({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type CohortMessagesQuery = z.output<typeof cohortMessagesQuerySchema>;

export const cohortMessageItemSchema = z
  .object({
    campaignId: z.uuid(),
    subject: z.string(),
    audienceCaption: z.string().nullable(),
    sourceKind: z.enum(["progress", "scores"]),
    productTitle: z.string().nullable(),
    assessmentTitle: z.string().nullable(),
    deliveredCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    openedCount: z.number().int().nonnegative().nullable(),
    recipientCount: z.number().int().nonnegative(),
    status: z.enum(["sent", "partially_failed", "failed"]),
    sentByLabel: z.string().nullable(),
    sentAt: z.iso.datetime(),
    reportHref: z.string().nullable(),
  })
  .strict();

export const cohortMessagesResponseSchema = z.object({
  data: z.object({
    items: z.array(cohortMessageItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export type CohortMessagesResponse = z.infer<typeof cohortMessagesResponseSchema>;

export const retryCohortMessageParamsSchema = z
  .object({
    campaignId: z.uuid(),
  })
  .strict();

export type RetryCohortMessageParams = z.output<typeof retryCohortMessageParamsSchema>;

export const retryCohortMessageBodySchema = rejectClientTenantFields.extend({}).strict();

export type RetryCohortMessageBody = z.output<typeof retryCohortMessageBodySchema>;

export const retryCohortMessageResponseSchema = z.object({
  data: z.object({
    campaignId: z.uuid(),
    deliveredCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    recipientCount: z.number().int().nonnegative(),
  }),
});

export type RetryCohortMessageResponse = z.infer<typeof retryCohortMessageResponseSchema>;
