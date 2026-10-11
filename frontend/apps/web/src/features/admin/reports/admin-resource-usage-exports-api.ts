"use client";

import {
  createReportExportsApi,
  type ReportExportCadence,
  type ReportExportFormat,
  type ReportExportHistoryItem,
  type ReportExportScheduleItem,
  type ReportExportStatus,
} from "./admin-report-exports-api";

export type RuExportFormat = ReportExportFormat;
export type RuExportDataset =
  | "meter_snapshot"
  | "metric_history"
  | "storage_breakdown"
  | "inactive_learners"
  | "dormant_content";
export type RuExportDelivery = "download" | "email_me" | "send_recipients";
export type RuExportCadence = ReportExportCadence;
export type RuExportDatePreset = "7d" | "30d" | "90d" | "custom";
export type RuExportScopeMode = "all" | "metric" | "search";
export type RuExportStatus = ReportExportStatus;
export type RuExportColumn =
  | "metric_key"
  | "metric_label"
  | "period"
  | "value"
  | "unit"
  | "calculated_at"
  | "resource_type"
  | "object_count"
  | "storage_gb"
  | "course_id"
  | "title"
  | "status"
  | "lesson_count"
  | "last_learner_activity_at"
  | "created_at"
  | "membership_id"
  | "learner_name"
  | "email"
  | "last_active_at";

export type RuExportHistoryItem = ReportExportHistoryItem<RuExportDataset> & {
  requestedByLabel: string;
};

export type RuExportScheduleItem = ReportExportScheduleItem & {
  dataset: RuExportDataset;
};

export type ResourceUsageExportsPayload = {
  history: RuExportHistoryItem[];
  schedules: RuExportScheduleItem[];
  capabilities: {
    formats: RuExportFormat[];
    datasets: RuExportDataset[];
    columns: RuExportColumn[];
    canSchedule: boolean;
    canEmailDelivery: boolean;
    note: string;
    unmeteredNote: string;
  };
  estimates: {
    meterSnapshotRows: number | null;
    inactiveLearnerRows: number | null;
  };
};

export type CreateRuExportBody = {
  dataset: RuExportDataset;
  format: RuExportFormat;
  scopeMode: RuExportScopeMode;
  datePreset: RuExportDatePreset;
  startedFrom?: string | undefined;
  startedTo?: string | undefined;
  metricKey?: string | undefined;
  q?: string | undefined;
  columns?: RuExportColumn[] | undefined;
  filterSummary?: string | undefined;
  delivery: RuExportDelivery;
  recipients?: string[] | undefined;
  webhookUrl?: string | undefined;
  scheduleEnabled: boolean;
  scheduleName?: string | undefined;
  cadence?: RuExportCadence | undefined;
  time?: string | undefined;
  timezone?: string | undefined;
};

export const resourceUsageExportsApi = createReportExportsApi<{
  payload: ResourceUsageExportsPayload;
  createBody: CreateRuExportBody;
}>(
  {
    exports: "/api/v1/reports/resource-usage/exports",
    run: (runId) => `/api/v1/reports/resource-usage/exports/${runId}`,
    retry: (runId) => `/api/v1/reports/resource-usage/exports/${runId}/retry`,
    schedule: (scheduleId) => `/api/v1/reports/resource-usage/exports/schedules/${scheduleId}`,
  },
  "ru",
);
