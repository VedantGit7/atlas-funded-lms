"use client";

import { clientApi } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";

export type LcaExportFormat = "csv" | "xlsx" | "json";
export type LcaExportDataset = "sessions" | "attendees" | "learner_summary" | "series_rollup";
export type LcaExportDelivery = "download" | "email_me" | "send_recipients";
export type LcaExportCadence = "daily" | "weekly" | "monthly";
export type LcaExportDatePreset = "7d" | "30d" | "90d" | "custom";
export type LcaExportScopeMode = "date_range" | "course" | "batch" | "sessions";
export type LcaExportRegistrationMode = "include_never_joined" | "attendees_only";
export type LcaExportStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type LcaExportColumn =
  | "learner_name"
  | "email"
  | "status"
  | "joined_at"
  | "left_at"
  | "duration_seconds"
  | "coverage_pct"
  | "batch_name"
  | "registered_at"
  | "session_title"
  | "course_title";

export type LcaExportHistoryItem = {
  id: string;
  fileName: string;
  format: "csv" | "xlsx" | "pdf" | "json";
  dataset: LcaExportDataset;
  datasetLabel: string;
  scopeLabel: string;
  rowCount: number | null;
  sizeLabel: string | null;
  requestedByLabel: string;
  status: LcaExportStatus;
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

export type LcaExportScheduleItem = {
  id: string;
  name: string;
  dataset: LcaExportDataset;
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

export type LiveClassAttendanceExportsPayload = {
  history: LcaExportHistoryItem[];
  schedules: LcaExportScheduleItem[];
  capabilities: {
    formats: LcaExportFormat[];
    datasets: LcaExportDataset[];
    columns: LcaExportColumn[];
    canSchedule: boolean;
    canEmailDelivery: boolean;
    note: string;
  };
  estimates: {
    includeNeverJoinedRows: number | null;
    attendeesOnlyRows: number | null;
  };
};

export type CreateLcaExportBody = {
  dataset: LcaExportDataset;
  format: LcaExportFormat;
  scopeMode: LcaExportScopeMode;
  datePreset: LcaExportDatePreset;
  scheduledFrom?: string | undefined;
  scheduledTo?: string | undefined;
  courseId?: string | undefined;
  batchId?: string | undefined;
  sessionIds?: string[] | undefined;
  columns?: LcaExportColumn[] | undefined;
  registrationMode: LcaExportRegistrationMode;
  filterSummary?: string | undefined;
  delivery: LcaExportDelivery;
  recipients?: string[] | undefined;
  webhookUrl?: string | undefined;
  scheduleEnabled: boolean;
  scheduleName?: string | undefined;
  cadence?: LcaExportCadence | undefined;
  time?: string | undefined;
  timezone?: string | undefined;
};

export async function fetchLiveClassAttendanceExports() {
  return clientApi.get<{ data: LiveClassAttendanceExportsPayload }>(
    "/api/v1/reports/live-class-attendance/exports",
  );
}

export async function createLiveClassAttendanceExport(body: CreateLcaExportBody) {
  return clientApi.post<{
    data: {
      run: LcaExportHistoryItem;
      schedule: LcaExportScheduleItem | null;
    };
  }>("/api/v1/reports/live-class-attendance/exports", body, "lca-export-create", {
    successMessage: "Export started.",
  });
}

export async function fetchLiveClassAttendanceExportRun(runId: string) {
  return clientApi.get<{ data: LcaExportHistoryItem }>(
    `/api/v1/reports/live-class-attendance/exports/${runId}`,
  );
}

export async function retryLiveClassAttendanceExport(runId: string) {
  return clientApi.post<{ data: LcaExportHistoryItem }>(
    `/api/v1/reports/live-class-attendance/exports/${runId}/retry`,
    null,
    "lca-export-retry",
    { successMessage: "Export retry started." },
  );
}

export async function updateLiveClassAttendanceExportSchedule(
  scheduleId: string,
  body: { isActive?: boolean | undefined; name?: string | undefined },
) {
  return clientApi.patch<{ data: LcaExportScheduleItem }>(
    `/api/v1/reports/live-class-attendance/exports/schedules/${scheduleId}`,
    body,
    "lca-export-schedule-update",
    { successMessage: "Schedule updated." },
  );
}

export async function deleteLiveClassAttendanceExportSchedule(scheduleId: string) {
  return clientApi.delete<{ data: { deleted: true; id: string } }>(
    `/api/v1/reports/live-class-attendance/exports/schedules/${scheduleId}`,
    "lca-export-schedule-delete",
    undefined,
    { successMessage: "Schedule deleted." },
  );
}

export async function runLiveClassAttendanceExportScheduleNow(scheduleId: string) {
  return clientApi.post<{
    data: {
      run: LcaExportHistoryItem;
      schedule: LcaExportScheduleItem | null;
    };
  }>(
    `/api/v1/reports/live-class-attendance/exports/schedules/${scheduleId}`,
    null,
    "lca-export-schedule-run-now",
    { successMessage: "Schedule run started." },
  );
}

export async function downloadLiveClassAttendanceExport(item: LcaExportHistoryItem) {
  const format = item.format === "pdf" ? "csv" : item.format;
  return downloadReportExport(item.id, format);
}
