"use client";

import { clientApi } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";

export type ProgressScoreExportFormat = "csv" | "xlsx" | "json";
export type ProgressScoreExportDataset = "progress" | "scores" | "attempts" | "item_analysis";
export type ProgressScoreExportDelivery = "download" | "email_me" | "recipients";
export type ProgressScoreExportCadence = "daily" | "weekly" | "monthly";
export type ProgressScoreExportProductType =
  | "course"
  | "test_series"
  | "bundle"
  | "subscription"
  | "mock_test";
export type ProgressScoreExportStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export type ProgressScoreExportColumn = {
  key: string;
  label: string;
  sensitive: boolean;
  defaultSelected: boolean;
};

export type ProgressScoreExportHistoryItem = {
  id: string;
  fileName: string;
  format: "csv" | "xlsx" | "pdf" | "json";
  dataset: ProgressScoreExportDataset;
  datasetLabel: string;
  scopeLabel: string;
  rowCount: number | null;
  sizeLabel: string | null;
  status: ProgressScoreExportStatus;
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

export type ProgressScoreExportScheduleItem = {
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

export type ProgressScoreExportsPayload = {
  history: ProgressScoreExportHistoryItem[];
  schedules: ProgressScoreExportScheduleItem[];
  progressColumns: ProgressScoreExportColumn[];
  scoreColumns: ProgressScoreExportColumn[];
  capabilities: {
    formats: ProgressScoreExportFormat[];
    datasets: ProgressScoreExportDataset[];
    canSchedule: boolean;
    canEmailDelivery: boolean;
    canWebhookDelivery: boolean;
    note: string;
  };
};

export type CreateProgressScoreExportBody = {
  dataset: ProgressScoreExportDataset;
  columns: string[];
  format: ProgressScoreExportFormat;
  productType?: ProgressScoreExportProductType;
  productId?: string;
  courseId?: string;
  assessmentId?: string;
  dateFrom?: string;
  dateTo?: string;
  learnerName?: string;
  enrolledType?: string;
  status?: string;
  resultStatus?: "pass" | "fail" | "pending" | "in_progress";
  useCurrentFilters: boolean;
  delivery: ProgressScoreExportDelivery;
  recipients?: string[];
  webhookUrl?: string | null;
  scheduleEnabled: boolean;
  scheduleName?: string;
  cadence?: ProgressScoreExportCadence;
  time?: string;
  timezone?: string;
};

export async function fetchProgressScoreExports() {
  return clientApi.get<{ data: ProgressScoreExportsPayload }>(
    "/api/v1/reports/progress-score/exports",
  );
}

export async function createProgressScoreExport(body: CreateProgressScoreExportBody) {
  return clientApi.post<{
    data: {
      run: ProgressScoreExportHistoryItem;
      schedule: ProgressScoreExportScheduleItem | null;
    };
  }>("/api/v1/reports/progress-score/exports", body, "progress-score-export-create", {
    successMessage: "Export started.",
  });
}

export async function fetchProgressScoreExportRun(runId: string) {
  return clientApi.get<{ data: ProgressScoreExportHistoryItem }>(
    `/api/v1/reports/progress-score/exports/${runId}`,
  );
}

export async function retryProgressScoreExport(runId: string) {
  return clientApi.post<{ data: ProgressScoreExportHistoryItem }>(
    `/api/v1/reports/progress-score/exports/${runId}/retry`,
    null,
    "progress-score-export-retry",
    { successMessage: "Export retry started." },
  );
}

export async function updateProgressScoreExportSchedule(
  scheduleId: string,
  body: { isActive?: boolean; name?: string },
) {
  return clientApi.patch<{ data: ProgressScoreExportScheduleItem }>(
    `/api/v1/reports/progress-score/exports/schedules/${scheduleId}`,
    body,
    "progress-score-export-schedule-update",
    { successMessage: "Schedule updated." },
  );
}

export async function deleteProgressScoreExportSchedule(scheduleId: string) {
  return clientApi.delete<{ data: { deleted: true; id: string } }>(
    `/api/v1/reports/progress-score/exports/schedules/${scheduleId}`,
    "progress-score-export-schedule-delete",
    undefined,
    { successMessage: "Schedule deleted." },
  );
}

export async function downloadProgressScoreExport(run: ProgressScoreExportHistoryItem) {
  const format = run.format === "pdf" ? "csv" : run.format;
  await downloadReportExport(run.id, format);
}

export function isScoreLikeDataset(dataset: ProgressScoreExportDataset): boolean {
  return dataset === "scores" || dataset === "attempts" || dataset === "item_analysis";
}
