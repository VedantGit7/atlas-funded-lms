"use client";

import { clientApi } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";

/*
 * What every report's exports page shares with the server: the history and
 * schedule items, and the seven calls behind the page. A report adds its own
 * datasets, columns and create body, and gets its client from
 * createReportExportsApi.
 */

export type ReportExportFormat = "csv" | "xlsx" | "json";
export type ReportExportFileFormat = "csv" | "xlsx" | "pdf" | "json";
export type ReportExportDelivery = "download" | "email_me" | "recipients";
export type ReportExportCadence = "daily" | "weekly" | "monthly";
export type ReportExportStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type ReportExportColumn = {
  key: string;
  label: string;
  sensitive: boolean;
  defaultSelected: boolean;
};

export type ReportExportHistoryItem<TDataset extends string = string> = {
  id: string;
  fileName: string;
  format: ReportExportFileFormat;
  dataset: TDataset;
  datasetLabel: string;
  scopeLabel: string;
  rowCount: number | null;
  sizeLabel: string | null;
  /** Sent by the reports that name who asked for the file. */
  requestedByLabel?: string;
  status: ReportExportStatus;
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

export type ReportExportScheduleItem = {
  id: string;
  name: string;
  datasetLabel: string;
  cadenceLabel: string;
  cronExpression: string;
  timezone: string;
  formats: ReportExportFileFormat[];
  isActive: boolean;
  nextRunAt: string;
  nextRunLabel: string;
  recipients: string[];
  webhookLabel: string | null;
  delivery: Record<string, unknown> | null;
};

export type ReportExportCapabilities<TDataset extends string = string> = {
  formats: ReportExportFormat[];
  datasets: TDataset[];
  canSchedule: boolean;
  canEmailDelivery: boolean;
  canWebhookDelivery: boolean;
  note: string;
};

/** The part of a report's exports payload the shared page reads. */
export type ReportExportsLedger = {
  history: ReportExportHistoryItem[];
  schedules: ReportExportScheduleItem[];
  capabilities: ReportExportCapabilities;
};

export type ReportExportHistoryOf<TPayload extends ReportExportsLedger> =
  TPayload["history"][number];
export type ReportExportScheduleOf<TPayload extends ReportExportsLedger> =
  TPayload["schedules"][number];

export type UpdateReportExportScheduleBody = {
  isActive?: boolean | undefined;
  name?: string | undefined;
};

/** A report's exports payload and the body that starts one of its exports. */
export type ReportExportsShape = {
  payload: ReportExportsLedger;
  createBody: object;
};

/**
 * The client for one report's exports, at /api/v1/reports/<report>/exports.
 * Mutations send an idempotency key that starts with `<keyPrefix>-export-`.
 */
export function createReportExportsApi<TShape extends ReportExportsShape>(
  report: string,
  keyPrefix: string = report,
) {
  type Payload = TShape["payload"];
  type HistoryItem = ReportExportHistoryOf<Payload>;
  type ScheduleItem = ReportExportScheduleOf<Payload>;
  const base = `/api/v1/reports/${report}/exports`;

  return {
    fetchExports: () => clientApi.get<{ data: Payload }>(base),

    create: (body: TShape["createBody"]) =>
      clientApi.post<{ data: { run: HistoryItem; schedule: ScheduleItem | null } }>(
        base,
        body,
        `${keyPrefix}-export-create`,
        { successMessage: "Export started." },
      ),

    fetchRun: (runId: string) => clientApi.get<{ data: HistoryItem }>(`${base}/${runId}`),

    retry: (runId: string) =>
      clientApi.post<{ data: HistoryItem }>(
        `${base}/${runId}/retry`,
        null,
        `${keyPrefix}-export-retry`,
        { successMessage: "Export retry started." },
      ),

    updateSchedule: (scheduleId: string, body: UpdateReportExportScheduleBody) =>
      clientApi.patch<{ data: ScheduleItem }>(
        `${base}/schedules/${scheduleId}`,
        body,
        `${keyPrefix}-export-schedule-update`,
        { successMessage: "Schedule updated." },
      ),

    deleteSchedule: (scheduleId: string) =>
      clientApi.delete<{ data: { deleted: true; id: string } }>(
        `${base}/schedules/${scheduleId}`,
        `${keyPrefix}-export-schedule-delete`,
        undefined,
        { successMessage: "Schedule deleted." },
      ),

    download: async (run: HistoryItem) => {
      await downloadReportExport(run.id, run.format === "pdf" ? "csv" : run.format);
    },
  };
}

export type ReportExportsApi<TPayload extends ReportExportsLedger> = Omit<
  ReturnType<typeof createReportExportsApi<{ payload: TPayload; createBody: object }>>,
  "create"
>;
