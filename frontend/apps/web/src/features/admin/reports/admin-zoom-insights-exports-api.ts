"use client";

import { clientApi } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";

export type ZoomExportFormat = "csv" | "xlsx" | "json";
export type ZoomExportDataset = "meetings" | "participants" | "unmatched" | "connection";
export type ZoomExportDelivery = "download" | "email_me";
export type ZoomExportCadence = "daily" | "weekly" | "monthly";
export type ZoomExportDatePreset = "7d" | "30d" | "90d" | "custom";
export type ZoomExportStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type ZoomExportHistoryItem = {
  id: string;
  fileName: string;
  format: "csv" | "xlsx" | "pdf" | "json";
  dataset: ZoomExportDataset;
  datasetLabel: string;
  scopeLabel: string;
  rowCount: number | null;
  sizeLabel: string | null;
  requestedByLabel: string;
  status: ZoomExportStatus;
  expired: boolean;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorTrace: string[] | null;
  progressPercent: number | null;
  downloadAvailable: boolean;
};

export type ZoomExportScheduleItem = {
  id: string;
  name: string;
  dataset: ZoomExportDataset;
  datasetLabel: string;
  cadenceLabel: string;
  cronExpression: string;
  timezone: string;
  formats: Array<"csv" | "xlsx" | "pdf" | "json">;
  isActive: boolean;
  nextRunAt: string;
  nextRunLabel: string;
  recipients: string[];
  delivery: Record<string, unknown> | null;
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

export async function fetchZoomInsightsExports() {
  return clientApi.get<{ data: ZoomInsightsExportsPayload }>(
    "/api/v1/reports/zoom-insights/exports",
  );
}

export async function createZoomExport(body: CreateZoomExportBody) {
  return clientApi.post<{
    data: {
      run: ZoomExportHistoryItem;
      schedule: ZoomExportScheduleItem | null;
    };
  }>("/api/v1/reports/zoom-insights/exports", body, "zoom-insights-export-create", {
    successMessage: "Export started.",
  });
}

export async function fetchZoomExportRun(runId: string) {
  return clientApi.get<{ data: ZoomExportHistoryItem }>(
    `/api/v1/reports/zoom-insights/exports/${runId}`,
  );
}

export async function retryZoomExport(runId: string) {
  return clientApi.post<{ data: ZoomExportHistoryItem }>(
    `/api/v1/reports/zoom-insights/exports/${runId}/retry`,
    null,
    "zoom-insights-export-retry",
    { successMessage: "Export retry started." },
  );
}

export async function updateZoomExportSchedule(
  scheduleId: string,
  body: { isActive?: boolean | undefined; name?: string | undefined },
) {
  return clientApi.patch<{ data: ZoomExportScheduleItem }>(
    `/api/v1/reports/zoom-insights/exports/schedules/${scheduleId}`,
    body,
    "zoom-insights-export-schedule-update",
    { successMessage: "Schedule updated." },
  );
}

export async function deleteZoomExportSchedule(scheduleId: string) {
  return clientApi.delete<{ data: { deleted: true; id: string } }>(
    `/api/v1/reports/zoom-insights/exports/schedules/${scheduleId}`,
    "zoom-insights-export-schedule-delete",
    undefined,
    { successMessage: "Schedule deleted." },
  );
}

export async function downloadZoomExport(item: ZoomExportHistoryItem) {
  const format = item.format === "pdf" ? "csv" : item.format;
  return downloadReportExport(item.id, format);
}
