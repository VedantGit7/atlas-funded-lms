"use client";

import { clientApi } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";

export type RuExportFormat = "csv" | "xlsx" | "json";
export type RuExportDataset =
  | "meter_snapshot"
  | "metric_history"
  | "storage_breakdown"
  | "inactive_learners"
  | "dormant_content";
export type RuExportDelivery = "download" | "email_me" | "send_recipients";
export type RuExportCadence = "daily" | "weekly" | "monthly";
export type RuExportDatePreset = "7d" | "30d" | "90d" | "custom";
export type RuExportScopeMode = "all" | "metric" | "search";
export type RuExportStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
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

export type RuExportHistoryItem = {
  id: string;
  fileName: string;
  format: "csv" | "xlsx" | "pdf" | "json";
  dataset: RuExportDataset;
  datasetLabel: string;
  scopeLabel: string;
  rowCount: number | null;
  sizeLabel: string | null;
  requestedByLabel: string;
  status: RuExportStatus;
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

export type RuExportScheduleItem = {
  id: string;
  name: string;
  dataset: RuExportDataset;
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

export async function fetchResourceUsageExports() {
  return clientApi.get<{ data: ResourceUsageExportsPayload }>(
    "/api/v1/reports/resource-usage/exports",
  );
}

export async function createResourceUsageExport(body: CreateRuExportBody) {
  return clientApi.post<{
    data: {
      run: RuExportHistoryItem;
      schedule: RuExportScheduleItem | null;
    };
  }>("/api/v1/reports/resource-usage/exports", body, "ru-export-create", {
    successMessage: "Export started.",
  });
}

export async function fetchResourceUsageExportRun(runId: string) {
  return clientApi.get<{ data: RuExportHistoryItem }>(
    `/api/v1/reports/resource-usage/exports/${runId}`,
  );
}

export async function retryResourceUsageExport(runId: string) {
  return clientApi.post<{ data: RuExportHistoryItem }>(
    `/api/v1/reports/resource-usage/exports/${runId}/retry`,
    null,
    "ru-export-retry",
    { successMessage: "Export retry started." },
  );
}

export async function updateResourceUsageExportSchedule(
  scheduleId: string,
  body: { isActive?: boolean | undefined; name?: string | undefined },
) {
  return clientApi.patch<{ data: RuExportScheduleItem }>(
    `/api/v1/reports/resource-usage/exports/schedules/${scheduleId}`,
    body,
    "ru-export-schedule-update",
    { successMessage: "Schedule updated." },
  );
}

export async function deleteResourceUsageExportSchedule(scheduleId: string) {
  return clientApi.delete<{ data: { deleted: true; id: string } }>(
    `/api/v1/reports/resource-usage/exports/schedules/${scheduleId}`,
    "ru-export-schedule-delete",
    undefined,
    { successMessage: "Schedule deleted." },
  );
}

export async function runResourceUsageExportScheduleNow(scheduleId: string) {
  return clientApi.post<{
    data: {
      run: RuExportHistoryItem;
      schedule: RuExportScheduleItem | null;
    };
  }>(
    `/api/v1/reports/resource-usage/exports/schedules/${scheduleId}`,
    null,
    "ru-export-schedule-run-now",
    { successMessage: "Schedule run started." },
  );
}

export async function downloadResourceUsageExport(
  runId: string,
  format: "csv" | "xlsx" | "pdf" | "json",
) {
  const resolvedFormat = format === "pdf" ? "csv" : format;
  return downloadReportExport(runId, resolvedFormat);
}
