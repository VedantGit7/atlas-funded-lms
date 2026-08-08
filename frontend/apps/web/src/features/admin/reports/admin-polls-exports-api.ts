"use client";

import { clientApi } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";

export type PollExportFormat = "csv" | "xlsx" | "json";
export type PollExportDataset =
  | "poll_summary"
  | "option_tallies"
  | "respondents"
  | "non_respondents";
export type PollExportDelivery = "download" | "email_me" | "recipients";
export type PollExportCadence = "daily" | "weekly" | "monthly";
export type PollExportGrouping = "none" | "poll" | "live_session" | "option";
export type PollExportStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type PollExportColumn = {
  key: string;
  label: string;
  sensitive: boolean;
  defaultSelected: boolean;
};

export type PollExportHistoryItem = {
  id: string;
  fileName: string;
  format: "csv" | "xlsx" | "pdf" | "json";
  dataset: PollExportDataset;
  datasetLabel: string;
  scopeLabel: string;
  rowCount: number | null;
  sizeLabel: string | null;
  requestedByLabel: string;
  status: PollExportStatus;
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
  anonymousExcludedCount: number | null;
};

export type PollExportScheduleItem = {
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

export type PollsExportsPayload = {
  history: PollExportHistoryItem[];
  schedules: PollExportScheduleItem[];
  summaryColumns: PollExportColumn[];
  optionTalliesColumns: PollExportColumn[];
  respondentsColumns: PollExportColumn[];
  nonRespondentsColumns: PollExportColumn[];
  capabilities: {
    formats: PollExportFormat[];
    datasets: PollExportDataset[];
    canSchedule: boolean;
    canEmailDelivery: boolean;
    canWebhookDelivery: boolean;
    note: string;
  };
};

export type CreatePollExportBody = {
  dataset: PollExportDataset;
  columns: string[];
  format: PollExportFormat;
  pollIds?: string[] | undefined;
  liveSessionId?: string | undefined;
  allPollsInSession?: boolean | undefined;
  allPollsInRange?: boolean | undefined;
  respondedFrom?: string | undefined;
  respondedTo?: string | undefined;
  grouping?: PollExportGrouping | undefined;
  includeSubtotals?: boolean | undefined;
  useCurrentFilters: boolean;
  filterSummary?: string | undefined;
  delivery: PollExportDelivery;
  recipients?: string[] | undefined;
  webhookUrl?: string | null | undefined;
  scheduleEnabled: boolean;
  scheduleName?: string | undefined;
  cadence?: PollExportCadence | undefined;
  time?: string | undefined;
  timezone?: string | undefined;
};

export async function fetchPollsExports() {
  return clientApi.get<{ data: PollsExportsPayload }>("/api/v1/reports/polls/exports");
}

export async function createPollExport(body: CreatePollExportBody) {
  return clientApi.post<{
    data: {
      run: PollExportHistoryItem;
      schedule: PollExportScheduleItem | null;
    };
  }>("/api/v1/reports/polls/exports", body, "polls-export-create", {
    successMessage: "Export started.",
  });
}

export async function fetchPollExportRun(runId: string) {
  return clientApi.get<{ data: PollExportHistoryItem }>(`/api/v1/reports/polls/exports/${runId}`);
}

export async function retryPollExport(runId: string) {
  return clientApi.post<{ data: PollExportHistoryItem }>(
    `/api/v1/reports/polls/exports/${runId}/retry`,
    null,
    "polls-export-retry",
    { successMessage: "Export retry started." },
  );
}

export async function updatePollExportSchedule(
  scheduleId: string,
  body: { isActive?: boolean | undefined; name?: string | undefined },
) {
  return clientApi.patch<{ data: PollExportScheduleItem }>(
    `/api/v1/reports/polls/exports/schedules/${scheduleId}`,
    body,
    "polls-export-schedule-update",
    { successMessage: "Schedule updated." },
  );
}

export async function deletePollExportSchedule(scheduleId: string) {
  return clientApi.delete<{ data: { deleted: true; id: string } }>(
    `/api/v1/reports/polls/exports/schedules/${scheduleId}`,
    "polls-export-schedule-delete",
    undefined,
    { successMessage: "Schedule deleted." },
  );
}

export async function downloadPollExport(run: PollExportHistoryItem) {
  const format = run.format === "pdf" ? "csv" : run.format;
  await downloadReportExport(run.id, format);
}

export function columnsForDataset(
  payload: PollsExportsPayload,
  dataset: PollExportDataset,
): PollExportColumn[] {
  if (dataset === "poll_summary") return payload.summaryColumns;
  if (dataset === "option_tallies") return payload.optionTalliesColumns;
  if (dataset === "non_respondents") return payload.nonRespondentsColumns;
  return payload.respondentsColumns;
}

export function isIdentityDataset(dataset: PollExportDataset): boolean {
  return dataset === "respondents" || dataset === "non_respondents";
}
