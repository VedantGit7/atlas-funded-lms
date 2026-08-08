"use client";

import { clientApi } from "../../../lib/client-api";

export const ZOOM_PARTICIPANT_COLUMN_OPTIONS = [
  { key: "display_name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "join_time", label: "Join time" },
  { key: "leave_time", label: "Leave time" },
  { key: "duration_seconds", label: "Duration" },
] as const;

export type ZoomParticipantColumnKey =
  (typeof ZOOM_PARTICIPANT_COLUMN_OPTIONS)[number]["key"];

export type ZoomMeetingListItem = {
  id: string;
  externalMeetingId: string;
  topic: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  attendanceCount: number;
};

export type ZoomMeetingDetail = ZoomMeetingListItem & {
  totalAttendanceSeconds: number;
  avgDurationSeconds: number | null;
};

export type ZoomParticipantItem = {
  id: string;
  membershipId: string | null;
  externalUserId: string | null;
  displayName: string | null;
  email: string | null;
  joinTime: string | null;
  leaveTime: string | null;
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

export async function fetchZoomMeetingsRoster(filters?: {
  q?: string;
  startedFrom?: string;
  startedTo?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
}) {
  return clientApi.get<{
    data: {
      items: ZoomMeetingListItem[];
      pageInfo: PageInfo;
      connectionStatus: "connected" | "disconnected" | "unknown";
    };
  }>(
    `/api/v1/reports/zoom-insights${buildQuery({
      q: filters?.q,
      startedFrom: filters?.startedFrom,
      startedTo: filters?.startedTo,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      page: filters?.page ?? 1,
      limit: 50,
    })}`,
  );
}

export async function fetchZoomMeetingDetail(meetingId: string) {
  return clientApi.get<{ data: ZoomMeetingDetail }>(
    `/api/v1/reports/zoom-insights/${meetingId}`,
  );
}

export async function fetchZoomMeetingParticipants(
  meetingId: string,
  filters: {
    displayName?: string;
    email?: string;
    joinedFrom?: string;
    joinedTo?: string;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    columns?: ZoomParticipantColumnKey[];
    page?: number;
  },
) {
  return clientApi.get<{
    data: {
      meetingId: string;
      topic: string | null;
      items: ZoomParticipantItem[];
      pageInfo: PageInfo;
      columns: string[];
    };
  }>(
    `/api/v1/reports/zoom-insights/${meetingId}/participants${buildQuery({
      displayName: filters.displayName,
      email: filters.email,
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

export async function exportZoomInsightsReport(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/zoom-insights/export",
    body,
    "zoom-insights-roster-export",
    { successMessage: "Zoom Insights export queued." },
  );
}
