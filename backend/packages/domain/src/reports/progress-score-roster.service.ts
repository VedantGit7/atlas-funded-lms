import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import { batchesRepository } from "../batches/batches.repository";
import {
  createProgressGroupBodySchema,
  createProgressGroupResponseSchema,
  createScoreGroupBodySchema,
  progressLearnersListResponseSchema,
  progressProductsListResponseSchema,
  scoreLearnersListResponseSchema,
  scoreProductsListResponseSchema,
  scoreQuizzesListResponseSchema,
  scoreItemAnalysisResponseSchema,
  scoreAttemptHistoryResponseSchema,
  SCORE_PRODUCT_SORT_BY,
  type ProgressCoursesQuery,
  type ProgressLearnersQuery,
  type ProgressProductsQuery,
  type ProgressProductType,
  type ProductPublishStatus,
  type ScoreLearnersQuery,
  type ScoreProductType,
  type ScoreProductsQuery,
  type ScoreQuizzesQuery,
  type ScoreAttemptHistoryQuery,
} from "./progress-score-roster.dto";
import { progressScoreQuizDetailRepository } from "./progress-score-quiz-detail.repository";
import {
  progressScoreAssessmentNotFound,
  progressScoreCourseNotFound,
  progressScoreEmptyAudience,
  progressScoreProductNotFound,
} from "./progress-score-roster.errors";
import {
  progressScoreRosterRepository,
  type ProgressLearnersFilter,
  type ScoreLearnersFilter,
} from "./progress-score-roster.repository";
import { progressScorePickerRepository } from "./progress-score-picker.repository";
import { progressScoreAssessmentsRepository } from "./progress-score-assessments.repository";

