"use client";

import { clientApi } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";

export type PaymentExportFormat = "csv" | "xlsx" | "json";
export type PaymentExportDataset =
  | "transactions"
  | "invoices"
  | "instalments"
  | "refunds"
  | "gateways";
export type PaymentExportDelivery = "download" | "email_me" | "recipients";
export type PaymentExportCadence = "daily" | "weekly" | "monthly";
export type PaymentExportGrouping = "none" | "gateway" | "product" | "currency" | "month";
export type PaymentExportStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type PaymentExportColumn = {
  key: string;
  label: string;
  sensitive: boolean;
  defaultSelected: boolean;
};

export type PaymentExportHistoryItem = {
  id: string;
  fileName: string;
  format: "csv" | "xlsx" | "pdf" | "json";
  dataset: PaymentExportDataset;
  datasetLabel: string;
  scopeLabel: string;
  rowCount: number | null;
  sizeLabel: string | null;
  status: PaymentExportStatus;
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

export type PaymentExportScheduleItem = {
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

export type PaymentExportsPayload = {
  history: PaymentExportHistoryItem[];
  schedules: PaymentExportScheduleItem[];
  columns: PaymentExportColumn[];
  capabilities: {
    formats: PaymentExportFormat[];
    datasets: PaymentExportDataset[];
    canSchedule: boolean;
    canEmailDelivery: boolean;
    canWebhookDelivery: boolean;
    groupingApplied: boolean;
    note: string;
  };
};

export type CreatePaymentExportBody = {
  dataset: PaymentExportDataset;
  columns: string[];
  format: PaymentExportFormat;
  paidFrom?: string;
  paidTo?: string;
  gatewayKey?: string;
  status?: string;
  useCurrentFilters: boolean;
  grouping: PaymentExportGrouping;
  includeSubtotals: boolean;
  delivery: PaymentExportDelivery;
  recipients?: string[];
  webhookUrl?: string | null;
  scheduleEnabled: boolean;
  scheduleName?: string;
  cadence?: PaymentExportCadence;
  time?: string;
  timezone?: string;
};

export async function fetchPaymentExports() {
  return clientApi.get<{ data: PaymentExportsPayload }>("/api/v1/reports/payments/exports");
}

export async function createPaymentExport(body: CreatePaymentExportBody) {
  return clientApi.post<{
    data: { run: PaymentExportHistoryItem; schedule: PaymentExportScheduleItem | null };
  }>("/api/v1/reports/payments/exports", body, "payments-export-create", {
    successMessage: "Export started.",
  });
}

export async function fetchPaymentExportRun(runId: string) {
  return clientApi.get<{ data: PaymentExportHistoryItem }>(
    `/api/v1/reports/payments/exports/${runId}`,
  );
}

export async function retryPaymentExport(runId: string) {
  return clientApi.post<{ data: PaymentExportHistoryItem }>(
    `/api/v1/reports/payments/exports/${runId}/retry`,
    null,
    "payments-export-retry",
    { successMessage: "Export retry started." },
  );
}

export async function updatePaymentExportSchedule(
  scheduleId: string,
  body: { isActive?: boolean; name?: string },
) {
  return clientApi.patch<{ data: PaymentExportScheduleItem }>(
    `/api/v1/reports/payments/exports/schedules/${scheduleId}`,
    body,
    "payments-export-schedule-update",
    { successMessage: "Schedule updated." },
  );
}

export async function deletePaymentExportSchedule(scheduleId: string) {
  return clientApi.delete<{ data: { deleted: true; id: string } }>(
    `/api/v1/reports/payments/exports/schedules/${scheduleId}`,
    "payments-export-schedule-delete",
    undefined,
    { successMessage: "Schedule deleted." },
  );
}

export async function downloadPaymentExport(run: PaymentExportHistoryItem) {
  const format = run.format === "pdf" ? "csv" : run.format;
  await downloadReportExport(run.id, format);
}
