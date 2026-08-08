"use client";

import { clientApi } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";

export type BatchExportFormat = "csv" | "xlsx" | "json";
export type BatchExportDataset =
  | "batch_summary"
  | "batch_learners"
  | "live_attendance"
  | "exams"
  | "content";
export type BatchExportDelivery = "download" | "email_me" | "recipients";
export type BatchExportCadence = "daily" | "weekly" | "monthly";
export type BatchExportGrouping = "none" | "batch" | "course" | "health";
export type BatchExportStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export type BatchExportColumn = {
  key: string;
  label: string;
  sensitive: boolean;
  defaultSelected: boolean;
};

export type BatchExportHistoryItem = {
  id: string;
  fileName: string;
  format: "csv" | "xlsx" | "pdf" | "json";
  dataset: BatchExportDataset;
  datasetLabel: string;
  scopeLabel: string;
  rowCount: number | null;
  sizeLabel: string | null;
  requestedByLabel: string;
  status: BatchExportStatus;
  expired: boolean;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorTrace: string[] | null;
  progressPercent: number | null;
  downloadAvailable: boolean;
  columns: string[];
};

export type BatchExportScheduleItem = {
  id: string;
  name: string;
  datasetLabel: string;
  cadenceLabel: string;
  cronExpression: string;
  timezone: string;
  formats: Array<"csv" | "xlsx" | "pdf" | "json">;
  isActive: boolean;
  nextRunAt: string;
  nextRunLabel: string;
  recipients: string[];
  webhookLabel: string | null;
  delivery: Record<string, unknown> | null;
};

export type BatchesExportsPayload = {
  history: BatchExportHistoryItem[];
  schedules: BatchExportScheduleItem[];
  summaryColumns: BatchExportColumn[];
  learnerColumns: BatchExportColumn[];
  capabilities: {
    formats: BatchExportFormat[];
    datasets: BatchExportDataset[];
    canSchedule: boolean;
    canEmailDelivery: boolean;
    canWebhookDelivery: boolean;
    note: string;
  };
};

export type CreateBatchExportBody = {
  dataset: BatchExportDataset;
  columns: string[];
  format: BatchExportFormat;
  batchIds?: string[];
  allActiveBatches?: boolean;
  joinedFrom?: string;
  joinedTo?: string;
  learnerName?: string;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  grouping?: BatchExportGrouping;
  includeSubtotals?: boolean;
  useCurrentFilters: boolean;
  filterSummary?: string;
  delivery: BatchExportDelivery;
  recipients?: string[];
  webhookUrl?: string | null;
  scheduleEnabled: boolean;
  scheduleName?: string;
  cadence?: BatchExportCadence;
  time?: string;
  timezone?: string;
};

export async function fetchBatchesExports() {
  return clientApi.get<{ data: BatchesExportsPayload }>(
    "/api/v1/reports/batches/exports",
  );
}

export async function createBatchExport(body: CreateBatchExportBody) {
  return clientApi.post<{
    data: {
      run: BatchExportHistoryItem;
      schedule: BatchExportScheduleItem | null;
    };
  }>("/api/v1/reports/batches/exports", body, "batches-export-create", {
    successMessage: "Export started.",
  });
}

export async function fetchBatchExportRun(runId: string) {
  return clientApi.get<{ data: BatchExportHistoryItem }>(
    `/api/v1/reports/batches/exports/${runId}`,
  );
}

export async function retryBatchExport(runId: string) {
  return clientApi.post<{ data: BatchExportHistoryItem }>(
    `/api/v1/reports/batches/exports/${runId}/retry`,
    null,
    "batches-export-retry",
    { successMessage: "Export retry started." },
  );
}

export async function updateBatchExportSchedule(
  scheduleId: string,
  body: { isActive?: boolean; name?: string },
) {
  return clientApi.patch<{ data: BatchExportScheduleItem }>(
    `/api/v1/reports/batches/exports/schedules/${scheduleId}`,
    body,
    "batches-export-schedule-update",
    { successMessage: "Schedule updated." },
  );
}

export async function deleteBatchExportSchedule(scheduleId: string) {
  return clientApi.delete<{ data: { deleted: true; id: string } }>(
    `/api/v1/reports/batches/exports/schedules/${scheduleId}`,
    "batches-export-schedule-delete",
    undefined,
    { successMessage: "Schedule deleted." },
  );
}

export async function downloadBatchExport(run: BatchExportHistoryItem) {
  const format = run.format === "pdf" ? "csv" : run.format;
  await downloadReportExport(run.id, format);
}

export function isSummaryDataset(dataset: BatchExportDataset): boolean {
  return dataset === "batch_summary";
}
