import type {
  LiveDashboardSessionsLedgerRow,
  LiveDashboardSessionsSnapshot,
} from "./insights.repository";

export const LIVE_SESSIONS_ATTENDANCE_HREF = "/admin/reports/live-class-attendance";
export const LIVE_SESSIONS_OPS_HREF = "/admin/live-sessions";
export const LIVE_SESSIONS_THRESHOLD = 50;

export type InsightLiveSessionsView = "all" | "low-turnout" | "upcoming" | "live";

export type InsightLiveSessionsStatusFilter = "all" | "live" | "scheduled" | "ended" | "cancelled";

export type InsightLiveSessionsTurnoutFilter = "all" | "below-50" | "above-50" | "no-roster";

export type InsightLiveSessionsWatchFilter = "all" | "short" | "long";

export type InsightLiveSessionsSort =
  | "scheduled_desc"
  | "scheduled_asc"
  | "rate_asc"
  | "rate_desc"
  | "attended_desc";

export type InsightLiveSessionsQuery = {
  view: InsightLiveSessionsView;
  q: string;
  status: InsightLiveSessionsStatusFilter;
  turnout: InsightLiveSessionsTurnoutFilter;
  watch: InsightLiveSessionsWatchFilter;
  sort: InsightLiveSessionsSort;
  page: number;
  pageSize: number;
};

export type InsightLiveSessionsRow = {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  attendedCount: number;
  registeredCount: number;
  rosteredCount: number;
  attendanceRate: number | null;
  avgWatchMinutes: number | null;
  durationMinutes: number | null;
  batchId: string | null;
  batchLabel: string | null;
  courseLabel: string | null;
  href: string;
  accent: "live" | "low" | "none";
  selectable: boolean;
};

export type InsightLiveSessionsHistogramBucket = {
  id: string;
  label: string;
  from: number;
  to: number;
  count: number;
  belowThreshold: boolean;
};

export type InsightLiveSessionsBoard = {
  slug: "live-dashboard";
  title: string;
  generatedAt: string;
  days: number;
  windowLabel: string;
  caveat: string;
  empty: boolean;
  allHealthy: boolean;
  attendanceHref: string;
  sessionsHref: string;
  dashboardHref: string;
  nowHref: string;
  query: InsightLiveSessionsQuery;
  summary: {
    sessionCount: number;
    endedCount: number;
    upcomingCount: number;
    liveCount: number;
    cancelledCount: number;
    attendanceRate: number;
    below50Count: number;
    endedWithRosterCount: number;
    avgWatchMinutes: number;
    totalWatchHours: number;
  };
  histogram: {
    buckets: InsightLiveSessionsHistogramBucket[];
    maxCount: number;
    median: number | null;
    mean: number | null;
    belowThresholdCount: number;
    belowThresholdSharePct: number | null;
    caption: string;
  };
  sessions: InsightLiveSessionsRow[];
  totalFiltered: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function sessionHref(batchId: string | null, sessionId: string): string {
  if (batchId) {
    return `/admin/reports/batches/${batchId}/live-sessions/${sessionId}`;
  }
  return LIVE_SESSIONS_OPS_HREF;
}

function statusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "Ended";
  if (normalized === "live") return "Live";
  if (normalized === "scheduled") return "Scheduled";
  if (normalized === "cancelled") return "Cancelled";
  if (normalized === "ended") return "Ended";
  return status;
}

function normalizeStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "ended";
  return normalized;
}

function mapRow(row: LiveDashboardSessionsLedgerRow): InsightLiveSessionsRow {
  const normalized = normalizeStatus(row.status);
  const accent: InsightLiveSessionsRow["accent"] =
    normalized === "live"
      ? "live"
      : row.attendanceRate != null && row.attendanceRate < LIVE_SESSIONS_THRESHOLD
        ? "low"
        : "none";

  return {
    id: row.id,
    title: row.title,
    status: normalized,
    statusLabel: statusLabel(row.status),
    scheduledAt: row.scheduledAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    attendedCount: row.attendedCount,
    registeredCount: row.registeredCount,
    rosteredCount: row.rosteredCount,
    attendanceRate: row.attendanceRate,
    avgWatchMinutes: row.avgWatchMinutes,
    durationMinutes: row.durationMinutes,
    batchId: row.batchId,
    batchLabel: row.batchKey ?? row.batchName,
    courseLabel: row.courseSlug ?? row.courseTitle,
    href: sessionHref(row.batchId, row.id),
    accent,
    selectable: true,
  };
}

function matchesView(row: InsightLiveSessionsRow, view: InsightLiveSessionsView): boolean {
  switch (view) {
    case "all":
      return true;
    case "live":
      return row.status === "live";
    case "upcoming":
      return row.status === "scheduled";
    case "low-turnout":
      return (
        row.status === "ended" &&
        row.attendanceRate != null &&
        row.attendanceRate < LIVE_SESSIONS_THRESHOLD
      );
  }
}

function matchesStatus(
  row: InsightLiveSessionsRow,
  status: InsightLiveSessionsStatusFilter,
): boolean {
  if (status === "all") return true;
  return row.status === status;
}

function matchesTurnout(
  row: InsightLiveSessionsRow,
  turnout: InsightLiveSessionsTurnoutFilter,
): boolean {
  switch (turnout) {
    case "all":
      return true;
    case "no-roster":
      return row.rosteredCount <= 0;
    case "below-50":
      return row.attendanceRate != null && row.attendanceRate < LIVE_SESSIONS_THRESHOLD;
    case "above-50":
      return row.attendanceRate != null && row.attendanceRate >= LIVE_SESSIONS_THRESHOLD;
  }
}

