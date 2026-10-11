"use client";

import {
  createReportExportsApi,
  type ReportExportCadence,
  type ReportExportFormat,
  type ReportExportHistoryItem,
  type ReportExportScheduleItem,
  type ReportExportStatus,
} from "./admin-report-exports-api";

export type LcaExportFormat = ReportExportFormat;
export type LcaExportDataset = "sessions" | "attendees" | "learner_summary" | "series_rollup";
export type LcaExportDelivery = "download" | "email_me" | "send_recipients";
export type LcaExportCadence = ReportExportCadence;
export type LcaExportDatePreset = "7d" | "30d" | "90d" | "custom";
export type LcaExportScopeMode = "date_range" | "course" | "batch" | "sessions";
export type LcaExportRegistrationMode = "include_never_joined" | "attendees_only";
export type LcaExportStatus = ReportExportStatus;
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

export type LcaExportHistoryItem = ReportExportHistoryItem<LcaExportDataset> & {
  requestedByLabel: string;
};

export type LcaExportScheduleItem = ReportExportScheduleItem & {
  dataset: LcaExportDataset;
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

export const liveClassAttendanceExportsApi = createReportExportsApi<{
  payload: LiveClassAttendanceExportsPayload;
  createBody: CreateLcaExportBody;
}>(
  {
    exports: "/api/v1/reports/live-class-attendance/exports",
    run: (runId) => `/api/v1/reports/live-class-attendance/exports/${runId}`,
    retry: (runId) => `/api/v1/reports/live-class-attendance/exports/${runId}/retry`,
    schedule: (scheduleId) =>
      `/api/v1/reports/live-class-attendance/exports/schedules/${scheduleId}`,
  },
  "lca",
);
