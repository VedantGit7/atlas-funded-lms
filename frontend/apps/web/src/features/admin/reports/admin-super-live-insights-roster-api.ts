"use client";

import { clientApi } from "../../../lib/client-api";

export const SUPER_LIVE_INSIGHT_COLUMN_OPTIONS = [
  { key: "title", label: "Live class" },
  { key: "status", label: "Status" },
  { key: "course_title", label: "Course" },
  { key: "batch_name", label: "Batch" },
  { key: "scheduled_at", label: "Scheduled" },
  { key: "started_at", label: "Started" },
  { key: "ended_at", label: "Ended" },
  { key: "duration_seconds", label: "Duration" },
  { key: "attended_count", label: "Attended" },
  { key: "registered_count", label: "Registered" },
  { key: "absent_count", label: "Absent" },
  { key: "total_count", label: "Total" },
  { key: "avg_duration_seconds", label: "Avg duration" },
  { key: "attendance_rate", label: "Attendance %" },
] as const;

export type SuperLiveInsightColumnKey = (typeof SUPER_LIVE_INSIGHT_COLUMN_OPTIONS)[number]["key"];

export type SuperLiveInsightItem = {
  id: string;
  title: string;
  status: string;
  courseId: string | null;
  courseTitle: string | null;
  batchId: string | null;
  batchName: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  attendedCount: number;
  registeredCount: number;
  absentCount: number;
  totalCount: number;
  avgDurationSeconds: number | null;
  attendanceRate: number | null;
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type SuperLiveInsightsSummary = {
  sessionCount: number;
  totalAttended: number;
  totalRegistered: number;
  totalAbsent: number;
  totalRecords: number;
  avgAttendanceRate: number | null;
  avgDurationSeconds: number | null;
};

export function dateInputToStartIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return `${trimmed}T00:00:00.000Z`;
}

export function dateInputToEndIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return `${trimmed}T23:59:59.999Z`;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchSuperLiveInsightsRoster(filters?: {
  q?: string | undefined;
  status?: string | undefined;
  courseId?: string | undefined;
  batchId?: string | undefined;
  startedFrom?: string | undefined;
  startedTo?: string | undefined;
  minAttended?: number | undefined;
  hasUnresolved?: boolean | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  columns?: SuperLiveInsightColumnKey[] | undefined;
  page?: number | undefined;
}) {
  return clientApi.get<{
    data: {
      items: SuperLiveInsightItem[];
      pageInfo: PageInfo;
      columns: string[];
      summary: SuperLiveInsightsSummary;
    };
  }>(
    `/api/v1/reports/super-live-insights${buildQuery({
      q: filters?.q,
      status: filters?.status,
      courseId: filters?.courseId,
      batchId: filters?.batchId,
      startedFrom: filters?.startedFrom,
      startedTo: filters?.startedTo,
      minAttended: filters?.minAttended,
      hasUnresolved: filters?.hasUnresolved === true ? "true" : undefined,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      columns: filters?.columns?.join(","),
      page: filters?.page ?? 1,
      limit: 50,
    })}`,
  );
}

export type SuperLiveInsightContext = {
  courseAvgAttendanceRate: number | null;
  tenantAvgAttendanceRate: number | null;
  courseRateP25: number | null;
  courseRateP75: number | null;
  courseAvgDurationSeconds: number | null;
  durationCoveragePct: number | null;
  rateDeltaVsCourse: number | null;
  courseRankCaption: string | null;
  estimatedTurnout: number | null;
  cancelledAt: string | null;
  series: Array<{
    id: string;
    title: string;
    scheduledAt: string | null;
    attendanceRate: number | null;
    isCurrent: boolean;
  }>;
  trend: Array<{
    id: string | null;
    title: string;
    label: string;
    attendanceRate: number | null;
    isCurrent: boolean;
    isFuture: boolean;
  }>;
  trendDeltaPoints: number | null;
};

export async function fetchSuperLiveInsightDetail(sessionId: string) {
  return clientApi.get<{
    data: {
      session: SuperLiveInsightItem;
      context: SuperLiveInsightContext;
    };
  }>(`/api/v1/reports/super-live-insights/${sessionId}`);
}

export async function exportSuperLiveInsightsReport(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/super-live-insights/export",
    body,
    "super-live-insights-roster-export",
    { successMessage: "Super Live Insights export queued." },
  );
}

export type SuperLiveInsightsGranularity = "day" | "week" | "month";
export type SuperLiveInsightsBreakDownBy = "none" | "course" | "batch" | "status";

