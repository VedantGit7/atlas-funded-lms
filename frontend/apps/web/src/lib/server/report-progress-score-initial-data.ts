import "server-only";
import {
  COHORTS_PAGE_SIZE,
  PROGRESS_DEFAULT_PRODUCT_TYPE,
  PROGRESS_LEARNERS_DEFAULTS,
  PROGRESS_LEARNER_COLUMN_OPTIONS,
  SCORES_DEFAULT_PRODUCT_TYPE,
  SCORE_LEARNERS_DEFAULTS,
  SCORE_LEARNER_COLUMN_OPTIONS,
  cohortGroupsPath,
  cohortMessagesPath,
  progressLearnerDetailPath,
  progressLearnersPath,
  progressProductsPath,
  scoreAttemptReviewPath,
  scoreLearnersPath,
  scoreProductsPath,
  scoreQuizzesPath,
  type CohortGroupsPayload,
  type CohortMessagesPayload,
  type CohortsInitial,
  type ProgressLearnerDetail,
  type ProgressLearnersPayload,
  type ProgressProductType,
  type ProgressProductsPayload,
  type ScoreAttemptReviewData,
  type ScoreLearnersPayload,
  type ScoreProductType,
  type ScoreProductsPayload,
  type ScoreQuizzesPayload,
} from "../../features/admin/reports/admin-progress-score-roster-api";
import { loadReportInitialData, type ReportInitialData } from "./report-initial-data";

/*
 * The first data each Progress & Score page shows, loaded on the server so
 * the page arrives filled in. Every path is the one the page's own first
 * browser load would request, so the page can skip that load; each resolves
 * null on failure and the page then loads in the browser as before.
 */

/** The progress tab's product picker: the first page of courses. */
export function loadProgressProductsData() {
  return loadReportInitialData<ProgressProductsPayload>(
    progressProductsPath(PROGRESS_DEFAULT_PRODUCT_TYPE, {
      page: 1,
      limit: 25,
      status: "",
      sortBy: "enrolled_count",
      sortDir: "desc",
    }),
  );
}

/** The scores tab's product picker: the first page of course quizzes. */
export function loadScoreProductsData() {
  return loadReportInitialData<ScoreProductsPayload>(
    scoreProductsPath(SCORES_DEFAULT_PRODUCT_TYPE, {
      page: 1,
      limit: 25,
      passRateBand: "",
      sortBy: "attempts",
      sortDir: "desc",
    }),
  );
}

/** A product's learner roster: everyone, latest activity first, every column. */
export function loadProgressLearnersData(productType: ProgressProductType, productId: string) {
  return loadReportInitialData<ProgressLearnersPayload>(
    progressLearnersPath(productType, productId, {
      ...PROGRESS_LEARNERS_DEFAULTS,
      columns: PROGRESS_LEARNER_COLUMN_OPTIONS.map((column) => column.key),
    }),
  );
}

export function loadProgressLearnerDetailData(
  productType: ProgressProductType,
  productId: string,
  enrollmentId: string,
) {
  return loadReportInitialData<ProgressLearnerDetail>(
    progressLearnerDetailPath(productType, productId, enrollmentId),
  );
}

/** A product's assessments: the first page, by title. */
export function loadScoreQuizzesData(productType: ScoreProductType, productId: string) {
  return loadReportInitialData<ScoreQuizzesPayload>(
    scoreQuizzesPath(productType, productId, {
      passRateBand: "",
      sortBy: "title",
      sortDir: "asc",
      page: 1,
      limit: 25,
    }),
  );
}

/** A quiz's learners: everyone, latest submission first, every column. */
export function loadScoreLearnersData(assessmentId: string) {
  return loadReportInitialData<ScoreLearnersPayload>(
    scoreLearnersPath(assessmentId, {
      ...SCORE_LEARNERS_DEFAULTS,
      columns: SCORE_LEARNER_COLUMN_OPTIONS.map((column) => column.key),
    }),
  );
}

export function loadScoreAttemptReviewData(assessmentId: string, attemptId: string) {
  return loadReportInitialData<ScoreAttemptReviewData>(
    scoreAttemptReviewPath(assessmentId, attemptId),
  );
}

/** The first page of cohort groups and of messages, which the page loads together. */
export async function loadCohortsData(): Promise<ReportInitialData<CohortsInitial> | null> {
  const [groups, messages] = await Promise.all([
    loadReportInitialData<CohortGroupsPayload>(
      cohortGroupsPath({ page: 1, limit: COHORTS_PAGE_SIZE }),
    ),
    loadReportInitialData<CohortMessagesPayload>(
      cohortMessagesPath({ page: 1, limit: COHORTS_PAGE_SIZE }),
    ),
  ]);
  if (!groups || !messages) return null;
  return {
    data: { groups: groups.data, messages: messages.data },
    loadedAt: Math.min(groups.loadedAt, messages.loadedAt),
  };
}
