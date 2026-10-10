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

export type ProgressScoreExportFormat = ReportExportFormat;
export type ProgressScoreExportDataset = "progress" | "scores" | "attempts" | "item_analysis";
export type ProgressScoreExportDelivery = ReportExportDelivery;
export type ProgressScoreExportCadence = ReportExportCadence;
export type ProgressScoreExportProductType =
  | "course"
  | "test_series"
  | "bundle"
  | "subscription"
  | "mock_test";
export type ProgressScoreExportStatus = ReportExportStatus;

export type ProgressScoreExportColumn = ReportExportColumn;

export type ProgressScoreExportHistoryItem = ReportExportHistoryItem<ProgressScoreExportDataset>;

export type ProgressScoreExportScheduleItem = ReportExportScheduleItem;

export type ProgressScoreExportsPayload = {
  history: ProgressScoreExportHistoryItem[];
  schedules: ProgressScoreExportScheduleItem[];
  progressColumns: ProgressScoreExportColumn[];
  scoreColumns: ProgressScoreExportColumn[];
  capabilities: ReportExportCapabilities<ProgressScoreExportDataset>;
};

export type CreateProgressScoreExportBody = {
  dataset: ProgressScoreExportDataset;
  columns: string[];
  format: ProgressScoreExportFormat;
  productType?: ProgressScoreExportProductType | undefined;
  productId?: string | undefined;
  courseId?: string | undefined;
  assessmentId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  learnerName?: string | undefined;
  enrolledType?: string | undefined;
  status?: string | undefined;
  resultStatus?: "pass" | "fail" | "pending" | "in_progress" | undefined;
  useCurrentFilters: boolean;
  delivery: ProgressScoreExportDelivery;
  recipients?: string[] | undefined;
  webhookUrl?: string | null | undefined;
  scheduleEnabled: boolean;
  scheduleName?: string | undefined;
  cadence?: ProgressScoreExportCadence | undefined;
  time?: string | undefined;
  timezone?: string | undefined;
};

export const progressScoreExportsApi = createReportExportsApi<{
  payload: ProgressScoreExportsPayload;
  createBody: CreateProgressScoreExportBody;
}>("progress-score");

export function isScoreLikeDataset(dataset: ProgressScoreExportDataset): boolean {
  return dataset === "scores" || dataset === "attempts" || dataset === "item_analysis";
}
