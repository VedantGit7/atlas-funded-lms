"use client";

import { clientApi } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";

export type CustomFieldExportFormat = "csv" | "xlsx" | "json";
export type CustomFieldExportDataset =
  | "learner_roster"
  | "field_coverage"
  | "segment_members";
export type CustomFieldExportDelivery = "download" | "email_me" | "recipients";
export type CustomFieldExportCadence = "daily" | "weekly" | "monthly";
export type CustomFieldExportEmptyValue = "blank" | "emdash";
export type CustomFieldExportStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export type CustomFieldExportColumn = {
  key: string;
  label: string;
  sensitive: boolean;
  defaultSelected: boolean;
  group: "learner" | "custom";
  typeBadge: string | null;
  fieldType: string | null;
};

export type CustomFieldExportHistoryItem = {
  id: string;
  fileName: string;
  format: "csv" | "xlsx" | "pdf" | "json";
  dataset: CustomFieldExportDataset;
  datasetLabel: string;
  scopeLabel: string;
  rowCount: number | null;
  sizeLabel: string | null;
  status: CustomFieldExportStatus;
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

export type CustomFieldExportScheduleItem = {
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

export type CustomFieldExportsPayload = {
  history: CustomFieldExportHistoryItem[];
  schedules: CustomFieldExportScheduleItem[];
  learnerColumns: CustomFieldExportColumn[];
  customFieldColumns: CustomFieldExportColumn[];
  capabilities: {
    formats: CustomFieldExportFormat[];
    datasets: CustomFieldExportDataset[];
    canSchedule: boolean;
    canEmailDelivery: boolean;
    canWebhookDelivery: boolean;
    note: string;
  };
};

export type CreateCustomFieldExportBody = {
  dataset: CustomFieldExportDataset;
  columns: string[];
  format: CustomFieldExportFormat;
  emptyValueMode: CustomFieldExportEmptyValue;
  q?: string;
  email?: string;
  status?: "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";
  signedUpFrom?: string;
  signedUpTo?: string;
  minTotalSpentCents?: number;
  maxTotalSpentCents?: number;
  segmentId?: string;
  segmentName?: string;
  useCurrentFilters: boolean;
  delivery: CustomFieldExportDelivery;
  recipients?: string[];
  webhookUrl?: string | null;
  scheduleEnabled: boolean;
  scheduleName?: string;
  cadence?: CustomFieldExportCadence;
  time?: string;
  timezone?: string;
};

export async function fetchCustomFieldExports() {
  return clientApi.get<{ data: CustomFieldExportsPayload }>(
    "/api/v1/reports/custom-field/exports",
  );
}

export async function createCustomFieldExport(body: CreateCustomFieldExportBody) {
  return clientApi.post<{
    data: {
      run: CustomFieldExportHistoryItem;
      schedule: CustomFieldExportScheduleItem | null;
    };
  }>("/api/v1/reports/custom-field/exports", body, "custom-field-export-create", {
    successMessage: "Export started.",
  });
}

export async function fetchCustomFieldExportRun(runId: string) {
  return clientApi.get<{ data: CustomFieldExportHistoryItem }>(
    `/api/v1/reports/custom-field/exports/${runId}`,
  );
}

export async function retryCustomFieldExport(runId: string) {
  return clientApi.post<{ data: CustomFieldExportHistoryItem }>(
    `/api/v1/reports/custom-field/exports/${runId}/retry`,
    null,
    "custom-field-export-retry",
    { successMessage: "Export retry started." },
  );
}

export async function updateCustomFieldExportSchedule(
  scheduleId: string,
  body: { isActive?: boolean; name?: string },
) {
  return clientApi.patch<{ data: CustomFieldExportScheduleItem }>(
    `/api/v1/reports/custom-field/exports/schedules/${scheduleId}`,
    body,
    "custom-field-export-schedule-update",
    { successMessage: "Schedule updated." },
  );
}

export async function deleteCustomFieldExportSchedule(scheduleId: string) {
  return clientApi.delete<{ data: { deleted: true; id: string } }>(
    `/api/v1/reports/custom-field/exports/schedules/${scheduleId}`,
    "custom-field-export-schedule-delete",
    undefined,
    { successMessage: "Schedule deleted." },
  );
}

export async function downloadCustomFieldExport(run: CustomFieldExportHistoryItem) {
  const format = run.format === "pdf" ? "csv" : run.format;
  await downloadReportExport(run.id, format);
}
