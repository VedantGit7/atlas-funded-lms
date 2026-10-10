"use client";

import {
  createReportExportsApi,
  type ReportExportCadence,
  type ReportExportCapabilities,
  type ReportExportColumn,
  type ReportExportDelivery,
  type ReportExportFormat,
  type ReportExportHistoryItem,
  type ReportExportScheduleItem,
  type ReportExportStatus,
} from "./admin-report-exports-api";

export type BatchExportFormat = ReportExportFormat;
export type BatchExportDataset =
  | "batch_summary"
  | "batch_learners"
  | "live_attendance"
  | "exams"
  | "content";
export type BatchExportDelivery = ReportExportDelivery;
export type BatchExportCadence = ReportExportCadence;
export type BatchExportGrouping = "none" | "batch" | "course" | "health";
export type BatchExportStatus = ReportExportStatus;

export type BatchExportColumn = ReportExportColumn;

export type BatchExportHistoryItem = ReportExportHistoryItem<BatchExportDataset> & {
  requestedByLabel: string;
};

export type BatchExportScheduleItem = ReportExportScheduleItem;

export type BatchesExportsPayload = {
  history: BatchExportHistoryItem[];
  schedules: BatchExportScheduleItem[];
  summaryColumns: BatchExportColumn[];
  learnerColumns: BatchExportColumn[];
  capabilities: ReportExportCapabilities<BatchExportDataset>;
};

export type CreateBatchExportBody = {
  dataset: BatchExportDataset;
  columns: string[];
  format: BatchExportFormat;
  batchIds?: string[] | undefined;
  allActiveBatches?: boolean | undefined;
  joinedFrom?: string | undefined;
  joinedTo?: string | undefined;
  learnerName?: string | undefined;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED" | undefined;
  grouping?: BatchExportGrouping | undefined;
  includeSubtotals?: boolean | undefined;
  useCurrentFilters: boolean;
  filterSummary?: string | undefined;
  delivery: BatchExportDelivery;
  recipients?: string[] | undefined;
  webhookUrl?: string | null | undefined;
  scheduleEnabled: boolean;
  scheduleName?: string | undefined;
  cadence?: BatchExportCadence | undefined;
  time?: string | undefined;
  timezone?: string | undefined;
};

export const batchesExportsApi = createReportExportsApi<{
  payload: BatchesExportsPayload;
  createBody: CreateBatchExportBody;
}>(
  {
    exports: "/api/v1/reports/batches/exports",
    run: (runId) => `/api/v1/reports/batches/exports/${runId}`,
    retry: (runId) => `/api/v1/reports/batches/exports/${runId}/retry`,
    schedule: (scheduleId) => `/api/v1/reports/batches/exports/schedules/${scheduleId}`,
  },
  "batches",
);

export function isSummaryDataset(dataset: BatchExportDataset): boolean {
  return dataset === "batch_summary";
}
