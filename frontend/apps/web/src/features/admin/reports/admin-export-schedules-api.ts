"use client";

import { clientApi } from "../../../lib/client-api";
import { EXPORTS_REPORT_DEFINITIONS } from "./admin-exports-roster-api";

export { EXPORTS_REPORT_DEFINITIONS };

export type ScheduleDestinationKind = "download" | "email" | "webhook" | "storage";

export type ScheduleDestinationChip = {
  kind: ScheduleDestinationKind;
  label: string;
  detail: string | null;
};

export type SchedulesRosterItem = {
  id: string;
  name: string;
  definitionKey: string;
  definitionTitle: string;
  cronExpression: string;
  timezone: string;
  cadenceLabel: string;
  cadenceKind: "hourly" | "daily" | "weekly" | "monthly" | "custom";
  formats: Array<"csv" | "xlsx" | "pdf" | "json">;
  primaryFormat: "csv" | "xlsx" | "pdf" | "json";
  destinations: ScheduleDestinationChip[];
  isExternal: boolean;
  isActive: boolean;
  isFailing: boolean;
  consecutiveFailures: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunRowCount: number | null;
  lastRunErrorMessage: string | null;
  pastRunCount: number;
  ownerMembershipId: string;
  ownerName: string | null;
  ownerInitials: string;
  createdAt: string;
  updatedAt: string;
};

export type SchedulesRosterSummary = {
  totalCount: number;
  enabledCount: number;
  pausedCount: number;
  runsThisMonth: number;
  runsSucceededThisMonth: number;
  runsFailedThisMonth: number;
  nextRunAt: string | null;
  nextScheduleName: string | null;
  failingCount: number;
  maxConsecutiveFailures: number;
  externalDeliveryCount: number;
};

export type ScheduleStatusFilter = "enabled" | "paused" | "failing" | "all";
export type ScheduleCadenceFilter = "hourly" | "daily" | "weekly" | "monthly" | "custom" | "any";
export type ScheduleDestinationFilter = "download" | "email" | "webhook" | "storage" | "any";
export type ScheduleSort = "next_run_asc" | "last_run_desc" | "name_asc" | "failures_desc";

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type SchedulesRosterFilters = {
  q?: string | undefined;
  definitionKey?: string | undefined;
  status?: ScheduleStatusFilter | undefined;
  cadence?: ScheduleCadenceFilter | undefined;
  destination?: ScheduleDestinationFilter | undefined;
  ownerMembershipId?: string | undefined;
  sort?: ScheduleSort | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchSchedulesRoster(filters?: SchedulesRosterFilters) {
  return clientApi.get<{
    data: {
      items: SchedulesRosterItem[];
      pageInfo: PageInfo;
      summary: SchedulesRosterSummary;
    };
  }>(
    `/api/v1/reports/exports/schedules${buildQuery({
      q: filters?.q,
      definitionKey: filters?.definitionKey,
      status: filters?.status,
      cadence: filters?.cadence,
      destination: filters?.destination,
      ownerMembershipId: filters?.ownerMembershipId,
      sort: filters?.sort,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 50,
    })}`,
  );
}

export async function updateReportSchedule(
  id: string,
  body: { isActive?: boolean; name?: string },
) {
  return clientApi.patch<{ data: { id: string; isActive: boolean } }>(
    `/api/v1/reports/schedules/${id}`,
    body,
    `schedule-update-${id}`,
  );
}

export async function deleteReportSchedule(id: string) {
  return clientApi.delete<{ data: { deleted: true; id: string } }>(
    `/api/v1/reports/schedules/${id}`,
    `schedule-delete-${id}`,
  );
}

export async function runScheduleNow(id: string) {
  return clientApi.post<{
    data: { scheduleId: string; runId: string; status: string };
  }>(`/api/v1/reports/exports/schedules/${id}/run`, {}, `schedule-run-now-${id}`);
}

export async function bulkMutateSchedules(body: {
  action: "pause" | "enable" | "delete" | "run_now";
  ids: string[];
}) {
  return clientApi.post<{
    data: {
      action: string;
      processed: number;
      failed: number;
      runIds?: string[];
    };
  }>("/api/v1/reports/exports/schedules/bulk", body, `schedules-bulk-${body.action}`);
}

export type ScheduleDetailRun = {
  id: string;
  fileName: string | null;
  status: string;
  rowCount: number | null;
  rowDelta: number | null;
  durationMs: number | null;
  durationLabel: string | null;
  startedAt: string | null;
  completedAt: string | null;
  format: "csv" | "xlsx" | "pdf" | "json" | null;
  hasFile: boolean;
  canDownload: boolean;
  deliveryKind: ScheduleDestinationKind | "unknown" | null;
  deliveryLabel: string | null;
  deliveryStatus: "succeeded" | "failed" | "pending" | "skipped" | null;
  deliveryError: string | null;
  errorMessage: string | null;
};

export type ScheduleDetail = {
  id: string;
  name: string;
  definitionKey: string;
  definitionTitle: string;
  isActive: boolean;
  isFailing: boolean;
  cadenceLabel: string;
  primaryFormat: "csv" | "xlsx" | "pdf" | "json";
  destinations: ScheduleDestinationChip[];
  isExternal: boolean;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  ownerName: string | null;
  stats: {
    nextRunAt: string | null;
    totalRuns: number;
    succeededRuns: number;
    failedRuns: number;
    successRatePercent: number | null;
    avgDurationMs: number | null;
    avgRowCount: number | null;
    rowSparkline: number[];
  };
  config: {
    reportTitle: string;
    definitionKey: string;
    filterChips: Array<{ key: string; label: string; value: string }>;
    columns: string[];
    columnCount: number;
    format: "csv" | "xlsx" | "pdf" | "json";
    formatOptionsLabel: string | null;
    rowLimit: number | null;
    cadenceLabel: string;
    cronExpression: string;
    timezone: string;
    retentionDays: number | null;
    destinations: ScheduleDestinationChip[];
    isExternal: boolean;
    externalWarning: string | null;
    editBuilderHref: string;
  };
  trouble: {
    consecutiveFailures: number;
    lastErrorMessage: string;
    failingSinceAt: string | null;
    failingRunId: string | null;
    retriesRemainingBeforePause: number | null;
  } | null;
  runs: ScheduleDetailRun[];
  runsPageInfo: PageInfo;
};

export async function fetchScheduleDetail(
  scheduleId: string,
  opts?: { runsPage?: number; runsLimit?: number },
) {
  const search = new URLSearchParams();
  if (opts?.runsPage) search.set("runsPage", String(opts.runsPage));
  if (opts?.runsLimit) search.set("runsLimit", String(opts.runsLimit));
  const q = search.toString();
  return clientApi.get<{ data: ScheduleDetail }>(
    `/api/v1/reports/exports/schedules/${scheduleId}${q ? `?${q}` : ""}`,
  );
}

export async function duplicateSchedule(scheduleId: string) {
  return clientApi.post<{ data: { id: string; name: string } }>(
    `/api/v1/reports/exports/schedules/${scheduleId}/duplicate`,
    {},
    `schedule-duplicate-${scheduleId}`,
  );
}
