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

export type SmExportFormat = ReportExportFormat;
export type SmExportDataset =
  | "sales"
  | "coupons"
  | "referral-wallet"
  | "affiliate-products"
  | "affiliates"
  | "attribution";

/** Only meaningful for the `attribution` dataset; the server rejects it elsewhere. */
export type SmAttributionPresence = "any" | "attributed" | "none";
export type SmExportDelivery = ReportExportDelivery;
export type SmExportCadence = ReportExportCadence;
export type SmExportGrouping = "none" | "product" | "month" | "currency";
export type SmExportStatus = ReportExportStatus;

export type SmExportColumn = ReportExportColumn;

export type SmExportHistoryItem = ReportExportHistoryItem<SmExportDataset> & {
  requestedByLabel: string;
};

export type SmExportScheduleItem = ReportExportScheduleItem;

export type SalesMarketingExportsPayload = {
  history: SmExportHistoryItem[];
  schedules: SmExportScheduleItem[];
  columnsByDataset: Record<SmExportDataset, SmExportColumn[]>;
  capabilities: ReportExportCapabilities<SmExportDataset>;
};

export type CreateSalesMarketingExportBody = {
  dataset: SmExportDataset;
  columns: string[];
  format: SmExportFormat;
  courseId?: string | undefined;
  couponId?: string | undefined;
  purchasedFrom?: string | undefined;
  purchasedTo?: string | undefined;
  learnerName?: string | undefined;
  email?: string | undefined;
  q?: string | undefined;
  attribution?: SmAttributionPresence | undefined;
  grouping?: SmExportGrouping | undefined;
  includeSubtotals?: boolean | undefined;
  useCurrentFilters: boolean;
  filterSummary?: string | undefined;
  delivery: SmExportDelivery;
  recipients?: string[] | undefined;
  webhookUrl?: string | null | undefined;
  scheduleEnabled: boolean;
  scheduleName?: string | undefined;
  cadence?: SmExportCadence | undefined;
  time?: string | undefined;
  timezone?: string | undefined;
};

export const salesMarketingExportsApi = createReportExportsApi<{
  payload: SalesMarketingExportsPayload;
  createBody: CreateSalesMarketingExportBody;
}>(
  {
    exports: "/api/v1/reports/sales-marketing/exports",
    run: (runId) => `/api/v1/reports/sales-marketing/exports/${runId}`,
    retry: (runId) => `/api/v1/reports/sales-marketing/exports/${runId}/retry`,
    schedule: (scheduleId) => `/api/v1/reports/sales-marketing/exports/schedules/${scheduleId}`,
  },
  "sm",
);