function pageInfo(totalCount: number, page: number, limit: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  return {
    page,
    pageSize: limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function toProgressFilter(
  productType: ProgressProductType,
  productId: string,
  input: {
    enrolledFrom?: string | undefined;
    enrolledTo?: string | undefined;
    learnerName?: string | undefined;
    enrolledType?: string | undefined;
    status?: string | undefined;
    view?: ProgressLearnersQuery["view"] | undefined;
    completionBand?: ProgressLearnersQuery["completionBand"] | undefined;
    activityStatus?: ProgressLearnersQuery["activityStatus"] | undefined;
  },
): ProgressLearnersFilter {
  const filter: ProgressLearnersFilter = { productType, productId };
  if (input.enrolledFrom) filter.enrolledFrom = input.enrolledFrom;
  if (input.enrolledTo) filter.enrolledTo = input.enrolledTo;
  if (input.learnerName) filter.learnerName = input.learnerName;
  if (input.enrolledType) filter.enrolledType = input.enrolledType;
  if (input.status) filter.status = input.status;
  if (input.view) filter.view = input.view;
  if (input.completionBand) filter.completionBand = input.completionBand;
  if (input.activityStatus) filter.activityStatus = input.activityStatus;
  return filter;
}

function resolveProgressProductContext(input: {
  productType?: ProgressProductType | undefined;
  productId?: string | undefined;
  courseId?: string | undefined;
}): { productType: ProgressProductType; productId: string } {
  const productType = input.productType ?? "course";
  const productId = input.productId ?? (productType === "course" ? input.courseId : undefined);
  if (!productId) {
    throw progressScoreProductNotFound(productType);
  }
  return { productType, productId };
}

function mapProgressLearnerItems(
  rows: Awaited<ReturnType<typeof progressScoreRosterRepository.listProgressLearners>>,
  productType: ProgressProductType,
  productId: string,
) {
  return rows.map((row) => ({
    enrollmentId: row.enrollment_id,
    membershipId: row.membership_id,
    productId,
    productType,
    courseId: productId,
    learnerName: row.learner_name,
    email: row.email,
    completionPct: row.completion_pct,
    completedLessons: row.completed_lessons,
    totalLessons: row.total_lessons,
    enrolledType: row.enrolled_type,
    status: row.status,
    activityStatus: row.activity_status,
    lastLessonTitle: row.last_lesson_title,
    lastActivityAt: row.last_activity_at ? row.last_activity_at.toISOString() : null,
    enrolledAt: row.enrolled_at.toISOString(),
    expiresAt: row.expires_at?.toISOString() ?? null,
  }));
}

function mapCurriculumStrip(
  lessons: Awaited<ReturnType<typeof progressScoreRosterRepository.getCourseCurriculumStrip>>,
) {
  let steepestDropOff: {
    lessonId: string;
    title: string;
    completionPct: number;
    dropPct: number;
  } | null = null;

  for (let index = 1; index < lessons.length; index += 1) {
    const previous = lessons[index - 1];
    const current = lessons[index];
    if (!previous || !current) continue;
    const dropPct = previous.completion_pct - current.completion_pct;
    if (dropPct <= 0) continue;
    if (!steepestDropOff || dropPct > steepestDropOff.dropPct) {
      steepestDropOff = {
        lessonId: current.lesson_id,
        title: current.title,
        completionPct: current.completion_pct,
        dropPct,
      };
    }
  }

  return {
    lessons: lessons.map((lesson) => ({
      lessonId: lesson.lesson_id,
      title: lesson.title,
      position: lesson.position,
      completionPct: lesson.completion_pct,
      completedCount: lesson.completed_count,
    })),
    steepestDropOff,
  };
}

function mapProgressLearnersResponse(
  productType: ProgressProductType,
  productId: string,
  product: NonNullable<
    Awaited<ReturnType<typeof progressScoreRosterRepository.getLearnerRosterProduct>>
  >,
  summary: Awaited<ReturnType<typeof progressScoreRosterRepository.getLearnerRosterSummary>>,
  curriculum: ReturnType<typeof mapCurriculumStrip>,
  rows: Awaited<ReturnType<typeof progressScoreRosterRepository.listProgressLearners>>,
  totalCount: number,
  query: ProgressLearnersQuery,
) {
  return progressLearnersListResponseSchema.parse({
    data: {
      productId,
      productTitle: product.title,
      productType,
      courseId: productId,
      courseTitle: product.title,
      product: {
        id: product.id,
        title: product.title,
        slug: product.slug,
        productType,
        status: product.status,
        lessonCount: product.lesson_count,
        assessmentCount: product.assessment_count,
        enrolledCount: product.enrolled_count,
      },
      summary: {
        avgCompletionPct:
          summary.avg_completion_pct == null
            ? null
            : Math.round(summary.avg_completion_pct * 10) / 10,
        completedCount: summary.completed_count,
        stalledCount: summary.stalled_count,
        notStartedCount: summary.not_started_count,
        expiringWithin30dCount: summary.expiring_within_30d_count,
      },
      curriculum,
      items: mapProgressLearnerItems(rows, productType, productId),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
    },
  });
}

function toScoreFilter(
  assessmentId: string,
  input: {
    submittedFrom?: string | undefined;
    submittedTo?: string | undefined;
    learnerName?: string | undefined;
    resultStatus?: string | undefined;
    minScore?: number | undefined;
    maxScore?: number | undefined;
    minAttempts?: number | undefined;
    attemptsFilter?: ScoreLearnersQuery["attemptsFilter"] | undefined;
    view?: ScoreLearnersQuery["view"] | undefined;
  },
): ScoreLearnersFilter {
  const filter: ScoreLearnersFilter = { assessmentId };
  if (input.submittedFrom) filter.submittedFrom = input.submittedFrom;
  if (input.submittedTo) filter.submittedTo = input.submittedTo;
  if (input.learnerName) filter.learnerName = input.learnerName;
  if (input.resultStatus) filter.resultStatus = input.resultStatus;
  if (input.minScore != null) filter.minScore = input.minScore;
  if (input.maxScore != null) filter.maxScore = input.maxScore;
  if (input.minAttempts != null) filter.minAttempts = input.minAttempts;
  if (input.attemptsFilter) filter.attemptsFilter = input.attemptsFilter;
  if (input.view) filter.view = input.view;
  return filter;
}

function slugifyKey(title: string, prefix: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${prefix}-${base || "group"}-${Date.now().toString(36)}`.slice(0, 64);
}

function buildProgressCriteriaSummary(input: {
  membershipIds?: string[] | undefined;
  enrolledFrom?: string | undefined;
  enrolledTo?: string | undefined;
  learnerName?: string | undefined;
  enrolledType?: string | undefined;
  status?: string | undefined;
}): string | null {
  const parts: string[] = [];
  if (input.membershipIds?.length) {
    parts.push(`${String(input.membershipIds.length)} selected learners`);
  }
  if (input.learnerName) parts.push(`name contains “${input.learnerName}”`);
  if (input.enrolledType) parts.push(`enrolment ${input.enrolledType}`);
  if (input.status) parts.push(`status ${input.status}`);
  if (input.enrolledFrom) parts.push(`enrolled from ${input.enrolledFrom.slice(0, 10)}`);
  if (input.enrolledTo) parts.push(`enrolled to ${input.enrolledTo.slice(0, 10)}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function buildScoreCriteriaSummary(input: {
  membershipIds?: string[] | undefined;
  submittedFrom?: string | undefined;
  submittedTo?: string | undefined;
  learnerName?: string | undefined;
  resultStatus?: string | undefined;
  minScore?: number | undefined;
  maxScore?: number | undefined;
}): string | null {
  const parts: string[] = [];
  if (input.membershipIds?.length) {
    parts.push(`${String(input.membershipIds.length)} selected learners`);
  }
  if (input.learnerName) parts.push(`name contains “${input.learnerName}”`);
  if (input.resultStatus) parts.push(`result ${input.resultStatus}`);
  if (input.minScore != null) parts.push(`score ≥ ${String(input.minScore)}%`);
  if (input.maxScore != null) parts.push(`score ≤ ${String(input.maxScore)}%`);
  if (input.submittedFrom) parts.push(`submitted from ${input.submittedFrom.slice(0, 10)}`);
  if (input.submittedTo) parts.push(`submitted to ${input.submittedTo.slice(0, 10)}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

async function assignAlsoToBatch(
  tx: TenantTx,
  alsoAddToBatchId: string | undefined,
  membershipIds: string[],
) {
  if (!alsoAddToBatchId) return;
  const existing = await batchesRepository.findBatchById(tx, alsoAddToBatchId);
  if (!existing) return;
  for (const membershipId of membershipIds) {
    await batchesRepository.assignMember(tx, { batchId: alsoAddToBatchId, membershipId });
  }
}

function mapProductRow(row: {
  id: string;
  title: string;
  slug: string;
  status: string;
  enrolled_count: number;
  quiz_count: number;
  assessment_id: string | null;
  avg_completion_pct: number | null;
  band_not_started: number;
  band_early: number;
  band_in_progress: number;
  band_nearly_done: number;
  band_complete: number;
  not_started_count: number;
  last_activity_at: Date | null;
}) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status as ProductPublishStatus,
    enrolledCount: row.enrolled_count,
    quizCount: row.quiz_count,
    ...(row.assessment_id ? { assessmentId: row.assessment_id } : {}),
    avgCompletionPct:
      row.avg_completion_pct == null ? null : Math.round(row.avg_completion_pct * 10) / 10,
    completionBands: {
      not_started: row.band_not_started,
      early: row.band_early,
      in_progress: row.band_in_progress,
      nearly_done: row.band_nearly_done,
      complete: row.band_complete,
    },
    notStartedCount: row.not_started_count,
    lastActivityAt: row.last_activity_at ? row.last_activity_at.toISOString() : null,
  };
}

export async function listProgressCourses(
  tx: TenantTx,
  ctx: ServiceCtx,
  query: ProgressCoursesQuery | ProgressProductsQuery,
) {
  return listProgressProducts(tx, ctx, "course", {
    limit: query.limit,
    page: query.page,
    sortBy: "sortBy" in query ? query.sortBy : "title",
    sortDir: "sortDir" in query ? query.sortDir : "asc",
    ...(query.q ? { q: query.q } : {}),
    ...("status" in query && query.status ? { status: query.status } : {}),
  });
}

export async function listProgressProducts(
  tx: TenantTx,
  _ctx: ServiceCtx,
  productType: ProgressProductType,
  query: ProgressProductsQuery,
) {
  const filter = {
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [summary, rows] = await Promise.all([
    progressScoreRosterRepository.summarizeProducts(tx, productType, filter),
    progressScoreRosterRepository.listProducts(tx, productType, query),
  ]);

  return progressProductsListResponseSchema.parse({
    data: {
      items: rows.map(mapProductRow),
      pageInfo: pageInfo(summary.productCount, query.page, query.limit),
      summary: {
        productCount: summary.productCount,
        enrolmentCount: summary.enrolmentCount,
      },
    },
  });
}

export async function listProgressLearners(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  query: ProgressLearnersQuery,
) {
  return listProgressLearnersForProduct(tx, ctx, "course", courseId, query);
}

export async function listProgressLearnersForProduct(
  tx: TenantTx,
  _ctx: ServiceCtx,
  productType: ProgressProductType,
  productId: string,
  query: ProgressLearnersQuery,
) {
  const product = await progressScoreRosterRepository.getLearnerRosterProduct(
    tx,
    productType,
    productId,
  );
  if (!product) {
    if (productType === "course") throw progressScoreCourseNotFound();
    throw progressScoreProductNotFound(productType);
  }

  const filter = toProgressFilter(productType, productId, {
    ...(query.enrolledFrom ? { enrolledFrom: query.enrolledFrom } : {}),
    ...(query.enrolledTo ? { enrolledTo: query.enrolledTo } : {}),
    ...(query.learnerName ? { learnerName: query.learnerName } : {}),
    ...(query.enrolledType ? { enrolledType: query.enrolledType } : {}),
    ...(query.status ? { status: query.status } : {}),
    view: query.view,
    ...(query.completionBand ? { completionBand: query.completionBand } : {}),
    ...(query.activityStatus ? { activityStatus: query.activityStatus } : {}),
  });

  const [totalCount, rows, summary, curriculumLessons] = await Promise.all([
    progressScoreRosterRepository.countProgressLearners(tx, filter),
    progressScoreRosterRepository.listProgressLearners(tx, productType, productId, query),
    progressScoreRosterRepository.getLearnerRosterSummary(tx, productType, productId),
    productType === "course"
      ? progressScoreRosterRepository.getCourseCurriculumStrip(tx, productId)
      : Promise.resolve([]),
  ]);

  return mapProgressLearnersResponse(
    productType,
    productId,
    product,
    summary,
    mapCurriculumStrip(curriculumLessons),
    rows,
    totalCount,
    query,
  );
}

export async function listScoreCourses(
  tx: TenantTx,
  ctx: ServiceCtx,
  query: ScoreProductsQuery | ProgressCoursesQuery,
) {
  const scoreSortBy =
    SCORE_PRODUCT_SORT_BY.find((value) => "sortBy" in query && query.sortBy === value) ??
    "attempts";
  const scoreQuery: ScoreProductsQuery = {
    limit: query.limit,
    page: query.page,
    sortBy: scoreSortBy,
    sortDir: "sortDir" in query ? query.sortDir : "desc",
    hasUngraded: "hasUngraded" in query && query.hasUngraded === true ? true : undefined,
    ...(query.q ? { q: query.q } : {}),
    ...("status" in query && query.status ? { status: query.status } : {}),
    ...("passRateBand" in query && query.passRateBand ? { passRateBand: query.passRateBand } : {}),
  };
  return listScoreProducts(tx, ctx, "course", scoreQuery);
}

export async function listScoreProducts(
  tx: TenantTx,
  _ctx: ServiceCtx,
  productType: ScoreProductType,
  query: ScoreProductsQuery,
) {
  const listQuery = {
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.passRateBand ? { passRateBand: query.passRateBand } : {}),
    ...(query.hasUngraded === true ? { hasUngraded: true as const } : {}),
    sortBy: query.sortBy,
    sortDir: query.sortDir,
    limit: query.limit,
    page: query.page,
  };

  const [summary, rows, totalCount] = await Promise.all([
    progressScorePickerRepository.summarizeScoreProducts(tx, productType, {
      ...(query.q ? { q: query.q } : {}),
      ...(query.status ? { status: query.status } : {}),
    }),
    progressScorePickerRepository.listScoreProducts(tx, productType, listQuery),
    progressScorePickerRepository.countScoreProducts(tx, productType, query),
  ]);

  return scoreProductsListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status,
        productType,
        assessmentCount: row.assessment_count,
        learnersAttempted: row.learners_attempted,
        attemptCount: row.attempt_count,
        avgScorePct: row.avg_score_pct == null ? null : Math.round(row.avg_score_pct * 10) / 10,
        passMarkPct: row.pass_mark_pct == null ? null : Math.round(row.pass_mark_pct * 10) / 10,
        passRatePct: row.pass_rate_pct == null ? null : Math.round(row.pass_rate_pct * 10) / 10,
        ungradedCount: row.ungraded_count,
        lastAttemptAt: row.last_attempt_at ? row.last_attempt_at.toISOString() : null,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      summary: {
        productCount: summary.product_count,
        assessmentCount: summary.assessment_count,
        attemptCount: summary.attempt_count,
      },
    },
  });
}

export async function listScoreQuizzes(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  query: ScoreQuizzesQuery,
) {
  return listScoreQuizzesForProduct(tx, ctx, "course", courseId, query);
}

function formatMedianTimeLabel(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${String(hours)}h ${String(remMins)}m`;
  }
  return `${String(mins)}m ${String(secs).padStart(2, "0")}s`;
}

function roundPct(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function toScoreSpread(row: {
  spread_min: number | null;
  spread_q1: number | null;
  spread_median: number | null;
  spread_q3: number | null;
  spread_max: number | null;
}) {
  if (
    row.spread_min == null ||
    row.spread_q1 == null ||
    row.spread_median == null ||
    row.spread_q3 == null ||
    row.spread_max == null
  ) {
    return null;
  }
  return {
    min: roundPct(row.spread_min) ?? 0,
    q1: roundPct(row.spread_q1) ?? 0,
    median: roundPct(row.spread_median) ?? 0,
    q3: roundPct(row.spread_q3) ?? 0,
    max: roundPct(row.spread_max) ?? 0,
  };
}

export async function listScoreQuizzesForProduct(
  tx: TenantTx,
  _ctx: ServiceCtx,
  productType: ScoreProductType,
  productId: string,
  query: ScoreQuizzesQuery,
) {
  const product = await progressScoreAssessmentsRepository.findProductMeta(
    tx,
    productType,
    productId,
  );
  if (!product) {
    if (productType === "course") throw progressScoreCourseNotFound();
    throw progressScoreProductNotFound(productType);
  }

  const [totalCount, rows, summary] = await Promise.all([
    progressScoreAssessmentsRepository.countAssessments(tx, productType, productId, query),
    progressScoreAssessmentsRepository.listAssessments(tx, productType, productId, query),
    progressScoreAssessmentsRepository.getProductSummary(tx, productType, productId),
  ]);

  const attemptsPerLearner =
    summary.learners_attempted > 0
      ? Math.round((summary.attempt_count / summary.learners_attempted) * 10) / 10
      : null;

  return scoreQuizzesListResponseSchema.parse({
    data: {
      product: {
        productType,
        productId: product.product_id,
        title: product.title,
        slug: product.slug,
        status: product.status,
      },
      courseId: productId,
      courseTitle: product.title,
      summary: {
        assessmentCount: summary.assessment_count,
        learnersAttempted: summary.learners_attempted,
        attemptCount: summary.attempt_count,
        attemptsPerLearner,
        avgScorePct: roundPct(summary.avg_score_pct),
        passRatePct: roundPct(summary.pass_rate_pct),
        ungradedCount: summary.ungraded_count,
        medianTimeLabel: formatMedianTimeLabel(summary.median_duration_seconds),
      },
      items: rows.map((row) => ({
        assessmentId: row.assessment_id,
        title: row.title,
        assessmentType: row.assessment_type,
        lessonId: row.lesson_id,
        lessonTitle: row.lesson_title,
        questionCount: row.question_count,
        passMarkPct: roundPct(row.pass_mark_pct),
        attemptCount: row.attempt_count,
        learnerCount: row.learner_count,
        avgScorePct: roundPct(row.avg_score_pct),
        passRatePct: roundPct(row.pass_rate_pct),
        ungradedCount: row.ungraded_count,
        lastAttemptAt: row.last_attempt_at ? row.last_attempt_at.toISOString() : null,
        scoreSpread: toScoreSpread(row),
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function listScoreLearners(
  tx: TenantTx,
  _ctx: ServiceCtx,
  assessmentId: string,
  query: ScoreLearnersQuery,
) {
  const meta = await progressScoreRosterRepository.findAssessmentMeta(tx, assessmentId);
  if (!meta) throw progressScoreAssessmentNotFound();

  const filter = toScoreFilter(assessmentId, {
    ...(query.submittedFrom ? { submittedFrom: query.submittedFrom } : {}),
    ...(query.submittedTo ? { submittedTo: query.submittedTo } : {}),
    ...(query.learnerName ? { learnerName: query.learnerName } : {}),
    ...(query.resultStatus ? { resultStatus: query.resultStatus } : {}),
    ...(query.minScore != null ? { minScore: query.minScore } : {}),
    ...(query.maxScore != null ? { maxScore: query.maxScore } : {}),
    ...(query.minAttempts != null ? { minAttempts: query.minAttempts } : {}),
    ...(query.attemptsFilter ? { attemptsFilter: query.attemptsFilter } : {}),
    view: query.view,
  });
  const [totalCount, rows, summary] = await Promise.all([
    progressScoreRosterRepository.countScoreLearners(tx, filter),
    progressScoreRosterRepository.listScoreLearners(tx, assessmentId, query),
    progressScoreRosterRepository.getScoreLearnerSummary(tx, assessmentId),
  ]);

  const attemptsPerLearner =
    summary.learner_count > 0
      ? Math.round((summary.attempt_count / summary.learner_count) * 10) / 10
      : null;

  return scoreLearnersListResponseSchema.parse({
    data: {
      assessment: {
        assessmentId,
        title: meta.title,
        assessmentType: meta.assessment_type,
        passMarkPercent: roundPct(meta.pass_mark_percent),
        questionCount: meta.question_count,
        lessonId: meta.lesson_id,
        lessonTitle: meta.lesson_title,
        productType: meta.product_type,
        productId: meta.product_id,
        productTitle: meta.product_title,
      },
      assessmentId,
      assessmentTitle: meta.title,
      courseId: meta.course_id,
      courseTitle: meta.course_title,
      passMarkPercent: roundPct(meta.pass_mark_percent),
      summary: {
        learnerCount: summary.learner_count,
        passedCount: summary.passed_count,
        attemptCount: summary.attempt_count,
        attemptsPerLearner,
        avgScorePct: roundPct(summary.avg_score_pct),
        passRatePct: roundPct(summary.pass_rate_pct),
        ungradedCount: summary.ungraded_count,
        medianTimeLabel: formatMedianTimeLabel(summary.median_duration_seconds),
      },
      items: rows.map((row) => ({
        membershipId: row.membership_id,
        assessmentId: row.assessment_id,
        learnerName: row.learner_name,
        email: row.email,
        resultStatus: row.result_status,
        attemptCount: row.attempt_count,
        scorePct: row.score_pct == null ? null : roundPct(row.score_pct),
        bestScorePct: row.best_score_pct == null ? null : roundPct(row.best_score_pct),
        answeredCount: row.answered_count,
        questionCount: row.question_count,
        durationSeconds:
          row.duration_seconds == null ? null : Math.max(0, Math.round(row.duration_seconds)),
        submittedAt: row.submitted_at?.toISOString() ?? null,
        startedAt: row.started_at?.toISOString() ?? null,
        latestAttemptId: row.latest_attempt_id,
        improvedOnRetry: row.improved_on_retry,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
    },
  });
}

export async function listScoreItemAnalysis(tx: TenantTx, _ctx: ServiceCtx, assessmentId: string) {
  const meta = await progressScoreRosterRepository.findAssessmentMeta(tx, assessmentId);
  if (!meta) throw progressScoreAssessmentNotFound();

  const items = await progressScoreQuizDetailRepository.listItemAnalysis(tx, assessmentId);
  const belowFortyCount = items.filter(
    (item) => item.correctRatePct != null && item.correctRatePct < 40,
  ).length;

  return scoreItemAnalysisResponseSchema.parse({
    data: {
      assessmentId,
      belowFortyCount,
      items: items.map((item) => ({
        assessmentItemId: item.assessmentItemId,
        itemId: item.itemId,
        position: item.position,
        stem: item.stem,
        itemTypeKey: item.itemTypeKey,
        correctRatePct: item.correctRatePct,
        avgTimeLabel: item.avgTimeLabel,
        discrimination: item.discrimination,
        mostWrongOption: item.mostWrongOption,
        mostWrongSharePct: item.mostWrongSharePct,
        options: item.options,
      })),
    },
  });
}

export async function listScoreAttemptHistory(
  tx: TenantTx,
  _ctx: ServiceCtx,
  assessmentId: string,
  query: ScoreAttemptHistoryQuery,
) {
  const meta = await progressScoreRosterRepository.findAssessmentMeta(tx, assessmentId);
  if (!meta) throw progressScoreAssessmentNotFound();

  const [totalCount, items] = await Promise.all([
    progressScoreQuizDetailRepository.countAttemptHistory(tx, assessmentId, query),
    progressScoreQuizDetailRepository.listAttemptHistory(tx, assessmentId, query),
  ]);

  return scoreAttemptHistoryResponseSchema.parse({
    data: {
      assessmentId,
      items: items.map((item) => ({
        ...item,
        scorePct: item.scorePct == null ? null : roundPct(item.scorePct),
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function resolveProgressMembershipIds(
  tx: TenantTx,
  input: {
    productType?: ProgressProductType | undefined;
    productId?: string | undefined;
    courseId?: string | undefined;
    membershipIds?: string[] | undefined;
    enrolledFrom?: string | undefined;
    enrolledTo?: string | undefined;
    learnerName?: string | undefined;
    enrolledType?: string | undefined;
    status?: string | undefined;
  },
): Promise<string[]> {
  if (input.membershipIds && input.membershipIds.length > 0) {
    return [...new Set(input.membershipIds)];
  }
  const { productType, productId } = resolveProgressProductContext(input);
  const membershipIds = await progressScoreRosterRepository.listProgressMembershipIds(
    tx,
    toProgressFilter(productType, productId, input),
  );
  if (membershipIds.length === 0) throw progressScoreEmptyAudience();
  return membershipIds;
}

export async function resolveScoreMembershipIds(
  tx: TenantTx,
  input: {
    assessmentId: string;
    membershipIds?: string[] | undefined;
    submittedFrom?: string | undefined;
    submittedTo?: string | undefined;
    learnerName?: string | undefined;
    resultStatus?: string | undefined;
    minScore?: number | undefined;
    maxScore?: number | undefined;
  },
): Promise<string[]> {
  if (input.membershipIds && input.membershipIds.length > 0) {
    return [...new Set(input.membershipIds)];
  }
  const membershipIds = await progressScoreRosterRepository.listScoreMembershipIds(
    tx,
    toScoreFilter(input.assessmentId, input),
  );
  if (membershipIds.length === 0) throw progressScoreEmptyAudience();
  return membershipIds;
}

export async function createProgressGroup(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = createProgressGroupBodySchema.parse(rawBody);
  const { productType, productId } = resolveProgressProductContext(body);
  const membershipIds = await resolveProgressMembershipIds(tx, {
    productType,
    productId,
    ...(body.membershipIds ? { membershipIds: body.membershipIds } : {}),
    ...(body.enrolledFrom ? { enrolledFrom: body.enrolledFrom } : {}),
    ...(body.enrolledTo ? { enrolledTo: body.enrolledTo } : {}),
    ...(body.learnerName ? { learnerName: body.learnerName } : {}),
    ...(body.enrolledType ? { enrolledType: body.enrolledType } : {}),
    ...(body.status ? { status: body.status } : {}),
  });
  const productTitle = await progressScoreRosterRepository.findProductTitle(
    tx,
    productType,
    productId,
  );
  const criteriaSummary = buildProgressCriteriaSummary(body);
  const key = slugifyKey(body.title, "prg");
  const batch = await batchesRepository.insertBatch(tx, {
    key,
    name: body.title,
    status: "ACTIVE",
    ...(productType === "course" ? { courseId: productId } : {}),
    metadataJson: {
      source: "progress_score_report",
      description: body.description ?? null,
      productType,
      productId,
      productTitle,
      courseId: productType === "course" ? productId : (body.courseId ?? null),
      createdFrom: "reports.progress-score.progress",
      syncType: "static",
      criteriaSummary,
      filterSnapshot: {
        membershipIds: body.membershipIds ?? null,
        enrolledFrom: body.enrolledFrom ?? null,
        enrolledTo: body.enrolledTo ?? null,
        learnerName: body.learnerName ?? null,
        enrolledType: body.enrolledType ?? null,
        status: body.status ?? null,
      },
    },
  });

  let memberCount = 0;
  for (const membershipId of membershipIds) {
    await batchesRepository.assignMember(tx, { batchId: batch.id, membershipId });
    memberCount += 1;
  }
  await assignAlsoToBatch(tx, body.alsoAddToBatchId, membershipIds);

  return createProgressGroupResponseSchema.parse({
    data: {
      batchId: batch.id,
      key: batch.key,
      name: batch.name,
      memberCount,
    },
  });
}

export async function createScoreGroup(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = createScoreGroupBodySchema.parse(rawBody);
  const membershipIds = await resolveScoreMembershipIds(tx, {
    assessmentId: body.assessmentId,
    ...(body.membershipIds ? { membershipIds: body.membershipIds } : {}),
    ...(body.submittedFrom ? { submittedFrom: body.submittedFrom } : {}),
    ...(body.submittedTo ? { submittedTo: body.submittedTo } : {}),
    ...(body.learnerName ? { learnerName: body.learnerName } : {}),
    ...(body.resultStatus ? { resultStatus: body.resultStatus } : {}),
    ...(body.minScore != null ? { minScore: body.minScore } : {}),
    ...(body.maxScore != null ? { maxScore: body.maxScore } : {}),
  });
  const meta = await progressScoreRosterRepository.findAssessmentMeta(tx, body.assessmentId);
  const criteriaSummary = buildScoreCriteriaSummary(body);
  const key = slugifyKey(body.title, "scr");
  const batch = await batchesRepository.insertBatch(tx, {
    key,
    name: body.title,
    status: "ACTIVE",
    metadataJson: {
      source: "progress_score_report",
      description: body.description ?? null,
      assessmentId: body.assessmentId,
      assessmentTitle: meta?.title ?? null,
      productType: meta?.product_type ?? null,
      productId: meta?.product_id ?? null,
      productTitle: meta?.product_title ?? null,
      createdFrom: "reports.progress-score.scores",
      syncType: "static",
      criteriaSummary,
      filterSnapshot: {
        membershipIds: body.membershipIds ?? null,
        submittedFrom: body.submittedFrom ?? null,
        submittedTo: body.submittedTo ?? null,
        learnerName: body.learnerName ?? null,
        resultStatus: body.resultStatus ?? null,
        minScore: body.minScore ?? null,
        maxScore: body.maxScore ?? null,
      },
    },
  });

  let memberCount = 0;
  for (const membershipId of membershipIds) {
    await batchesRepository.assignMember(tx, { batchId: batch.id, membershipId });
    memberCount += 1;
  }
  await assignAlsoToBatch(tx, body.alsoAddToBatchId, membershipIds);

  return createProgressGroupResponseSchema.parse({
    data: {
      batchId: batch.id,
      key: batch.key,
      name: batch.name,
      memberCount,
    },
  });
}
