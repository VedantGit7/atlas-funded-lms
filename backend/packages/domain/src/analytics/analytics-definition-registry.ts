export const ANALYTICS_DASHBOARD_KEYS = ["tenant.learning", "course.learning"] as const;
export type AnalyticsDashboardKey = (typeof ANALYTICS_DASHBOARD_KEYS)[number];

export const ANALYTICS_FUNNEL_KEYS = ["learning.engagement"] as const;
export type AnalyticsFunnelKey = (typeof ANALYTICS_FUNNEL_KEYS)[number];

export const ITEM_STATISTICS_WINDOW_KEYS = ["rolling_30d", "rolling_90d", "all_time"] as const;
export type ItemStatisticsWindowKey = (typeof ITEM_STATISTICS_WINDOW_KEYS)[number];

export const TENANT_LEARNING_ROLLUP_KEYS = [
  "lessons_completed",
  "assessments_submitted",
  "assessments_passed",
  "practice_sessions_completed",
  "certificates_issued",
  "community_posts_created",
  "moderation_cases_opened",
  "path_steps_completed",
] as const;

export const COURSE_LEARNING_ROLLUP_KEYS = [
  "lessons_completed",
  "assessments_submitted",
  "assessments_passed",
  "practice_sessions_completed",
] as const;

export const LEARNING_ENGAGEMENT_FUNNEL_STAGES = [
  "lesson_completed",
  "assessment_submitted",
  "assessment_passed",
  "practice_session_completed",
  "certificate_issued",
  "community_post_created",
] as const;

export const ANALYTICS_DEFAULT_RANGE_DAYS = 30;
export const ANALYTICS_MAX_RANGE_DAYS = 90;

export type DashboardDefinition = {
  key: AnalyticsDashboardKey;
  scopeType: "tenant" | "course";
  rollupKeys: readonly string[];
};

export type FunnelDefinition = {
  key: AnalyticsFunnelKey;
  stageKeys: readonly string[];
};

const DASHBOARD_DEFINITIONS: Record<AnalyticsDashboardKey, DashboardDefinition> = {
  "tenant.learning": {
    key: "tenant.learning",
    scopeType: "tenant",
    rollupKeys: TENANT_LEARNING_ROLLUP_KEYS,
  },
  "course.learning": {
    key: "course.learning",
    scopeType: "course",
    rollupKeys: COURSE_LEARNING_ROLLUP_KEYS,
  },
};

const FUNNEL_DEFINITIONS: Record<AnalyticsFunnelKey, FunnelDefinition> = {
  "learning.engagement": {
    key: "learning.engagement",
    stageKeys: LEARNING_ENGAGEMENT_FUNNEL_STAGES,
  },
};

export function getDashboardDefinition(key: string): DashboardDefinition | null {
  if (!(ANALYTICS_DASHBOARD_KEYS as readonly string[]).includes(key)) {
    return null;
  }
  return DASHBOARD_DEFINITIONS[key as AnalyticsDashboardKey];
}

export function getFunnelDefinition(key: string): FunnelDefinition | null {
  if (!(ANALYTICS_FUNNEL_KEYS as readonly string[]).includes(key)) {
    return null;
  }
  return FUNNEL_DEFINITIONS[key as AnalyticsFunnelKey];
}

export function isRegisteredItemStatisticsWindowKey(key: string): key is ItemStatisticsWindowKey {
  return (ITEM_STATISTICS_WINDOW_KEYS as readonly string[]).includes(key);
}

export function resolveTenantSubjectId(tenantId: string): string {
  return tenantId;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function endOfUtcDay(date: Date): Date {
  const start = startOfUtcDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function parseBoundedDateRange(raw: { from?: string; to?: string }): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  const defaultTo = startOfUtcDay(now);
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - (ANALYTICS_DEFAULT_RANGE_DAYS - 1));

  const to = raw.to ? startOfUtcDay(new Date(raw.to)) : defaultTo;
  const from = raw.from ? startOfUtcDay(new Date(raw.from)) : defaultFrom;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range.");
  }

  if (from.getTime() > to.getTime()) {
    throw new Error("from must be on or before to.");
  }

  const spanDays = Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (spanDays > ANALYTICS_MAX_RANGE_DAYS) {
    throw new Error(`Date range cannot exceed ${String(ANALYTICS_MAX_RANGE_DAYS)} days.`);
  }

  return { from, to };
}
