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

export type CustomFieldExportFormat = ReportExportFormat;
export type CustomFieldExportDataset = "learner_roster" | "field_coverage" | "segment_members";
export type CustomFieldExportDelivery = ReportExportDelivery;
export type CustomFieldExportCadence = ReportExportCadence;
export type CustomFieldExportEmptyValue = "blank" | "emdash";
export type CustomFieldExportStatus = ReportExportStatus;

export type CustomFieldExportColumn = ReportExportColumn & {
  group: "learner" | "custom";
  typeBadge: string | null;
  fieldType: string | null;
};

export type CustomFieldExportHistoryItem = ReportExportHistoryItem<CustomFieldExportDataset>;

export type CustomFieldExportScheduleItem = ReportExportScheduleItem;

export type CustomFieldExportsPayload = {
  history: CustomFieldExportHistoryItem[];
  schedules: CustomFieldExportScheduleItem[];
  learnerColumns: CustomFieldExportColumn[];
  customFieldColumns: CustomFieldExportColumn[];
  capabilities: ReportExportCapabilities<CustomFieldExportDataset>;
};

export type CreateCustomFieldExportBody = {
  dataset: CustomFieldExportDataset;
  columns: string[];
  format: CustomFieldExportFormat;
  emptyValueMode: CustomFieldExportEmptyValue;
  q?: string | undefined;
  email?: string | undefined;
  status?: "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED" | undefined;
  signedUpFrom?: string | undefined;
  signedUpTo?: string | undefined;
  minTotalSpentCents?: number | undefined;
  maxTotalSpentCents?: number | undefined;
  segmentId?: string | undefined;
  segmentName?: string | undefined;
  useCurrentFilters: boolean;
  delivery: CustomFieldExportDelivery;
  recipients?: string[] | undefined;
  webhookUrl?: string | null | undefined;
  scheduleEnabled: boolean;
  scheduleName?: string | undefined;
  cadence?: CustomFieldExportCadence | undefined;
  time?: string | undefined;
  timezone?: string | undefined;
};

export const customFieldExportsApi = createReportExportsApi<{
  payload: CustomFieldExportsPayload;
  createBody: CreateCustomFieldExportBody;
}>(
  {
    exports: "/api/v1/reports/custom-field/exports",
    run: (runId) => `/api/v1/reports/custom-field/exports/${runId}`,
    retry: (runId) => `/api/v1/reports/custom-field/exports/${runId}/retry`,
    schedule: (scheduleId) => `/api/v1/reports/custom-field/exports/schedules/${scheduleId}`,
  },
  "custom-field",
);
