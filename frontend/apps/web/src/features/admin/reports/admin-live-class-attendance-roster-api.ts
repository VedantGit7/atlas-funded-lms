"use client";

import { clientApi } from "../../../lib/client-api";

export const LIVE_ATTENDANCE_COLUMN_OPTIONS = [
  { key: "learner_name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "status", label: "Status" },
  { key: "joined_at", label: "Joined" },
  { key: "left_at", label: "Left" },
  { key: "duration_seconds", label: "Duration" },
] as const;

export type LiveAttendanceColumnKey =
  (typeof LIVE_ATTENDANCE_COLUMN_OPTIONS)[number]["key"];

export type LiveSessionListItem = {
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
  attendanceCount: number;
  registeredCount: number;
};

export type LiveSessionDetail = LiveSessionListItem & {
  totalAttendanceSeconds: number;
  avgDurationSeconds: number | null;
};

export type LiveAttendeeItem = {
  id: string;
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  status: string;
  joinedAt: string | null;
  leftAt: string | null;
  durationSeconds: number | null;
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

export async function fetchLiveClassSessionsRoster(filters?: {
  q?: string;
  status?: string;
  startedFrom?: string;
  startedTo?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
}) {
  return clientApi.get<{
    data: {
      items: LiveSessionListItem[];
      pageInfo: PageInfo;
    };
  }>(
    `/api/v1/reports/live-class-attendance${buildQuery({
      q: filters?.q,
      status: filters?.status,
      startedFrom: filters?.startedFrom,
      startedTo: filters?.startedTo,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      page: filters?.page ?? 1,
      limit: 50,
    })}`,
  );
}

export async function fetchLiveClassSessionDetail(sessionId: string) {
  return clientApi.get<{ data: LiveSessionDetail }>(
    `/api/v1/reports/live-class-attendance/${sessionId}`,
  );
}

export async function fetchLiveClassSessionAttendees(
  sessionId: string,
  filters: {
    learnerName?: string;
    email?: string;
    status?: string;
    joinedFrom?: string;
    joinedTo?: string;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    columns?: LiveAttendanceColumnKey[];
    page?: number;
  },
) {
  return clientApi.get<{
    data: {
      sessionId: string;
      sessionTitle: string;
      items: LiveAttendeeItem[];
      pageInfo: PageInfo;
      columns: string[];
    };
  }>(
    `/api/v1/reports/live-class-attendance/${sessionId}/attendees${buildQuery({
      learnerName: filters.learnerName,
      email: filters.email,
      status: filters.status,
      joinedFrom: filters.joinedFrom,
      joinedTo: filters.joinedTo,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      columns: filters.columns?.join(","),
      page: filters.page ?? 1,
      limit: 25,
    })}`,
  );
}

export async function exportLiveClassAttendanceReport(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/live-class-attendance/export",
    body,
    "live-class-attendance-roster-export",
    { successMessage: "Live Class Attendance export queued." },
  );
}
