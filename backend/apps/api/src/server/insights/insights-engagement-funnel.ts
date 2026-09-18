import type { InsightDashboardRange } from "./insights-range";
import {
  SCHOOL_VITALS_FUNNEL_CAVEAT,
  downsampleSparkline,
  seriesHalfDelta,
} from "./insights-school-vitals";
import type { LearningRollupBundle, SchoolVitalsRollupKey } from "./insights.repository";
import { csvEscape } from "@atlas/core/csv/escape";

export const ENGAGEMENT_FUNNEL_STAGES = [
  {
    key: "lessons_completed",
    label: "Lessons completed",
    widgetId: "lessons-completed",
  },
  {
    key: "assessments_submitted",
    label: "Assessments submitted",
    widgetId: "assessments-submitted",
  },
  {
    key: "assessments_passed",
    label: "Assessments passed",
    widgetId: "assessments-passed",
  },
  {
    key: "practice_sessions_completed",
    label: "Practice sessions",
    widgetId: "practice-sessions",
  },
  {
    key: "community_posts_created",
    label: "Community posts",
    widgetId: "community-posts",
  },
  {
    key: "certificates_issued",
    label: "Certificates issued",
    widgetId: "certificates-issued",
  },
] as const satisfies ReadonlyArray<{
  key: SchoolVitalsRollupKey;
  label: string;
  widgetId: string;
}>;

export type InsightEngagementFunnelStage = {
  key: string;
  label: string;
  widgetId: string;
  count: number;
  currentHalf: number | null;
  previousCount: number | null;
  sharePct: number;
  maxSharePct: number;
  deltaAbs: number | null;
  deltaPct: number | null;
  sparkline: number[];
};

export type InsightEngagementFunnelRatio = {
  id: string;
  label: string;
  detail: string;
  valuePct: number;
};

export type InsightEngagementFunnelBoard = {
  slug: "school-vitals";
  title: string;
  range: InsightDashboardRange;
  rangeLabel: string;
  currentLabel: string;
  previousLabel: string;
  generatedAt: string;
  from: string;
  to: string;
  caveat: string;
  totalEvents: number;
  empty: boolean;
  comparable: boolean;
  topMover: { label: string; deltaPct: number } | null;
  stages: InsightEngagementFunnelStage[];
  ratios: InsightEngagementFunnelRatio[];
  progressHref: string;
};

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function rangeLabel(range: InsightDashboardRange): string {
  if (range === "30d") return "Last 30 days";
  if (range === "ytd") return "Year to date";
  return "Last 12 months";
}

function comparisonLabels(range: InsightDashboardRange): { current: string; previous: string } {
  if (range === "30d") {
    return { current: "Latest 15 days", previous: "Prior 15 days" };
  }
  if (range === "ytd") {
    return { current: "Second half of YTD", previous: "First half of YTD" };
  }
  return { current: "Latest 6 months", previous: "Prior 6 months" };
}

export function buildInsightEngagementFunnel(
  rollups: LearningRollupBundle,
  range: InsightDashboardRange,
  generatedAt = new Date().toISOString(),
): InsightEngagementFunnelBoard {
  const rawStages = ENGAGEMENT_FUNNEL_STAGES.map((stage) => {
    const series = rollups.seriesByKey[stage.key];
    const values = series.map((point) => point.value);
    const count = rollups.totals[stage.key];
    const delta = seriesHalfDelta(series);
    const mid = Math.floor(values.length / 2);
    const previousCount = values.length >= 4 ? sum(values.slice(0, mid)) : null;
    const currentHalf = values.length >= 4 ? sum(values.slice(mid)) : null;
    return {
      key: stage.key,
      label: stage.label,
      widgetId: stage.widgetId,
      count,
      currentHalf,
      previousCount,
      deltaAbs: delta.deltaAbs,
      deltaPct: delta.deltaPct,
      sparkline: downsampleSparkline(values),
    };
  });

  const totalEvents = rawStages.reduce((total, stage) => total + stage.count, 0);
  const maxCount = Math.max(...rawStages.map((stage) => stage.count), 1);
  const stages: InsightEngagementFunnelStage[] = rawStages.map((stage) => ({
    ...stage,
    sharePct: totalEvents > 0 ? round1((stage.count / totalEvents) * 100) : 0,
    maxSharePct: round1((stage.count / maxCount) * 100),
  }));

  const comparable = stages.some(
    (stage) => stage.previousCount != null && stage.currentHalf != null,
  );
  let topMover: InsightEngagementFunnelBoard["topMover"] = null;
  for (const stage of stages) {
    if (stage.deltaPct == null || stage.deltaPct === 0) continue;
    if (topMover == null || Math.abs(stage.deltaPct) > Math.abs(topMover.deltaPct)) {
      topMover = { label: stage.label, deltaPct: stage.deltaPct };
    }
  }

  const submitted = rollups.totals.assessments_submitted;
  const passed = rollups.totals.assessments_passed;
  const certificates = rollups.totals.certificates_issued;
  const ratios: InsightEngagementFunnelRatio[] = [];
  if (submitted > 0) {
    ratios.push({
      id: "pass-rate",
      label: "Pass rate",
      detail: "Assessments passed / assessments submitted",
      valuePct: round1((passed / submitted) * 100),
    });
  }
  if (passed > 0) {
    ratios.push({
      id: "certificates-per-pass",
      label: "Certificates per pass",
      detail: "Certificates issued / assessments passed",
      valuePct: round1((certificates / passed) * 100),
    });
  }

  const labels = comparisonLabels(range);
  return {
    slug: "school-vitals",
    title: "Learning engagement funnel",
    range,
    rangeLabel: rangeLabel(range),
    currentLabel: labels.current,
    previousLabel: labels.previous,
    generatedAt,
    from: rollups.from,
    to: rollups.to,
    caveat: SCHOOL_VITALS_FUNNEL_CAVEAT,
    totalEvents,
    empty: totalEvents === 0,
    comparable,
    topMover,
    stages,
    ratios,
    progressHref: "/admin/reports/progress-score",
  };
}

export function engagementFunnelToCsv(board: InsightEngagementFunnelBoard): string {
  const header = ["Stage", "Events", "Share %", "Change %", "Current half", "Previous half"];
  const lines = [header.join(",")];
  for (const stage of board.stages) {
    lines.push(
      [
        csvEscape(stage.label),
        String(stage.count),
        String(stage.sharePct),
        stage.deltaPct == null ? "" : String(stage.deltaPct),
        stage.currentHalf == null ? "" : String(stage.currentHalf),
        stage.previousCount == null ? "" : String(stage.previousCount),
      ].join(","),
    );
  }
  return lines.join("\n");
}
