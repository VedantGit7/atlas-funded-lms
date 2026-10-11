"use client";

import {
  createReportExportsApi,
  type ReportExportCadence,
  type ReportExportFormat,
  type ReportExportHistoryItem,
  type ReportExportScheduleItem,
  type ReportExportStatus,
} from "./admin-report-exports-api";

export type DeviceExportFormat = ReportExportFormat;
/** Device exports have one dataset, the device roster. */
export type DeviceExportDataset = "device_roster";
export type DeviceExportWindow = "24h" | "7d" | "30d" | "all";
export type DeviceExportDelivery = "download" | "email_me" | "recipients";
export type DeviceExportCadence = ReportExportCadence;
export type DeviceExportStatus = ReportExportStatus;

export type DeviceExportColumn = {
  key: string;
  label: string;
  sensitive: boolean;
  defaultSelected: boolean;
};

export type DeviceExportHistoryItem = ReportExportHistoryItem<DeviceExportDataset> & {
  requestedByLabel: string;
  columns: string[];
};

export type DeviceExportScheduleItem = ReportExportScheduleItem;

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

export const activeDevicesExportsApi = createReportExportsApi<{
  payload: DeviceExportsPayload;
  createBody: CreateDeviceExportBody;
}>(
  {
    exports: "/api/v1/reports/active-devices/exports",
    run: (runId) => `/api/v1/reports/active-devices/exports/${runId}`,
    retry: (runId) => `/api/v1/reports/active-devices/exports/${runId}/retry`,
    schedule: (scheduleId) => `/api/v1/reports/active-devices/exports/schedules/${scheduleId}`,
  },
  "active-devices",
);
