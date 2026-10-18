import "server-only";
import {
  DEFAULT_ZOOM_PARTICIPANT_COLUMNS,
  ZOOM_CONNECTION_PATH,
  ZOOM_MATCHING_RULES_PATH,
  ZOOM_MEETING_PARTICIPANTS_DEFAULTS,
  ZOOM_PEOPLE_DEFAULTS,
  ZOOM_UNMATCHED_DEFAULTS,
  dateInputToEndIso,
  dateInputToStartIso,
  parseZoomPeopleMatchState,
  zoomMeetingDetailPath,
  zoomMeetingParticipantsPath,
  zoomMeetingsPresetRange,
  zoomParticipantDetailPath,
  zoomPeopleRosterPath,
  zoomUnmatchedPath,
  type ZoomConnectionPayload,
  type ZoomMatchingRules,
  type ZoomMeetingDetail,
  type ZoomMeetingParticipantsPayload,
  type ZoomParticipantDetail,
  type ZoomPeopleRosterPayload,
  type ZoomUnmatchedPayload,
} from "../../features/admin/reports/admin-zoom-insights-roster-api";
import { loadReportInitialData, type ReportInitialDataInRange } from "./report-initial-data";
import { searchParam, type ReportSearchParams } from "./report-landing-initial-data";

/*
 * The first data each Zoom insights page shows, loaded on the server so the
 * page arrives filled in. Every path is the one the page's own first browser
 * load would request, so the page can skip that load; each resolves null on
 * failure and the page then loads in the browser as before.
 */

/** A meeting and, once it loaded, its first page of participants. */
export async function loadZoomMeetingDetailData(meetingId: string) {
  const detail = await loadReportInitialData<ZoomMeetingDetail>(zoomMeetingDetailPath(meetingId));
  const participants = detail
    ? await loadReportInitialData<ZoomMeetingParticipantsPayload>(
        zoomMeetingParticipantsPath(meetingId, {
          ...ZOOM_MEETING_PARTICIPANTS_DEFAULTS,
          columns: [...DEFAULT_ZOOM_PARTICIPANT_COLUMNS],
        }),
      )
    : null;
  return { detail, participants };
}

export function loadZoomParticipantDetailData(meetingId: string, participantId: string) {
  return loadReportInitialData<ZoomParticipantDetail>(
    zoomParticipantDetailPath(meetingId, participantId),
  );
}

export function loadZoomConnectionData() {
  return loadReportInitialData<ZoomConnectionPayload>(ZOOM_CONNECTION_PATH);
}

/** The first page of participants for the match state the address names, over the last 30 days. */
export async function loadZoomPeopleData(
  params: ReportSearchParams,
): Promise<ReportInitialDataInRange<ZoomPeopleRosterPayload> | null> {
  const range = zoomMeetingsPresetRange(ZOOM_PEOPLE_DEFAULTS.datePreset);
  const loaded = await loadReportInitialData<ZoomPeopleRosterPayload>(
    zoomPeopleRosterPath({
      attendedFrom: dateInputToStartIso(range.from),
      attendedTo: dateInputToEndIso(range.to),
      matchState: parseZoomPeopleMatchState(searchParam(params, "matchState")),
      sortBy: ZOOM_PEOPLE_DEFAULTS.sortBy,
      sortDir: ZOOM_PEOPLE_DEFAULTS.sortDir,
      page: ZOOM_PEOPLE_DEFAULTS.page,
      limit: ZOOM_PEOPLE_DEFAULTS.limit,
    }),
  );
  return loaded === null ? null : { ...loaded, range };
}

/** The first page of unmatched identities and the matching rules. */
export async function loadZoomUnmatchedData() {
  const [unmatched, rules] = await Promise.all([
    loadReportInitialData<ZoomUnmatchedPayload>(zoomUnmatchedPath(ZOOM_UNMATCHED_DEFAULTS)),
    loadReportInitialData<ZoomMatchingRules>(ZOOM_MATCHING_RULES_PATH),
  ]);
  return { unmatched, rules };
}
