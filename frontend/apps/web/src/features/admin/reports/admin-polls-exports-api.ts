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

export type PollExportFormat = ReportExportFormat;
export type PollExportDataset =
  | "poll_summary"
  | "option_tallies"
  | "respondents"
  | "non_respondents";
export type PollExportDelivery = ReportExportDelivery;
export type PollExportCadence = ReportExportCadence;
export type PollExportGrouping = "none" | "poll" | "live_session" | "option";
export type PollExportStatus = ReportExportStatus;

export type PollExportColumn = ReportExportColumn;

export type PollExportHistoryItem = ReportExportHistoryItem<PollExportDataset> & {
  requestedByLabel: string;
  anonymousExcludedCount: number | null;
};

export type PollExportScheduleItem = ReportExportScheduleItem;

export type PollsExportsPayload = {
  history: PollExportHistoryItem[];
  schedules: PollExportScheduleItem[];
  summaryColumns: PollExportColumn[];
  optionTalliesColumns: PollExportColumn[];
  respondentsColumns: PollExportColumn[];
  nonRespondentsColumns: PollExportColumn[];
  capabilities: ReportExportCapabilities<PollExportDataset>;
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

export const pollsExportsApi = createReportExportsApi<{
  payload: PollsExportsPayload;
  createBody: CreatePollExportBody;
}>("polls");

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
