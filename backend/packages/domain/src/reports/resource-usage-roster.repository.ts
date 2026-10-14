import { resourceUsageRosterMetersRepository } from "./resource-usage-roster-meters.repository";
import { resourceUsageRosterDormantRepository } from "./resource-usage-roster-dormant.repository";
import { resourceUsageRosterInactiveRepository } from "./resource-usage-roster-inactive.repository";
import { resourceUsageRosterStorageRepository } from "./resource-usage-roster-storage.repository";

export type ResourceUsageMeters = {
  storageGb: number;
  activeUsers30d: number;
  currentMau: number;
  totalLearners: number;
  testSubmits: number;
  products: number;
  questions: number;
  messageSends: number;
  bandwidthGb: number;
  drmTokens: number;
  videoTranscodingHours: number;
};

export type ResourceUsageOptimizationCounts = {
  dormantContentCount: number;
  inactiveLearnerCount: number;
  dormantStorageGb: number;
};

export type ResourceUsageLimits = {
  storageGb: number | null;
  mau: number | null;
};

export type ResourceUsageStorageTrend = {
  sparkline: number[];
  deltaGb: number;
};

export type ResourceUsageHistoryRow = {
  metric_key: string;
  metric_label: string;
  period: string;
  value: number;
  unit: string;
  previous_value: number | null;
  change_absolute: number | null;
  change_percent: number | null;
  calculated_at: Date | null;
};

export type ResourceUsageHistorySeriesRow = {
  metric_key: string;
  metric_label: string;
  unit: string;
  points: Array<{ period: string; value: number; change_absolute: number | null }>;
};

export type ResourceUsageHistorySummary = {
  totalRecords: number;
  metricsTracked: number;
  metersAvailable: number;
  periodsRecorded: number;
  earliestPeriod: string | null;
  latestPeriod: string | null;
  lastCalculatedAt: Date | null;
  largestMovement: {
    metricKey: string;
    metricLabel: string;
    unit: string;
    changeAbsolute: number;
    period: string;
  } | null;
  smallestMovement: {
    metricKey: string;
    metricLabel: string;
    unit: string;
    changeAbsolute: number;
    period: string;
  } | null;
};

export type ResourceUsageDormantRow = {
  course_id: string;
  title: string;
  status: string;
  lesson_count: number;
  storage_gb: number;
  active_enrolment_count: number;
  inactive_enrolment_count: number;
  last_learner_activity_at: Date | null;
  dormant_days: number;
  created_at: Date | null;
};

export type ResourceUsageDormantSummaryRow = {
  dormant_course_count: number;
  total_course_count: number;
  storage_held_gb: number;
  total_storage_gb: number;
  unpublished_dormant_count: number;
  longest_dormant_days: number | null;
  longest_dormant_course_id: string | null;
  longest_dormant_title: string | null;
  lessons_affected: number;
  view_all: number;
  view_unpublished: number;
  view_large: number;
  view_never_opened: number;
};

export type ResourceUsageInactiveRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  status: string;
  activity_label: "inactive" | "dormant" | "never_active";
  enrolment_count: number;
  last_active_at: Date | null;
  inactive_days: number;
  created_at: Date;
  has_paid: boolean;
};

export type ResourceUsageInactiveSummaryRow = {
  inactive_learner_count: number;
  total_learner_count: number;
  never_active_count: number;
  inactive_over_year_count: number;
  enrolments_held: number;
  paid_among_them: number;
  view_all: number;
  view_never_active: number;
  view_paid_holding: number;
};

export {
  METRIC_LABELS,
  METRIC_UNITS,
  USAGE_HISTORY_KEYS,
} from "./resource-usage-roster.repository-helpers";

/** The resource usage roster queries, kept in one file per report area. */
export const resourceUsageRosterRepository = {
  ...resourceUsageRosterMetersRepository,
  ...resourceUsageRosterDormantRepository,
  ...resourceUsageRosterInactiveRepository,
  ...resourceUsageRosterStorageRepository,
};
