"use client";

import { clientApi } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";

export type SliExportFormat = "csv" | "xlsx" | "json";
export type SliExportDataset =
  | "session_metrics"
  | "trend_series"
  | "series_rollup"
  | "outlier_findings";
export type SliExportDelivery = "download" | "email_me" | "send_recipients";
export type SliExportCadence = "daily" | "weekly" | "monthly";
export type SliExportDatePreset = "7d" | "30d" | "90d" | "custom";
export type SliExportScopeMode = "date_range" | "course" | "batch" | "sessions";
export type SliExportSeriesKind = "course" | "batch";
export type SliExportGranularity = "day" | "week" | "month";
export type SliExportStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
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

export type SliExportHistoryItem = {
  id: string;
  fileName: string;
  format: "csv" | "xlsx" | "pdf" | "json";
  dataset: SliExportDataset;
  datasetLabel: string;
  scopeLabel: string;
  rowCount: number | null;
  sizeLabel: string | null;
  requestedByLabel: string;
  status: SliExportStatus;
  expired: boolean;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorTrace: string[] | null;
  progressPercent: number | null;
  downloadAvailable: boolean;
};

export type SliExportScheduleItem = {
  id: string;
  name: string;
  dataset: SliExportDataset;
  datasetLabel: string;
  cadenceLabel: string;
  cronExpression: string;
  timezone: string;
  formats: Array<"csv" | "xlsx" | "pdf" | "json">;
  isActive: boolean;
  nextRunAt: string;
  nextRunLabel: string;
  recipients: string[];
  delivery: Record<string, unknown> | null;
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

export async function fetchSuperLiveInsightsExports() {
  return clientApi.get<{ data: SuperLiveInsightsExportsPayload }>(
    "/api/v1/reports/super-live-insights/exports",
  );
}

export async function createSuperLiveInsightsExport(body: CreateSliExportBody) {
  return clientApi.post<{
    data: {
      run: SliExportHistoryItem;
      schedule: SliExportScheduleItem | null;
    };
  }>("/api/v1/reports/super-live-insights/exports", body, "sli-export-create", {
    successMessage: "Export started.",
  });
}

export async function fetchSuperLiveInsightsExportRun(runId: string) {
  return clientApi.get<{ data: SliExportHistoryItem }>(
    `/api/v1/reports/super-live-insights/exports/${runId}`,
  );
}

export async function retrySuperLiveInsightsExport(
  runId: string,
  body?: { format?: SliExportFormat },
) {
  return clientApi.post<{ data: SliExportHistoryItem }>(
    `/api/v1/reports/super-live-insights/exports/${runId}/retry`,
    body ?? null,
    "sli-export-retry",
    { successMessage: "Export retry started." },
  );
}

export async function updateSuperLiveInsightsExportSchedule(
  scheduleId: string,
  body: { isActive?: boolean | undefined; name?: string | undefined },
) {
  return clientApi.patch<{ data: SliExportScheduleItem }>(
    `/api/v1/reports/super-live-insights/exports/schedules/${scheduleId}`,
    body,
    "sli-export-schedule-update",
    { successMessage: "Schedule updated." },
  );
}

export async function deleteSuperLiveInsightsExportSchedule(scheduleId: string) {
  return clientApi.delete<{ data: { deleted: true; id: string } }>(
    `/api/v1/reports/super-live-insights/exports/schedules/${scheduleId}`,
    "sli-export-schedule-delete",
    undefined,
    { successMessage: "Schedule deleted." },
  );
}

export async function runSuperLiveInsightsExportScheduleNow(scheduleId: string) {
  return clientApi.post<{
    data: {
      run: SliExportHistoryItem;
      schedule: SliExportScheduleItem | null;
    };
  }>(
    `/api/v1/reports/super-live-insights/exports/schedules/${scheduleId}`,
    null,
    "sli-export-schedule-run-now",
    { successMessage: "Schedule run started." },
  );
}

export async function downloadSuperLiveInsightsExport(item: SliExportHistoryItem) {
  const format = item.format === "pdf" ? "csv" : item.format;
  return downloadReportExport(item.id, format);
}
