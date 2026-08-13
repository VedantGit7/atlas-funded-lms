import type { LiveDashboardNowSessionRow, LiveDashboardNowSnapshot } from "./insights.repository";

export const LIVE_NOW_ATTENDANCE_HREF = "/admin/reports/live-class-attendance";
export const LIVE_NOW_SESSIONS_HREF = "/admin/live-sessions";

export type InsightLiveNowSession = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  attendedCount: number;
  registeredCount: number;
  rosteredCount: number;
  attendanceRate: number;
  expectedAttended: number | null;
  fillRate: number | null;
  batchId: string | null;
  batchKey: string | null;
  batchLabel: string | null;
  href: string;
  watchHref: string;
};

export type InsightLiveNowNextGroupId = "within-hour" | "later-today" | "later";

export type InsightLiveNowNextGroup = {
  id: InsightLiveNowNextGroupId;
  label: string;
  count: number;
  sessions: InsightLiveNowSession[];
};

export type InsightLiveNowBoard = {
  slug: "live-dashboard";
  title: string;
  generatedAt: string;
  caveat: string;
  quiet: boolean;
  attendanceHref: string;
  sessionsHref: string;
  dashboardHref: string;
  attendanceRate30d: number;
  liveSessions: InsightLiveNowSession[];
  nextUpGroups: InsightLiveNowNextGroup[];
  nextUpCount: number;
  endedToday: InsightLiveNowSession[];
  endedTodayTotal: number;
  nextSession: {
    id: string;
    title: string;
    scheduledAt: string | null;
    href: string;
  } | null;
};

function sessionHref(batchId: string | null, sessionId: string): string {
  if (batchId) {
    return `/admin/reports/batches/${batchId}/live-sessions/${sessionId}`;
  }
  return LIVE_NOW_SESSIONS_HREF;
}

function batchLabel(row: LiveDashboardNowSessionRow): string | null {
  if (row.batchKey) return row.batchKey;
  if (row.batchName) return row.batchName;
  return null;
}

function mapSession(
  row: LiveDashboardNowSessionRow,
  attendanceRate30d: number,
): InsightLiveNowSession {
  const href = sessionHref(row.batchId, row.id);
  const rostered = Math.max(row.rosteredCount, row.registeredCount);
  const fillRate = rostered > 0 ? Math.round((row.registeredCount / rostered) * 100) : null;
  const expectedAttended =
    attendanceRate30d > 0 && row.registeredCount > 0
      ? Math.round((row.registeredCount * attendanceRate30d) / 100)
      : null;

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    scheduledAt: row.scheduledAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    attendedCount: row.attendedCount,
    registeredCount: row.registeredCount,
    rosteredCount: rostered,
    attendanceRate: row.attendanceRate,
    expectedAttended,
    fillRate,
    batchId: row.batchId,
    batchKey: row.batchKey,
    batchLabel: batchLabel(row),
    href,
    watchHref: href,
  };
}

function groupNextUp(
  sessions: InsightLiveNowSession[],
  now = new Date(),
): InsightLiveNowNextGroup[] {
  const withinHour: InsightLiveNowSession[] = [];
  const laterToday: InsightLiveNowSession[] = [];
  const later: InsightLiveNowSession[] = [];

  const hourMs = 60 * 60 * 1000;
  const endOfUtcDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23,
    59,
    59,
    999,
  );

  for (const session of sessions) {
    if (!session.scheduledAt) {
      later.push(session);
      continue;
    }
    const start = new Date(session.scheduledAt).getTime();
    if (Number.isNaN(start)) {
      later.push(session);
      continue;
    }
    const delta = start - now.getTime();
    if (delta <= hourMs) {
      withinHour.push(session);
    } else if (start <= endOfUtcDay) {
      laterToday.push(session);
    } else {
      later.push(session);
    }
  }

  const groups: InsightLiveNowNextGroup[] = [];
  if (withinHour.length > 0) {
    groups.push({
      id: "within-hour",
      label: `Within the hour (${withinHour.length})`,
      count: withinHour.length,
      sessions: withinHour,
    });
  }
  if (laterToday.length > 0) {
    groups.push({
      id: "later-today",
      label: `Later today (${laterToday.length})`,
      count: laterToday.length,
      sessions: laterToday,
    });
  }
  if (later.length > 0) {
    groups.push({
      id: "later",
      label: `Later (${later.length})`,
      count: later.length,
      sessions: later,
    });
  }
  return groups;
}

export function buildInsightLiveNow(
  snapshot: LiveDashboardNowSnapshot,
  generatedAt = new Date().toISOString(),
): InsightLiveNowBoard {
  const liveSessions = snapshot.liveSessions.map((row) =>
    mapSession(row, snapshot.attendanceRate30d),
  );
  const nextUp = snapshot.nextUp.map((row) => mapSession(row, snapshot.attendanceRate30d));
  const endedToday = snapshot.endedToday.map((row) => mapSession(row, snapshot.attendanceRate30d));
  const nextSession = snapshot.nextSession
    ? {
        id: snapshot.nextSession.id,
        title: snapshot.nextSession.title,
        scheduledAt: snapshot.nextSession.scheduledAt,
        href: LIVE_NOW_SESSIONS_HREF,
      }
    : null;

  return {
    slug: "live-dashboard",
    title: "Now",
    generatedAt,
    caveat:
      "This board reads a snapshot taken when the page was generated. It does not update on its own - refresh to see the current state.",
    quiet: liveSessions.length === 0,
    attendanceHref: LIVE_NOW_ATTENDANCE_HREF,
    sessionsHref: LIVE_NOW_SESSIONS_HREF,
    dashboardHref: "/admin/insights/live-dashboard",
    attendanceRate30d: snapshot.attendanceRate30d,
    liveSessions,
    nextUpGroups: groupNextUp(nextUp),
    nextUpCount: nextUp.length,
    endedToday,
    endedTodayTotal: snapshot.endedTodayTotal,
    nextSession,
  };
}
