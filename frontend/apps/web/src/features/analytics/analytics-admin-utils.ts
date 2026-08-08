import type { AnalyticsDashboardResponse } from "@atlas/domain/analytics/analytics.contract";
import type { ChartGranularity, TrendPoint } from "./analytics-studio-shared";

export type AdminTab = "learning" | "community" | "assessment";

export const ADMIN_ROLLUP_LABELS: Record<string, string> = {
  lessons_completed: "Lessons completed",
  assessments_submitted: "Assessments submitted",
  assessments_passed: "Assessments passed",
  practice_sessions_completed: "Practice sessions",
  certificates_issued: "Certificates issued",
  community_posts_created: "Community posts",
  moderation_cases_opened: "Moderation cases",
  path_steps_completed: "Path steps completed",
};

export const FUNNEL_STAGE_LABELS: Record<string, string> = {
  lesson_completed: "Lessons completed",
  assessment_submitted: "Assessments submitted",
  assessment_passed: "Assessments passed",
  practice_session_completed: "Practice sessions completed",
  certificate_issued: "Certificates issued",
  community_post_created: "Community posts",
};

export const FUNNEL_STAGE_ORDER = [
  "lesson_completed",
  "assessment_submitted",
  "assessment_passed",
  "practice_session_completed",
  "certificate_issued",
  "community_post_created",
] as const;

export const COMMUNITY_ROLLUP_KEYS = new Set(["community_posts_created", "moderation_cases_opened"]);

export const DRILL_DOWN_ROLLUP_ALIASES: Record<string, string> = {
  pass_rate: "assessments_passed",
  completion_rate: "assessments_passed",
};

export function resolveDrillDownRollupKey(metricKey: string): string | null {
  if (metricKey in DRILL_DOWN_ROLLUP_ALIASES) {
    return DRILL_DOWN_ROLLUP_ALIASES[metricKey] ?? null;
  }
  if (metricKey in ADMIN_ROLLUP_LABELS || metricKey in FUNNEL_STAGE_LABELS) {
    return metricKey;
  }
  return null;
}

export function latestMetricDay(
  metrics: AnalyticsDashboardResponse["data"]["metrics"],
  rollupKey: string,
  fallbackDay: string,
): string {
  const days = metrics
    .filter((metric) => metric.rollupKey === rollupKey && metric.count > 0)
    .map((metric) => metric.periodStart.slice(0, 10))
    .sort((a, b) => a.localeCompare(b));

  return days.at(-1) ?? fallbackDay;
}

export function formatRollupLabel(key: string): string {
  return ADMIN_ROLLUP_LABELS[key] ?? FUNNEL_STAGE_LABELS[key] ?? key.replaceAll("_", " ");
}

export function aggregateFunnelStages(
  days: Array<{ stages: Array<{ stageKey: string; count: number }> }>,
): Array<{ stageKey: string; count: number }> {
  const totals = new Map<string, number>();
  for (const day of days) {
    for (const stage of day.stages) {
      totals.set(stage.stageKey, (totals.get(stage.stageKey) ?? 0) + stage.count);
    }
  }

  return FUNNEL_STAGE_ORDER.map((stageKey) => ({
    stageKey,
    count: totals.get(stageKey) ?? 0,
  })).filter((stage) => stage.count > 0);
}

export function formatDisplayDate(isoDate: string): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function metricsForTab(
  metrics: AnalyticsDashboardResponse["data"]["metrics"],
  tab: AdminTab,
): AnalyticsDashboardResponse["data"]["metrics"] {
  if (tab === "community") {
    return metrics.filter((metric) => COMMUNITY_ROLLUP_KEYS.has(metric.rollupKey));
  }
  if (tab === "assessment") {
    return metrics.filter((metric) =>
      ["assessments_submitted", "assessments_passed"].includes(metric.rollupKey),
    );
  }
  return metrics.filter((metric) => !COMMUNITY_ROLLUP_KEYS.has(metric.rollupKey));
}

export type HeroMetric = {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  deltaPercent: number | null;
  tone: "up" | "down" | "neutral";
  sparkline: number[];
};

export function computePeriodDelta(values: number[]): number | null {
  if (values.length < 4) return null;
  const midpoint = Math.floor(values.length / 2);
  const first = values.slice(0, midpoint).reduce((sum, value) => sum + value, 0);
  const second = values.slice(midpoint).reduce((sum, value) => sum + value, 0);
  if (first === 0) return second > 0 ? 100 : null;
  return Math.round(((second - first) / first) * 1000) / 10;
}

function dailySeries(
  metrics: AnalyticsDashboardResponse["data"]["metrics"],
  rollupKey: string,
): number[] {
  return metrics
    .filter((metric) => metric.rollupKey === rollupKey)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    .map((metric) => metric.count);
}

