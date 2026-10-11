"use client";

import {
  createReportExportsApi,
  type ReportExportCadence,
  type ReportExportFormat,
  type ReportExportHistoryItem,
  type ReportExportScheduleItem,
  type ReportExportStatus,
} from "./admin-report-exports-api";

export type ZoomExportFormat = ReportExportFormat;
export type ZoomExportDataset = "meetings" | "participants" | "unmatched" | "connection";
export type ZoomExportDelivery = "download" | "email_me";
export type ZoomExportCadence = ReportExportCadence;
export type ZoomExportDatePreset = "7d" | "30d" | "90d" | "custom";
export type ZoomExportStatus = ReportExportStatus;

export type ZoomExportHistoryItem = ReportExportHistoryItem<ZoomExportDataset> & {
  requestedByLabel: string;
};

export type ZoomExportScheduleItem = ReportExportScheduleItem & {
  dataset: ZoomExportDataset;
};

export type ZoomExportsConnectionMeta = {
  status: "connected" | "disconnected" | "unknown";
  connectedAt: string | null;
  lastSyncedAt: string | null;
  meetingsImportedToday: number;
  hasConnectionRecord: boolean;
};

export type ZoomInsightsExportsPayload = {
  history: ZoomExportHistoryItem[];
  schedules: ZoomExportScheduleItem[];
  connection: ZoomExportsConnectionMeta;
  capabilities: {
    formats: ZoomExportFormat[];
    datasets: ZoomExportDataset[];
    canSchedule: boolean;
    canEmailDelivery: boolean;
    note: string;
  };
};

export type CreateZoomExportBody = {
  dataset: ZoomExportDataset;
  format: ZoomExportFormat;
  datePreset: ZoomExportDatePreset;
  startedFrom?: string | undefined;
  startedTo?: string | undefined;
  allMeetingsInRange?: boolean | undefined;
  meetingId?: string | undefined;
  filterSummary?: string | undefined;
  delivery: ZoomExportDelivery;
  scheduleEnabled: boolean;
  scheduleName?: string | undefined;
  cadence?: ZoomExportCadence | undefined;
  time?: string | undefined;
  timezone?: string | undefined;
  recipients?: string[] | undefined;
};

export const zoomInsightsExportsApi = createReportExportsApi<{
  payload: ZoomInsightsExportsPayload;
  createBody: CreateZoomExportBody;
}>(
  {
    exports: "/api/v1/reports/zoom-insights/exports",
    run: (runId) => `/api/v1/reports/zoom-insights/exports/${runId}`,
    retry: (runId) => `/api/v1/reports/zoom-insights/exports/${runId}/retry`,
    schedule: (scheduleId) => `/api/v1/reports/zoom-insights/exports/schedules/${scheduleId}`,
  },
  "zoom-insights",
);
