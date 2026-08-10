"use client";

import { clientApi } from "../../../lib/client-api";

export const EXPORTS_HISTORY_COLUMN_OPTIONS = [
  { key: "source_type", label: "Source" },
  { key: "definition_title", label: "Report" },
  { key: "definition_key", label: "Definition key" },
  { key: "status", label: "Status" },
  { key: "format", label: "Format" },
  { key: "row_count", label: "Rows" },
  { key: "requested_by_name", label: "Requested by" },
  { key: "created_at", label: "Created" },
  { key: "completed_at", label: "Completed" },
  { key: "expires_at", label: "Expires" },
  { key: "has_file", label: "Has file" },
] as const;

export type ExportsHistoryColumnKey = (typeof EXPORTS_HISTORY_COLUMN_OPTIONS)[number]["key"];

export const EXPORTS_REPORT_DEFINITIONS = [
  { key: "enrollments", title: "Enrollments" },
  { key: "progress-score", title: "Progress & Score" },
  { key: "resource-usage", title: "Resource Usage" },
  { key: "exports", title: "Exports" },
  { key: "active-devices", title: "Active Devices" },
  { key: "payments", title: "Payments" },
  { key: "batches", title: "Batches" },
  { key: "polls", title: "Polls" },
  { key: "sales-marketing", title: "Sales & Marketing" },
  { key: "custom-field", title: "Custom Field" },
  { key: "zoom-insights", title: "Zoom Insights" },
  { key: "live-class-attendance", title: "Live Class Attendance" },
  { key: "super-live-insights", title: "Super Live Insights" },
  { key: "assessment-items", title: "Assessment Items" },
  { key: "certificates", title: "Certificates" },
  { key: "at-risk-roster", title: "At-Risk Roster" },
] as const;

export const PII_DEFINITION_KEYS = new Set<string>([
  "enrollments",
  "progress-score",
  "payments",
  "active-devices",
  "custom-field",
  "sales-marketing",
  "certificates",
  "at-risk-roster",
  "live-class-attendance",
  "zoom-insights",
  "super-live-insights",
]);

export type ExportsHistoryItem = {
  sourceType: "report_run" | "export_job";
  id: string;
  definitionKey: string | null;
  definitionTitle: string | null;
  status: string;
  format: string | null;
  rowCount: number | null;
  requestedByName: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  hasFile: boolean;
  canDownload: boolean;
  progressPercent: number | null;
  errorMessage: string | null;
};

export type ExportsHistorySummary = {
  totalCount: number;
  succeededCount: number;
  failedCount: number;
  pendingCount: number;
  filesAvailableCount: number;
  expiringSoonCount: number;
  oldestPendingTitle: string | null;
};

export type ExportsFileState = "available" | "removed" | "expired" | "expiring_soon";

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export function dateInputToStartIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return `${trimmed}T00:00:00.000Z`;
}

export function dateInputToEndIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return `${trimmed}T23:59:59.999Z`;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export type ExportsHistoryFilters = {
  sourceType?: string | undefined;
  status?: string | undefined;
  definitionKey?: string | undefined;
  format?: string | undefined;
  fileState?: ExportsFileState | undefined;
  mine?: boolean | undefined;
  pendingOnly?: boolean | undefined;
  createdFrom?: string | undefined;
  createdTo?: string | undefined;
  q?: string | undefined;
  columns?: ExportsHistoryColumnKey[] | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};

export async function fetchExportsHistory(filters?: ExportsHistoryFilters) {
  return clientApi.get<{
    data: {
      items: ExportsHistoryItem[];
      pageInfo: PageInfo;
      columns: string[];
      summary: ExportsHistorySummary;
    };
  }>(
    `/api/v1/reports/exports${buildQuery({
      sourceType: filters?.sourceType,
      status: filters?.status,
      definitionKey: filters?.definitionKey,
      format: filters?.format,
      fileState: filters?.fileState,
      mine: filters?.mine === true ? true : undefined,
      pendingOnly: filters?.pendingOnly === true ? true : undefined,
      createdFrom: filters?.createdFrom,
      createdTo: filters?.createdTo,
      q: filters?.q,
      columns: filters?.columns?.join(","),
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 50,
    })}`,
  );
}

export async function exportExportsHistoryReport(body: {
  sourceType?: string | undefined;
  status?: string | undefined;
  definitionKey?: string | undefined;
  format?: string | undefined;
  fileState?: ExportsFileState | undefined;
  mine?: boolean | undefined;
  pendingOnly?: boolean | undefined;
  createdFrom?: string | undefined;
  createdTo?: string | undefined;
  q?: string | undefined;
  columns?: string[] | undefined;
  emailDownloadLink?: boolean | undefined;
}) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/exports/export",
    body,
    "exports-roster-export",
    { successMessage: "Export History CSV queued." },
  );
}