export function buildHeroMetrics(
  tabMetrics: AnalyticsDashboardResponse["data"]["metrics"],
  tab: AdminTab,
): HeroMetric[] {
  const totals = new Map<string, number>();
  for (const metric of tabMetrics) {
    totals.set(metric.rollupKey, (totals.get(metric.rollupKey) ?? 0) + metric.count);
  }

  if (tab === "community") {
    return [
      buildHero("community_posts_created", "Community posts", totals, tabMetrics),
      buildHero("moderation_cases_opened", "Moderation cases", totals, tabMetrics),
    ].filter(Boolean) as HeroMetric[];
  }

  if (tab === "assessment") {
    const submitted = totals.get("assessments_submitted") ?? 0;
    const passed = totals.get("assessments_passed") ?? 0;
    const rate = submitted > 0 ? Math.round((passed / submitted) * 1000) / 10 : 0;
    return [
      buildHero("assessments_submitted", "Assessments submitted", totals, tabMetrics),
      buildHero("assessments_passed", "Assessments passed", totals, tabMetrics),
      {
        key: "pass_rate",
        label: "Pass rate",
        value: rate,
        displayValue: submitted > 0 ? `${rate}%` : "—",
        deltaPercent: null,
        tone: rate >= 70 ? "up" : rate >= 50 ? "neutral" : "down",
        sparkline: dailySeries(tabMetrics, "assessments_passed").map((count, index, arr) => {
          const sub = dailySeries(tabMetrics, "assessments_submitted")[index] ?? 0;
          return sub > 0 ? Math.round((count / sub) * 100) : 0;
        }).slice(-5),
      },
    ];
  }

  const submitted = totals.get("assessments_submitted") ?? 0;
  const passed = totals.get("assessments_passed") ?? 0;
  const completionRate = submitted > 0 ? Math.round((passed / submitted) * 1000) / 10 : 0;

  return [
    buildHero("lessons_completed", "Lessons completed", totals, tabMetrics),
    buildHero("practice_sessions_completed", "Practice sessions", totals, tabMetrics),
    {
      key: "completion_rate",
      label: "Completion rate",
      value: completionRate,
      displayValue: submitted > 0 ? `${completionRate}%` : "—",
      deltaPercent: null,
      tone: completionRate >= 60 ? "up" : completionRate >= 40 ? "neutral" : "down",
      sparkline: [],
    },
  ];
}

function buildHero(
  key: string,
  label: string,
  totals: Map<string, number>,
  tabMetrics: AnalyticsDashboardResponse["data"]["metrics"],
): HeroMetric | null {
  const value = totals.get(key) ?? 0;
  const series = dailySeries(tabMetrics, key);
  const deltaPercent = computePeriodDelta(series);
  return {
    key,
    label,
    value,
    displayValue: value.toLocaleString(),
    deltaPercent,
    tone: deltaPercent == null ? "neutral" : deltaPercent >= 0 ? "up" : "down",
    sparkline: series.slice(-5),
  };
}

export function learningActivityTrendPoints(
  metrics: AnalyticsDashboardResponse["data"]["metrics"],
  granularity: ChartGranularity,
): TrendPoint[] {
  const daily = metrics
    .filter((metric) => metric.rollupKey === "lessons_completed")
    .map((metric) => ({
      periodStart: metric.periodStart.slice(0, 10),
      count: metric.count,
    }));

  if (granularity === "daily") {
    return daily
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
      .map((row) => ({
        label: formatShortDate(row.periodStart),
        count: row.count,
        sortKey: row.periodStart,
      }));
  }

  const buckets = new Map<string, number>();
  for (const row of daily) {
    const key =
      granularity === "weekly" ? weekStartKey(row.periodStart) : row.periodStart.slice(0, 7);
    buckets.set(key, (buckets.get(key) ?? 0) + row.count);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sortKey, count]) => ({
      label: granularity === "weekly" ? `Wk ${sortKey.slice(5)}` : formatMonthLabel(sortKey),
      count,
      sortKey,
    }));
}

export type FunnelStageView = {
  stageKey: string;
  label: string;
  count: number;
  widthPercent: number;
  dropPercent: number | null;
};

export function buildFunnelStages(
  stages: Array<{ stageKey: string; count: number }>,
): FunnelStageView[] {
  if (stages.length === 0) return [];
  const maxCount = Math.max(...stages.map((stage) => stage.count), 1);
  return stages.map((stage, index) => {
    const previous = index > 0 ? stages[index - 1]?.count ?? 0 : null;
    const dropPercent =
      previous != null && previous > 0
        ? Math.round(((previous - stage.count) / previous) * 1000) / 10
        : null;
    return {
      stageKey: stage.stageKey,
      label: FUNNEL_STAGE_LABELS[stage.stageKey] ?? formatRollupLabel(stage.stageKey),
      count: stage.count,
      widthPercent: Math.max(8, Math.round((stage.count / maxCount) * 100)),
      dropPercent: dropPercent != null && dropPercent > 0 ? dropPercent : null,
    };
  });
}

export function largestFunnelDrop(stages: FunnelStageView[]): { from: string; to: string } | null {
  let largest: { from: string; to: string; drop: number } | null = null;
  for (let index = 1; index < stages.length; index += 1) {
    const previous = stages[index - 1];
    const current = stages[index];
    if (!previous || !current) continue;
    const drop = previous.count > 0 ? ((previous.count - current.count) / previous.count) * 100 : 0;
    if (!largest || drop > largest.drop) {
      largest = { from: previous.label, to: current.label, drop };
    }
  }
  if (!largest || largest.drop < 5) return null;
  return { from: largest.from, to: largest.to };
}

function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function weekStartKey(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}
