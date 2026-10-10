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

export type PaymentExportFormat = ReportExportFormat;
export type PaymentExportDataset =
  | "transactions"
  | "orders"
  | "invoices"
  | "instalments"
  | "refunds"
  | "gateways";
export type PaymentExportDelivery = ReportExportDelivery;
export type PaymentExportCadence = ReportExportCadence;
export type PaymentExportGrouping = "none" | "gateway" | "product" | "currency" | "month";
/** Only meaningful for the `orders` dataset; the server rejects it elsewhere. */
export type PaymentExportSettlement = "settled" | "unsettled";
export type PaymentExportStatus = ReportExportStatus;

export type PaymentExportColumn = ReportExportColumn;

export type PaymentExportHistoryItem = ReportExportHistoryItem<PaymentExportDataset>;

export type PaymentExportScheduleItem = ReportExportScheduleItem;

export type PaymentExportsPayload = {
  history: PaymentExportHistoryItem[];
  schedules: PaymentExportScheduleItem[];
  columns: PaymentExportColumn[];
  capabilities: ReportExportCapabilities<PaymentExportDataset> & { groupingApplied: boolean };
};

export type CreatePaymentExportBody = {
  dataset: PaymentExportDataset;
  columns: string[];
  format: PaymentExportFormat;
  paidFrom?: string | undefined;
  paidTo?: string | undefined;
  gatewayKey?: string | undefined;
  status?: string | undefined;
  settlement?: PaymentExportSettlement | undefined;
  useCurrentFilters: boolean;
  grouping: PaymentExportGrouping;
  includeSubtotals: boolean;
  delivery: PaymentExportDelivery;
  recipients?: string[] | undefined;
  webhookUrl?: string | null | undefined;
  scheduleEnabled: boolean;
  scheduleName?: string | undefined;
  cadence?: PaymentExportCadence | undefined;
  time?: string | undefined;
  timezone?: string | undefined;
};

export const paymentExportsApi = createReportExportsApi<{
  payload: PaymentExportsPayload;
  createBody: CreatePaymentExportBody;
}>("payments");
