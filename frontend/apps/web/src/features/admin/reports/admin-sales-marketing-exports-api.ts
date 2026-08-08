"use client";

import { clientApi } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";

export type SmExportFormat = "csv" | "xlsx" | "json";
export type SmExportDataset =
  | "sales"
  | "coupons"
  | "referral-wallet"
  | "affiliate-products"
  | "affiliates";
export type SmExportDelivery = "download" | "email_me" | "recipients";
export type SmExportCadence = "daily" | "weekly" | "monthly";
export type SmExportGrouping = "none" | "product" | "month" | "currency";
export type SmExportStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export type SmExportColumn = {
  key: string;
  label: string;
  sensitive: boolean;
  defaultSelected: boolean;
};

export type SmExportHistoryItem = {
  id: string;
  fileName: string;
  format: "csv" | "xlsx" | "pdf" | "json";
  dataset: SmExportDataset;
  datasetLabel: string;
  scopeLabel: string;
  rowCount: number | null;
  sizeLabel: string | null;
  requestedByLabel: string;
  status: SmExportStatus;
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

export type SmExportScheduleItem = {
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

export type SalesMarketingExportsPayload = {
  history: SmExportHistoryItem[];
  schedules: SmExportScheduleItem[];
  columnsByDataset: Record<SmExportDataset, SmExportColumn[]>;
  capabilities: {
    formats: SmExportFormat[];
    datasets: SmExportDataset[];
    canSchedule: boolean;
    canEmailDelivery: boolean;
    canWebhookDelivery: boolean;
    note: string;
  };
};

export type CreateSalesMarketingExportBody = {
  dataset: SmExportDataset;
  columns: string[];
  format: SmExportFormat;
  courseId?: string;
  couponId?: string;
  purchasedFrom?: string;
  purchasedTo?: string;
  learnerName?: string;
  email?: string;
  q?: string;
  grouping?: SmExportGrouping;
  includeSubtotals?: boolean;
  useCurrentFilters: boolean;
  filterSummary?: string;
  delivery: SmExportDelivery;
  recipients?: string[];
  webhookUrl?: string | null;
  scheduleEnabled: boolean;
  scheduleName?: string;
  cadence?: SmExportCadence;
  time?: string;
  timezone?: string;
};

export async function fetchSalesMarketingExports() {
  return clientApi.get<{ data: SalesMarketingExportsPayload }>(
    "/api/v1/reports/sales-marketing/exports",
  );
}

export async function createSalesMarketingExport(body: CreateSalesMarketingExportBody) {
  return clientApi.post<{
    data: {
      run: SmExportHistoryItem;
      schedule: SmExportScheduleItem | null;
    };
  }>("/api/v1/reports/sales-marketing/exports", body, "sm-export-create", {
    successMessage: "Export started.",
  });
}

export async function fetchSalesMarketingExportRun(runId: string) {
  return clientApi.get<{ data: SmExportHistoryItem }>(
    `/api/v1/reports/sales-marketing/exports/${runId}`,
  );
}

export async function retrySalesMarketingExport(runId: string) {
  return clientApi.post<{ data: SmExportHistoryItem }>(
    `/api/v1/reports/sales-marketing/exports/${runId}/retry`,
    null,
    "sm-export-retry",
    { successMessage: "Export retry started." },
  );
}

export async function updateSalesMarketingExportSchedule(
  scheduleId: string,
  body: { isActive?: boolean; name?: string },
) {
  return clientApi.patch<{ data: SmExportScheduleItem }>(
    `/api/v1/reports/sales-marketing/exports/schedules/${scheduleId}`,
    body,
    "sm-export-schedule-update",
    { successMessage: "Schedule updated." },
  );
}

export async function deleteSalesMarketingExportSchedule(scheduleId: string) {
  return clientApi.delete<{ data: { deleted: true; id: string } }>(
    `/api/v1/reports/sales-marketing/exports/schedules/${scheduleId}`,
    "sm-export-schedule-delete",
    undefined,
    { successMessage: "Schedule deleted." },
  );
}

export async function downloadSalesMarketingExport(run: SmExportHistoryItem) {
  const format = run.format === "pdf" ? "csv" : run.format;
  await downloadReportExport(run.id, format);
}
