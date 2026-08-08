"use client";

import { clientApi } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";

export type DeviceExportFormat = "csv" | "xlsx" | "json";
export type DeviceExportWindow = "24h" | "7d" | "30d" | "all";
export type DeviceExportDelivery = "download" | "email_me" | "recipients";
export type DeviceExportCadence = "daily" | "weekly" | "monthly";
export type DeviceExportStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type DeviceExportColumn = {
  key: string;
  label: string;
  sensitive: boolean;
  defaultSelected: boolean;
};

export type DeviceExportHistoryItem = {
  id: string;
  fileName: string;
  format: "csv" | "xlsx" | "pdf" | "json";
  scopeLabel: string;
  rowCount: number | null;
  sizeLabel: string | null;
  status: DeviceExportStatus;
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  downloadAvailable: boolean;
};

export type DeviceExportScheduleItem = {
  id: string;
  name: string;
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

export type DeviceExportsPayload = {
  history: DeviceExportHistoryItem[];
  schedules: DeviceExportScheduleItem[];
  columns: DeviceExportColumn[];
  capabilities: {
    formats: DeviceExportFormat[];
    canSchedule: boolean;
    canEmailDelivery: boolean;
    canWebhookDelivery: boolean;
    geoColumnsAvailable: false;
    note: string;
  };
};

export type CreateDeviceExportBody = {
  columns: string[];
  format: DeviceExportFormat;
  window: DeviceExportWindow;
  overLimitOnly: boolean;
  platform?: string | undefined;
  useCurrentFilters: boolean;
  delivery: DeviceExportDelivery;
  recipients?: string[] | undefined;
  webhookUrl?: string | null | undefined;
  scheduleEnabled: boolean;
  scheduleName?: string | undefined;
  cadence?: DeviceExportCadence | undefined;
  time?: string | undefined;
  timezone?: string | undefined;
};

export async function fetchDeviceExports() {
  return clientApi.get<{ data: DeviceExportsPayload }>("/api/v1/reports/active-devices/exports");
}

export async function createDeviceExport(body: CreateDeviceExportBody) {
  return clientApi.post<{
    data: { run: DeviceExportHistoryItem; schedule: DeviceExportScheduleItem | null };
  }>("/api/v1/reports/active-devices/exports", body, "active-devices-export-create", {
    successMessage: "Export started.",
  });
}

export async function fetchDeviceExportRun(runId: string) {
  return clientApi.get<{ data: DeviceExportHistoryItem }>(
    `/api/v1/reports/active-devices/exports/${runId}`,
  );
}

export async function retryDeviceExport(runId: string) {
  return clientApi.post<{ data: DeviceExportHistoryItem }>(
    `/api/v1/reports/active-devices/exports/${runId}/retry`,
    null,
    "active-devices-export-retry",
    { successMessage: "Export retry started." },
  );
}

export async function updateDeviceExportSchedule(
  scheduleId: string,
  body: { isActive?: boolean | undefined; name?: string | undefined },
) {
  return clientApi.patch<{ data: DeviceExportScheduleItem }>(
    `/api/v1/reports/active-devices/exports/schedules/${scheduleId}`,
    body,
    "active-devices-export-schedule-update",
    { successMessage: "Schedule updated." },
  );
}

export async function deleteDeviceExportSchedule(scheduleId: string) {
  return clientApi.delete<{ data: { deleted: true; id: string } }>(
    `/api/v1/reports/active-devices/exports/schedules/${scheduleId}`,
    "active-devices-export-schedule-delete",
    undefined,
    { successMessage: "Schedule deleted." },
  );
}

export async function downloadDeviceExport(run: DeviceExportHistoryItem) {
  const format = run.format === "pdf" ? "csv" : run.format;
  await downloadReportExport(run.id, format);
}
