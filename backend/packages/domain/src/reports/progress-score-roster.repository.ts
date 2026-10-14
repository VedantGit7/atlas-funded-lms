import type {
  ProgressLearnersQuery,
  ProgressProductType,
  ProductPublishStatus,
  ScoreLearnersQuery,
  ScoreProductType,
} from "./progress-score-roster.dto";
import { progressScoreRosterLookupsRepository } from "./progress-score-roster-lookups.repository";
import { progressScoreRosterProductsRepository } from "./progress-score-roster-products.repository";
import { progressScoreRosterProgressRepository } from "./progress-score-roster-progress.repository";
import { progressScoreRosterScoresRepository } from "./progress-score-roster-scores.repository";
import { progressScoreRosterOverviewRepository } from "./progress-score-roster-overview.repository";

export type ProgressCourseRow = {
  id: string;
  title: string;
  slug: string;
  enrolled_count: number;
  quiz_count: number;
};

export type ProgressProductRow = {
  id: string;
  title: string;
  slug: string;
  status: ProductPublishStatus;
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
};

export type ProgressLearnerRow = {
  enrollment_id: string;
  membership_id: string;
  course_id: string;
  learner_name: string | null;
  email: string | null;
  completion_pct: number;
  completed_lessons: number;
  total_lessons: number;
  enrolled_type: string;
  status: string;
  activity_status: "active" | "stalled" | "not_started";
  last_lesson_title: string | null;
  last_activity_at: Date | null;
  enrolled_at: Date;
  expires_at: Date | null;
};

export type ProgressLearnerRosterProductRow = {
  id: string;
  title: string;
  slug: string;
  status: ProductPublishStatus;
  lesson_count: number;
  assessment_count: number;
  enrolled_count: number;
};

export type ProgressLearnerRosterSummaryRow = {
  avg_completion_pct: number | null;
  completed_count: number;
  stalled_count: number;
  not_started_count: number;
  expiring_within_30d_count: number;
};

export type ProgressCurriculumLessonRow = {
  lesson_id: string;
  title: string;
  position: number;
  completion_pct: number;
  completed_count: number;
};

export type ScoreQuizRow = {
  assessment_id: string;
  title: string;
  assessment_type: string;
  lesson_id: string | null;
  lesson_title: string | null;
  attempt_count: number;
  learner_count: number;
};

export type ScoreLearnerRow = {
  membership_id: string;
  assessment_id: string;
  learner_name: string | null;
  email: string | null;
  result_status: "pass" | "fail" | "pending" | "in_progress";
  attempt_count: number;
  score_pct: number | null;
  best_score_pct: number | null;
  answered_count: number;
  question_count: number | null;
  duration_seconds: number | null;
  submitted_at: Date | null;
  started_at: Date | null;
  latest_attempt_id: string | null;
  improved_on_retry: boolean;
};

export type ProgressLearnersFilter = {
  productType: ProgressProductType;
  productId: string;
  enrolledFrom?: string;
  enrolledTo?: string;
  learnerName?: string;
  enrolledType?: string;
  status?: string;
  view?: ProgressLearnersQuery["view"];
  completionBand?: ProgressLearnersQuery["completionBand"];
  activityStatus?: ProgressLearnersQuery["activityStatus"];
};

export type ScoreLearnersFilter = {
  assessmentId: string;
  submittedFrom?: string;
  submittedTo?: string;
  learnerName?: string;
  resultStatus?: string;
  minScore?: number;
  maxScore?: number;
  minAttempts?: number;
  attemptsFilter?: ScoreLearnersQuery["attemptsFilter"];
  view?: ScoreLearnersQuery["view"];
};

export type ScoreAssessmentDetailMeta = {
  title: string;
  assessment_type: string;
  pass_mark_percent: number | null;
  question_count: number;
  lesson_id: string | null;
  lesson_title: string | null;
  course_id: string | null;
  course_title: string | null;
  product_type: ScoreProductType | null;
  product_id: string | null;
  product_title: string | null;
};

export type ScoreLearnerSummaryRow = {
  learner_count: number;
  passed_count: number;
  attempt_count: number;
  avg_score_pct: number | null;
  pass_rate_pct: number | null;
  ungraded_count: number;
  median_duration_seconds: number | null;
};

export type { ProgressProductType, ScoreProductType };

/** The progress and score roster queries, kept in one file per report area. */
export const progressScoreRosterRepository = {
  ...progressScoreRosterLookupsRepository,
  ...progressScoreRosterProductsRepository,
  ...progressScoreRosterProgressRepository,
  ...progressScoreRosterScoresRepository,
  ...progressScoreRosterOverviewRepository,
};
