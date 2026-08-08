import type { AnalyticsDashboardResponse } from "@atlas/domain/analytics/analytics.contract";

export {
  panelClassName,
  sectionHeaderClassName,
  statCardClassName,
  statLabelClassName,
  tableHeaderClassName,
  tableShellClassName,
  secondaryButtonClassName,
} from "../grading/grading-studio-shared";

export { primaryButtonClassName } from "../../app/admin/branding/_components/branding-admin-shared";

/** Matches MembersTable filter selects — portal listbox, admin-themed trigger. */
export const toolbarSelectTriggerClassName =
  "h-7 min-w-[6rem] max-w-[12rem] rounded-md border-0 bg-transparent px-1 py-0 text-sm font-medium text-[var(--admin-on-surface)] shadow-none outline-none transition-colors hover:text-[var(--admin-primary)] focus:border-transparent focus:ring-0 focus-visible:ring-0";

export const toolbarSegmentClassName =
  "flex h-10 shrink-0 items-center gap-2 border-r border-[var(--admin-border)] px-3 transition-colors duration-200 ease-out hover:bg-[var(--admin-surface-low)] has-[[aria-expanded=true]]:bg-[color-mix(in_srgb,var(--admin-primary)_7%,var(--admin-surface-low))]";

export const toolbarLabelClassName =
  "shrink-0 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

/** Contrast apply control — dark in light mode, inverted in dark mode (mockup `on-background`). */
export const applyToolbarButtonClassName =
  "ml-1 inline-flex shrink-0 items-center justify-center rounded-md bg-[var(--admin-on-surface)] px-4 py-1.5 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] hover:opacity-90 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export const panelHeaderClassName =
  "text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface)]";

export const recessedPanelClassName =
  "flex flex-col rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4";

export const chartGridStroke = "var(--admin-border)";
export const chartLineStroke = "var(--admin-primary)";
export const chartFill = "color-mix(in srgb, var(--admin-primary) 8%, transparent)";

export const ROLLUP_LABELS: Record<string, string> = {
  lessons_completed: "Lessons completed",
  assessments_submitted: "Assessment submissions",
  assessments_passed: "Assessments passed",
  practice_sessions_completed: "Practice sessions",
};

export type ChartGranularity = "daily" | "weekly" | "monthly";

export type TrendPoint = {
  label: string;
  count: number;
  sortKey: string;
};

export type StudioSummaryMetrics = {
  totalSubmissions: number;
  avgAccuracy: number | null;
  avgLatencySec: number | null;
  completionRate: number | null;
  passGoalMet: boolean | null;
  latencyHigh: boolean | null;
};

export type ItemStatisticRow = {
  itemReference: { itemId: string; label: string };
  attemptsCount: number;
  correctCount: number;
  accuracy: number | null;
  averageLatencyMs: number | null;
  difficulty?: number | null;
  discrimination?: number | null;
  distractorRates?: Array<{ optionId: string; rate: number }> | null;
  sampleSizeWarning?: boolean;
  qualityFlag?: "bad" | "fair" | "good";
};

const ACCURACY_GOAL = 0.75;
const LATENCY_HIGH_MS = 5000;

export function aggregateMetricTotals(
  metrics: AnalyticsDashboardResponse["data"]["metrics"],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const metric of metrics) {
    totals.set(metric.rollupKey, (totals.get(metric.rollupKey) ?? 0) + metric.count);
  }
  return totals;
}

export function computeStudioSummary(
  metrics: AnalyticsDashboardResponse["data"]["metrics"],
  items: ItemStatisticRow[],
): StudioSummaryMetrics {
  const totals = aggregateMetricTotals(metrics);
  const totalSubmissions = totals.get("assessments_submitted") ?? 0;
  const passed = totals.get("assessments_passed") ?? 0;
  const completionRate =
    totalSubmissions > 0 ? Math.round((passed / totalSubmissions) * 100) : null;

  const withAccuracy = items.filter((item) => item.accuracy != null);
  const avgAccuracy =
    withAccuracy.length > 0
      ? Math.round(
          (withAccuracy.reduce((sum, item) => sum + item.accuracy!, 0) / withAccuracy.length) *
            1000,
        ) / 10
      : null;

  const withLatency = items.filter((item) => item.averageLatencyMs != null);
  const avgLatencyMs =
    withLatency.length > 0
      ? withLatency.reduce((sum, item) => sum + item.averageLatencyMs!, 0) / withLatency.length
      : null;
  const avgLatencySec =
    avgLatencyMs != null ? Math.round((avgLatencyMs / 1000) * 10) / 10 : null;

  return {
    totalSubmissions,
    avgAccuracy,
    avgLatencySec,
    completionRate,
    passGoalMet: completionRate != null ? completionRate >= 90 : null,
    latencyHigh: avgLatencyMs != null ? avgLatencyMs >= LATENCY_HIGH_MS : null,
  };
}

export function submissionTrendPoints(
  metrics: AnalyticsDashboardResponse["data"]["metrics"],
  granularity: ChartGranularity,
): TrendPoint[] {
  const daily = metrics
    .filter((metric) => metric.rollupKey === "assessments_submitted")
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

export function peakVolumeDays(
  metrics: AnalyticsDashboardResponse["data"]["metrics"],
  limit = 5,
): TrendPoint[] {
  return metrics
    .filter((metric) => metric.rollupKey === "assessments_submitted")
    .map((metric) => ({
      label: formatLongDate(metric.periodStart.slice(0, 10)),
      count: metric.count,
      sortKey: metric.periodStart.slice(0, 10),
    }))
    .sort((a, b) => b.count - a.count || a.sortKey.localeCompare(b.sortKey))
    .slice(0, limit);
}

export function accuracyBadgeClassName(accuracy: number | null): string {
  if (accuracy == null) {
    return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)] border-[var(--admin-border)]";
  }
  if (accuracy >= ACCURACY_GOAL) {
    return "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)] border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))]";
  }
  if (accuracy >= 0.6) {
    return "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)] border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))]";
  }
  return "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)] border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))]";
}

export function formatAccuracyPercent(accuracy: number | null): string {
  if (accuracy == null) return "—";
  return `${String(Math.round(accuracy * 1000) / 10)}%`;
}

export function formatLatencySeconds(ms: number | null): string {
  if (ms == null) return "—";
  const seconds = ms / 1000;
  if (seconds < 10) return `${String(Math.round(seconds * 10) / 10)}s`;
  return `${String(Math.round(seconds))}s`;
}

export function formatDistractorRates(
  rates: Array<{ optionId: string; rate: number }> | null | undefined,
): string {
  if (!rates || rates.length === 0) return "—";
  return rates
    .map((entry) => `${entry.optionId.slice(0, 6)} ${String(Math.round(entry.rate * 1000) / 10)}%`)
    .join(" · ");
}

export function highlightRowKind(
  item: ItemStatisticRow,
  items: ItemStatisticRow[],
): "top" | "alert" | null {
  if (item.accuracy == null || item.attemptsCount < 5) return null;

  const ranked = items
    .filter((entry) => entry.accuracy != null && entry.attemptsCount >= 5)
    .sort((a, b) => b.accuracy! - a.accuracy!);

  if (ranked[0]?.itemReference.itemId === item.itemReference.itemId && item.accuracy! >= ACCURACY_GOAL) {
    return "top";
  }

  if (item.accuracy! < 0.5 && item.attemptsCount >= 10) {
    return "alert";
  }

  return null;
}

function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
}

function formatLongDate(isoDate: string): string {
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
