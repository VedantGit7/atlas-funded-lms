"use client";

import { clientApi } from "../../../lib/client-api";

export const SUPER_LIVE_INSIGHT_COLUMN_OPTIONS = [
  { key: "title", label: "Live class" },
  { key: "status", label: "Status" },
  { key: "course_title", label: "Course" },
  { key: "batch_name", label: "Batch" },
  { key: "scheduled_at", label: "Scheduled" },
  { key: "started_at", label: "Started" },
  { key: "ended_at", label: "Ended" },
  { key: "duration_seconds", label: "Duration" },
  { key: "attended_count", label: "Attended" },
  { key: "registered_count", label: "Registered" },
  { key: "absent_count", label: "Absent" },
  { key: "total_count", label: "Total" },
  { key: "avg_duration_seconds", label: "Avg duration" },
  { key: "attendance_rate", label: "Attendance %" },
] as const;

export type SuperLiveInsightColumnKey = (typeof SUPER_LIVE_INSIGHT_COLUMN_OPTIONS)[number]["key"];

export type SuperLiveInsightItem = {
  id: string;
  title: string;
  status: string;
  courseId: string | null;
  courseTitle: string | null;
  batchId: string | null;
  batchName: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  attendedCount: number;
  registeredCount: number;
  absentCount: number;
  totalCount: number;
  avgDurationSeconds: number | null;
  attendanceRate: number | null;
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type SuperLiveInsightsSummary = {
  sessionCount: number;
  totalAttended: number;
  totalRegistered: number;
  avgAttendanceRate: number | null;
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

export async function fetchSuperLiveInsightsRoster(filters?: {
  q?: string | undefined;
  status?: string | undefined;
  startedFrom?: string | undefined;
  startedTo?: string | undefined;
  minAttended?: number | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  columns?: SuperLiveInsightColumnKey[] | undefined;
  page?: number | undefined;
}) {
  return clientApi.get<{
    data: {
      items: SuperLiveInsightItem[];
      pageInfo: PageInfo;
      columns: string[];
      summary: SuperLiveInsightsSummary;
    };
  }>(
    `/api/v1/reports/super-live-insights${buildQuery({
      q: filters?.q,
      status: filters?.status,
      startedFrom: filters?.startedFrom,
      startedTo: filters?.startedTo,
      minAttended: filters?.minAttended,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      columns: filters?.columns?.join(","),
      page: filters?.page ?? 1,
      limit: 50,
    })}`,
  );
}

export async function fetchSuperLiveInsightDetail(sessionId: string) {
  return clientApi.get<{ data: SuperLiveInsightItem }>(
    `/api/v1/reports/super-live-insights/${sessionId}`,
  );
}

export async function exportSuperLiveInsightsReport(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/super-live-insights/export",
    body,
    "super-live-insights-roster-export",
    { successMessage: "Super Live Insights export queued." },
  );
}