function matchesWatch(row: InsightLiveSessionsRow, watch: InsightLiveSessionsWatchFilter): boolean {
  switch (watch) {
    case "all":
      return true;
    case "short":
      return row.avgWatchMinutes != null && row.avgWatchMinutes < 30;
    case "long":
      return row.avgWatchMinutes != null && row.avgWatchMinutes >= 30;
  }
}

function matchesQuery(row: InsightLiveSessionsRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.title.toLowerCase().includes(needle) ||
    (row.batchLabel?.toLowerCase().includes(needle) ?? false) ||
    (row.courseLabel?.toLowerCase().includes(needle) ?? false)
  );
}

function sortKey(iso: string | null): number {
  if (!iso) return 0;
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function sortRows(
  rows: InsightLiveSessionsRow[],
  sort: InsightLiveSessionsSort,
): InsightLiveSessionsRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "scheduled_asc") {
      return sortKey(a.scheduledAt ?? a.startedAt) - sortKey(b.scheduledAt ?? b.startedAt);
    }
    if (sort === "rate_asc") {
      return (a.attendanceRate ?? -1) - (b.attendanceRate ?? -1);
    }
    if (sort === "rate_desc") {
      return (b.attendanceRate ?? -1) - (a.attendanceRate ?? -1);
    }
    if (sort === "attended_desc") {
      return b.attendedCount - a.attendedCount;
    }
    return sortKey(b.scheduledAt ?? b.startedAt) - sortKey(a.scheduledAt ?? a.startedAt);
  });
  return copy;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const left = sorted[mid - 1];
    const right = sorted[mid];
    if (left === undefined || right === undefined) return null;
    return Math.round(((left + right) / 2) * 10) / 10;
  }
  const value = sorted[mid];
  return value === undefined ? null : value;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

function buildHistogram(rates: number[]): {
  buckets: InsightLiveSessionsHistogramBucket[];
  maxCount: number;
  median: number | null;
  mean: number | null;
  belowThresholdCount: number;
  belowThresholdSharePct: number | null;
  caption: string;
} {
  const buckets: InsightLiveSessionsHistogramBucket[] = Array.from({ length: 10 }, (_, index) => {
    const from = index * 10;
    const to = from + 10;
    return {
      id: `${from}-${to}`,
      label: `${from}-${to}%`,
      from,
      to,
      count: 0,
      belowThreshold: to <= LIVE_SESSIONS_THRESHOLD,
    };
  });

  for (const rate of rates) {
    const clamped = Math.max(0, Math.min(100, rate));
    const index = clamped >= 100 ? 9 : Math.floor(clamped / 10);
    const bucket = buckets[index];
    if (bucket) bucket.count += 1;
  }

  const maxCount = Math.max(0, ...buckets.map((bucket) => bucket.count));
  const belowThresholdCount = rates.filter((rate) => rate < LIVE_SESSIONS_THRESHOLD).length;
  const belowThresholdSharePct =
    rates.length > 0 ? Math.round((belowThresholdCount / rates.length) * 100) : null;

  let caption: string;
  if (rates.length === 0) {
    caption = "No ended sessions with roster in this window yet.";
  } else if (belowThresholdCount === 0) {
    caption = `Every ended session cleared the ${LIVE_SESSIONS_THRESHOLD}% turnout threshold.`;
  } else {
    caption = `${String(belowThresholdCount)} session${belowThresholdCount === 1 ? "" : "s"} (${String(belowThresholdSharePct ?? 0)}%) fell below the ${String(LIVE_SESSIONS_THRESHOLD)}% target threshold.`;
  }

  return {
    buckets,
    maxCount,
    median: median(rates),
    mean: mean(rates),
    belowThresholdCount,
    belowThresholdSharePct,
    caption,
  };
}

export function buildInsightLiveSessions(
  snapshot: LiveDashboardSessionsSnapshot,
  query: InsightLiveSessionsQuery,
  generatedAt = new Date().toISOString(),
): InsightLiveSessionsBoard {
  const mapped = snapshot.sessions.map(mapRow);
  const filtered = sortRows(
    mapped.filter(
      (row) =>
        matchesView(row, query.view) &&
        matchesStatus(row, query.status) &&
        matchesTurnout(row, query.turnout) &&
        matchesWatch(row, query.watch) &&
        matchesQuery(row, query.q),
    ),
    query.sort,
  );

  const pageSize = Math.max(1, Math.min(50, query.pageSize));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  const empty = snapshot.summary.sessionCount <= 0;
  const allHealthy =
    !empty && snapshot.summary.endedWithRosterCount > 0 && snapshot.summary.below50Count === 0;

  return {
    slug: "live-dashboard",
    title: "Sessions",
    generatedAt,
    days: snapshot.days,
    windowLabel: `Last ${snapshot.days} days`,
    caveat:
      "Per-session analytics and comparison live in Live Class Attendance. This ledger is a windowed snapshot - refresh after ops changes.",
    empty,
    allHealthy,
    attendanceHref: LIVE_SESSIONS_ATTENDANCE_HREF,
    sessionsHref: LIVE_SESSIONS_OPS_HREF,
    dashboardHref: "/admin/insights/live-dashboard",
    nowHref: "/admin/insights/live-dashboard/now",
    query: { ...query, page, pageSize },
    summary: snapshot.summary,
    histogram: buildHistogram(snapshot.ratesForHistogram),
    sessions: pageRows,
    totalFiltered: filtered.length,
    page,
    pageSize,
    pageCount,
  };
}
