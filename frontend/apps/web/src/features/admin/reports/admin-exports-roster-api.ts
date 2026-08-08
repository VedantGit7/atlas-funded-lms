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

export type ExportsHistoryColumnKey =
  (typeof EXPORTS_HISTORY_COLUMN_OPTIONS)[number]["key"];

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
};

export type ExportsHistorySummary = {
  totalCount: number;
  succeededCount: number;
  failedCount: number;
  pendingCount: number;
};

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

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchExportsHistory(filters?: {
  sourceType?: string;
  status?: string;
  definitionKey?: string;
  createdFrom?: string;
  createdTo?: string;
  q?: string;
  columns?: ExportsHistoryColumnKey[];
  page?: number;
}) {
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
      createdFrom: filters?.createdFrom,
      createdTo: filters?.createdTo,
      q: filters?.q,
      columns: filters?.columns?.join(","),
      page: filters?.page ?? 1,
      limit: 50,
    })}`,
  );
}

export async function exportExportsHistoryReport(body: {
  sourceType?: string;
  status?: string;
  definitionKey?: string;
  createdFrom?: string;
  createdTo?: string;
  q?: string;
  columns?: string[];
  emailDownloadLink?: boolean;
}) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/exports/export",
    body,
    "exports-roster-export",
    { successMessage: "Export History CSV queued." },
  );
}
