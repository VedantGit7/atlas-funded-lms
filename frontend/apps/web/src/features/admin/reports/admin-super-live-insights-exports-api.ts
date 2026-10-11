"use client";

import {
  createReportExportsApi,
  type ReportExportCadence,
  type ReportExportFormat,
  type ReportExportHistoryItem,
  type ReportExportScheduleItem,
  type ReportExportStatus,
} from "./admin-report-exports-api";

export type SliExportFormat = ReportExportFormat;
export type SliExportDataset =
  | "session_metrics"
  | "trend_series"
  | "series_rollup"
  | "outlier_findings";
export type SliExportDelivery = "download" | "email_me" | "send_recipients";
export type SliExportCadence = ReportExportCadence;
export type SliExportDatePreset = "7d" | "30d" | "90d" | "custom";
export type SliExportScopeMode = "date_range" | "course" | "batch" | "sessions";
export type SliExportSeriesKind = "course" | "batch";
export type SliExportGranularity = "day" | "week" | "month";
export type SliExportStatus = ReportExportStatus;
export type SliExportColumn =
  | "title"
  | "status"
  | "course_title"
  | "batch_name"
  | "scheduled_at"
  | "started_at"
  | "ended_at"
  | "duration_seconds"
  | "attended_count"
  | "registered_count"
  | "absent_count"
  | "total_count"
  | "avg_duration_seconds"
  | "attendance_rate"
  | "tenant_avg_rate"
  | "course_avg_rate";

export type SliExportHistoryItem = ReportExportHistoryItem<SliExportDataset> & {
  requestedByLabel: string;
};

export type SliExportScheduleItem = ReportExportScheduleItem & {
  dataset: SliExportDataset;
};

export type SuperLiveInsightsExportsPayload = {
  history: SliExportHistoryItem[];
  schedules: SliExportScheduleItem[];
  capabilities: {
    formats: SliExportFormat[];
    datasets: SliExportDataset[];
    columns: SliExportColumn[];
    canSchedule: boolean;
    canEmailDelivery: boolean;
    note: string;
  };
  estimates: {
    sessionMetricsRows: number | null;
    outlierFindingsRows: number | null;
  };
};

export type CreateSliExportBody = {
  dataset: SliExportDataset;
  format: SliExportFormat;
  scopeMode: SliExportScopeMode;
  datePreset: SliExportDatePreset;
  startedFrom?: string | undefined;
  startedTo?: string | undefined;
  courseId?: string | undefined;
  batchId?: string | undefined;
  sessionIds?: string[] | undefined;
  columns?: SliExportColumn[] | undefined;
  includeBenchmarks: boolean;
  granularity: SliExportGranularity;
  seriesKind: SliExportSeriesKind;
  filterSummary?: string | undefined;
  delivery: SliExportDelivery;
  recipients?: string[] | undefined;
  webhookUrl?: string | undefined;
  scheduleEnabled: boolean;
  scheduleName?: string | undefined;
  cadence?: SliExportCadence | undefined;
  time?: string | undefined;
  timezone?: string | undefined;
};

export const superLiveInsightsExportsApi = createReportExportsApi<{
  payload: SuperLiveInsightsExportsPayload;
  createBody: CreateSliExportBody;
}>(
  {
    exports: "/api/v1/reports/super-live-insights/exports",
    run: (runId) => `/api/v1/reports/super-live-insights/exports/${runId}`,
    retry: (runId) => `/api/v1/reports/super-live-insights/exports/${runId}/retry`,
    schedule: (scheduleId) => `/api/v1/reports/super-live-insights/exports/schedules/${scheduleId}`,
  },
  "sli",
);
