export const INSIGHT_DASHBOARD_RANGES = ["12m", "30d", "ytd"] as const;

export type InsightDashboardRange = (typeof INSIGHT_DASHBOARD_RANGES)[number];

export type InsightRangeWindow = {
  range: InsightDashboardRange;
  grain: "day" | "month";
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
};

export function isInsightDashboardRange(value: string): value is InsightDashboardRange {
  return (INSIGHT_DASHBOARD_RANGES as readonly string[]).includes(value);
}

export function resolveInsightRangeWindow(
  range: InsightDashboardRange,
  now = new Date(),
): InsightRangeWindow {
  const to = now;

  if (range === "30d") {
    const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
    const previousTo = new Date(from.getTime());
    const previousFrom = new Date(previousTo.getTime() - 29 * 24 * 60 * 60 * 1000);
    return { range, grain: "day", from, to, previousFrom, previousTo };
  }

  if (range === "ytd") {
    const from = new Date(Date.UTC(to.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    const elapsedMs = Math.max(to.getTime() - from.getTime(), 24 * 60 * 60 * 1000);
    const previousTo = new Date(from.getTime());
    const previousFrom = new Date(previousTo.getTime() - elapsedMs);
    return { range, grain: "month", from, to, previousFrom, previousTo };
  }

  const from = new Date(to.getTime());
  from.setUTCMonth(from.getUTCMonth() - 11);
  from.setUTCDate(1);
  from.setUTCHours(0, 0, 0, 0);
  const previousTo = new Date(from.getTime());
  const previousFrom = new Date(previousTo.getTime());
  previousFrom.setUTCMonth(previousFrom.getUTCMonth() - 12);
  return { range, grain: "month", from, to, previousFrom, previousTo };
}

export function insightRangeDayCount(range: InsightDashboardRange, now = new Date()): number {
  const window = resolveInsightRangeWindow(range, now);
  const fromUtc = Date.UTC(
    window.from.getUTCFullYear(),
    window.from.getUTCMonth(),
    window.from.getUTCDate(),
  );
  const toUtc = Date.UTC(
    window.to.getUTCFullYear(),
    window.to.getUTCMonth(),
    window.to.getUTCDate(),
  );
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((toUtc - fromUtc) / dayMs) + 1);
}

export function computeDeltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function computeDeltaAbs(current: number, previous: number): number {
  return current - previous;
}

/** SQL literals for `date_trunc` / `generate_series`. Never bind these as parameters. */
export function insightRangeBucketFragments(grain: InsightRangeWindow["grain"]): {
  truncFieldSql: string;
  intervalSql: string;
} {
  if (grain === "day") {
    return { truncFieldSql: "'day'", intervalSql: "interval '1 day'" };
  }
  return { truncFieldSql: "'month'", intervalSql: "interval '1 month'" };
}