export type SuperLiveInsightsTrendsPeriod = {
  key: string;
  label: string;
  from: string;
  to: string;
  sessionCount: number;
  attendedCount: number;
  registeredCount: number;
  absentCount: number;
  totalCount: number;
  attendanceRate: number | null;
  avgDurationSeconds: number | null;
  hasSessions: boolean;
  segments: Array<{
    key: string;
    label: string;
    sessionCount: number;
    attendedCount: number;
    registeredCount: number;
    absentCount: number;
    totalCount: number;
    attendanceRate: number | null;
  }>;
};

export type SuperLiveInsightsTrendsData = {
  granularity: SuperLiveInsightsGranularity;
  breakDownBy: SuperLiveInsightsBreakDownBy;
  range: { from: string; to: string };
  summary: {
    attendanceRate: number | null;
    attendanceRateDeltaPts: number | null;
    sessionCount: number;
    sessionCountDelta: number | null;
    totalAttended: number;
    totalAttendedDelta: number | null;
    avgDurationSeconds: number | null;
    avgDurationSecondsDelta: number | null;
    bestPeriod: {
      label: string;
      from: string;
      to: string;
      attendanceRate: number;
    } | null;
  };
  periods: SuperLiveInsightsTrendsPeriod[];
  rangeAverageRate: number | null;
  largestMovement: {
    fromLabel: string;
    toLabel: string;
    deltaPts: number;
    caption: string;
  } | null;
  compositionCaption: string | null;
  dayTimeMatrix: {
    days: string[];
    bands: string[];
    cells: Array<{
      dayIndex: number;
      bandIndex: number;
      dayLabel: string;
      bandLabel: string;
      sessionCount: number;
      attendanceRate: number | null;
    }>;
    dayAverages: Array<number | null>;
    bandAverages: Array<number | null>;
    bestSlotCaption: string | null;
    worstSlotCaption: string | null;
    slotsRanked: Array<{
      dayLabel: string;
      bandLabel: string;
      sessionCount: number;
      attendanceRate: number | null;
    }>;
  };
  byCourse: Array<{
    id: string;
    title: string;
    sessionCount: number;
    attendanceRate: number | null;
    deltaVsTenantPts: number | null;
    sparkline: Array<number | null>;
  }>;
  byBatch: Array<{
    id: string;
    title: string;
    sessionCount: number;
    attendanceRate: number | null;
    deltaVsTenantPts: number | null;
    sparkline: Array<number | null>;
  }>;
};

export async function fetchSuperLiveInsightsTrends(filters: {
  startedFrom: string;
  startedTo: string;
  granularity?: SuperLiveInsightsGranularity;
  breakDownBy?: SuperLiveInsightsBreakDownBy;
}) {
  return clientApi.get<{ data: SuperLiveInsightsTrendsData }>(
    `/api/v1/reports/super-live-insights/trends${buildQuery({
      startedFrom: filters.startedFrom,
      startedTo: filters.startedTo,
      granularity: filters.granularity ?? "week",
      breakDownBy: filters.breakDownBy ?? "none",
    })}`,
  );
}

export type SuperLiveInsightsCompareMode = "sessions" | "series";
export type SuperLiveInsightsSeriesKind = "course" | "batch";

export type SuperLiveInsightsCompareItem = {
  id: string;
  title: string;
  subtitle: string | null;
  scheduledAt: string | null;
  courseTitle: string | null;
  batchName: string | null;
  colorIndex: number;
  metrics: {
    totalRecords: number;
    attendedCount: number;
    registeredCount: number;
    absentCount: number;
    attendanceRate: number | null;
    avgDurationSeconds: number | null;
    sessionDurationSeconds: number | null;
    coveragePct: number | null;
    startDelaySeconds: number | null;
    scheduledSlot: string | null;
    sessionsHeld: number | null;
  };
  composition: {
    attendedCount: number;
    registeredCount: number;
    absentCount: number;
    totalCount: number;
  };
  trend?: Array<{
    index: number;
    label: string;
    attendanceRate: number | null;
  }>;
};

export type SuperLiveInsightsCompareData = {
  mode: SuperLiveInsightsCompareMode;
  seriesKind: SuperLiveInsightsSeriesKind | null;
  items: SuperLiveInsightsCompareItem[];
  tenantAverages: {
    attendanceRate: number | null;
    coveragePct: number | null;
    avgDurationSeconds: number | null;
  };
  compositionCaption: string | null;
};

export type SuperLiveInsightsCompareCandidate = {
  id: string;
  title: string;
  subtitle: string | null;
  groupLabel: string | null;
  scheduledAt: string | null;
  attendanceRate: number | null;
  sessionCount: number | null;
};

export async function fetchSuperLiveInsightsCompare(filters: {
  mode: SuperLiveInsightsCompareMode;
  ids: string[];
  seriesKind?: SuperLiveInsightsSeriesKind;
}) {
  return clientApi.get<{ data: SuperLiveInsightsCompareData }>(
    `/api/v1/reports/super-live-insights/compare${buildQuery({
      mode: filters.mode,
      ids: filters.ids.join(","),
      seriesKind: filters.seriesKind,
    })}`,
  );
}

