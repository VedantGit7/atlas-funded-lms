import "server-only";
import {
  LIVE_ATTENDANCE_COLUMN_OPTIONS,
  LIVE_LEARNERS_DEFAULTS,
  LIVE_SERIES_DEFAULTS,
  LIVE_SESSION_ATTENDEES_DEFAULTS,
  dateInputToEndIso,
  dateInputToStartIso,
  liveAttendeeDetailPath,
  liveLearnerDetailPath,
  liveLearnersPath,
  liveSeriesPath,
  liveSessionAttendeesPath,
  liveSessionDetailPath,
  liveSessionLiveMonitorPath,
  liveSessionsPresetRange,
  type LiveAttendeeDetail,
  type LiveClassSessionLiveMonitor,
  type LiveLearnerDetail,
  type LiveLearnersPayload,
  type LiveSeriesPayload,
  type LiveSessionAttendeesPayload,
  type LiveSessionDetail,
} from "../../features/admin/reports/admin-live-class-attendance-roster-api";
import { loadReportInitialData, type ReportInitialDataInRange } from "./report-initial-data";

/*
 * The first data each Live class attendance page shows, loaded on the server
 * so the page arrives filled in. Every path is the one the page's own first
 * browser load would request, so the page can skip that load; each resolves
 * null on failure and the page then loads in the browser as before.
 */

/** A session and its first page of attendees, which the page loads side by side. */
export async function loadLiveSessionDetailData(sessionId: string) {
  const [detail, attendees] = await Promise.all([
    loadReportInitialData<LiveSessionDetail>(liveSessionDetailPath(sessionId)),
    loadReportInitialData<LiveSessionAttendeesPayload>(
      liveSessionAttendeesPath(sessionId, {
        ...LIVE_SESSION_ATTENDEES_DEFAULTS,
        columns: LIVE_ATTENDANCE_COLUMN_OPTIONS.map((column) => column.key),
      }),
    ),
  ]);
  return { detail, attendees };
}

export function loadLiveAttendeeDetailData(sessionId: string, attendeeId: string) {
  return loadReportInitialData<LiveAttendeeDetail>(liveAttendeeDetailPath(sessionId, attendeeId));
}

/** The monitor's first snapshot; the page keeps polling from there. */
export function loadLiveMonitorData(sessionId: string) {
  return loadReportInitialData<LiveClassSessionLiveMonitor>(liveSessionLiveMonitorPath(sessionId));
}

export function loadLiveLearnerDetailData(membershipId: string) {
  return loadReportInitialData<LiveLearnerDetail>(liveLearnerDetailPath(membershipId));
}

/** The first page of learners over the last 30 days. */
export async function loadLiveLearnersData(): Promise<ReportInitialDataInRange<LiveLearnersPayload> | null> {
  const range = liveSessionsPresetRange(LIVE_LEARNERS_DEFAULTS.datePreset);
  const loaded = await loadReportInitialData<LiveLearnersPayload>(
    liveLearnersPath({
      scheduledFrom: dateInputToStartIso(range.from),
      scheduledTo: dateInputToEndIso(range.to),
      sortBy: LIVE_LEARNERS_DEFAULTS.sortBy,
      sortDir: LIVE_LEARNERS_DEFAULTS.sortDir,
      columns: [...LIVE_LEARNERS_DEFAULTS.columns],
      page: LIVE_LEARNERS_DEFAULTS.page,
    }),
  );
  return loaded === null ? null : { ...loaded, range };
}

/** The first page of series over the last 90 days. */
export async function loadLiveSeriesData(): Promise<ReportInitialDataInRange<LiveSeriesPayload> | null> {
  const range = liveSessionsPresetRange(LIVE_SERIES_DEFAULTS.datePreset);
  const { datePreset: _datePreset, ...defaults } = LIVE_SERIES_DEFAULTS;
  const loaded = await loadReportInitialData<LiveSeriesPayload>(
    liveSeriesPath({
      ...defaults,
      scheduledFrom: dateInputToStartIso(range.from),
      scheduledTo: dateInputToEndIso(range.to),
    }),
  );
  return loaded === null ? null : { ...loaded, range };
}