export async function fetchSuperLiveInsightsCompareCandidates(filters: {
  mode: SuperLiveInsightsCompareMode;
  seriesKind?: SuperLiveInsightsSeriesKind;
  q?: string;
  excludeIds?: string[];
}) {
  return clientApi.get<{ data: { items: SuperLiveInsightsCompareCandidate[] } }>(
    `/api/v1/reports/super-live-insights/compare/candidates${buildQuery({
      mode: filters.mode,
      seriesKind: filters.seriesKind,
      q: filters.q,
      excludeIds: filters.excludeIds?.join(","),
      limit: 20,
    })}`,
  );
}

export type SuperLiveInsightsOutlierCategory =
  | "all"
  | "far_below"
  | "far_above"
  | "unresolved"
  | "no_records"
  | "short_duration"
  | "started_late";

export type SuperLiveInsightsOutlierSeverity = "notable" | "worth_checking" | "data_quality";

export type SuperLiveInsightsOutlierThresholds = {
  rateDeltaPts: number;
  unresolvedPct: number;
  shortDurationPct: number;
  lateStartMinutes: number;
  ignoreSmallSessions: boolean;
  minRecords: number;
};

export type SuperLiveInsightsOutlierFinding = {
  id: string;
  sessionId: string;
  category: Exclude<SuperLiveInsightsOutlierCategory, "all">;
  severity: SuperLiveInsightsOutlierSeverity;
  title: string;
  sessionTitle: string;
  courseTitle: string | null;
  batchName: string | null;
  scheduledAt: string | null;
  evidence: Array<{
    label: string;
    tone: "success" | "warning" | "danger" | "muted" | "ink";
  }>;
  composition: {
    attendedCount: number;
    registeredCount: number;
    absentCount: number;
    totalCount: number;
  };
  metrics: {
    attendanceRate: number | null;
    courseAvgRate: number | null;
    avgDurationSeconds: number | null;
    sessionDurationSeconds: number | null;
    startDelaySeconds: number | null;
  };
};

export type SuperLiveInsightsOutliersData = {
  category: SuperLiveInsightsOutlierCategory;
  thresholds: SuperLiveInsightsOutlierThresholds;
  counts: Record<SuperLiveInsightsOutlierCategory, number>;
  dataQualityRecordsAffected: number;
  findings: SuperLiveInsightsOutlierFinding[];
};

export const DEFAULT_OUTLIER_THRESHOLDS: SuperLiveInsightsOutlierThresholds = {
  rateDeltaPts: 20,
  unresolvedPct: 20,
  shortDurationPct: 25,
  lateStartMinutes: 15,
  ignoreSmallSessions: true,
  minRecords: 5,
};

export async function fetchSuperLiveInsightsOutliers(filters: {
  startedFrom: string;
  startedTo: string;
  category?: SuperLiveInsightsOutlierCategory;
  thresholds?: Partial<SuperLiveInsightsOutlierThresholds>;
}) {
  const t = filters.thresholds ?? {};
  return clientApi.get<{ data: SuperLiveInsightsOutliersData }>(
    `/api/v1/reports/super-live-insights/outliers${buildQuery({
      startedFrom: filters.startedFrom,
      startedTo: filters.startedTo,
      category: filters.category ?? "all",
      rateDeltaPts: t.rateDeltaPts,
      unresolvedPct: t.unresolvedPct,
      shortDurationPct: t.shortDurationPct,
      lateStartMinutes: t.lateStartMinutes,
      ignoreSmallSessions:
        t.ignoreSmallSessions === undefined ? undefined : t.ignoreSmallSessions ? "true" : "false",
      minRecords: t.minRecords,
    })}`,
  );
}

export async function previewSuperLiveInsightsOutliers(filters: {
  startedFrom: string;
  startedTo: string;
  thresholds: SuperLiveInsightsOutlierThresholds;
}) {
  const t = filters.thresholds;
  return clientApi.get<{
    data: { findingCount: number; thresholds: SuperLiveInsightsOutlierThresholds };
  }>(
    `/api/v1/reports/super-live-insights/outliers/preview${buildQuery({
      startedFrom: filters.startedFrom,
      startedTo: filters.startedTo,
      rateDeltaPts: t.rateDeltaPts,
      unresolvedPct: t.unresolvedPct,
      shortDurationPct: t.shortDurationPct,
      lateStartMinutes: t.lateStartMinutes,
      ignoreSmallSessions: t.ignoreSmallSessions ? "true" : "false",
      minRecords: t.minRecords,
    })}`,
  );
}
