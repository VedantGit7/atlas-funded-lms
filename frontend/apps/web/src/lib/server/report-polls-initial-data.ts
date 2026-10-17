import "server-only";
import {
  LIVE_SESSIONS_WITH_POLLS_DEFAULTS,
  POLL_NON_RESPONDENTS_DEFAULTS,
  POLL_RESPONDENTS_DEFAULTS,
  POLL_RESPONDENT_COLUMN_OPTIONS,
  liveSessionPollReportPath,
  liveSessionsWithPollsPath,
  parsePollsCompareAlignBy,
  parsePollsCompareIds,
  pollDetailPath,
  pollLiveMonitorPath,
  pollNonRespondentsPath,
  pollOptionDetailPath,
  pollRespondentsPath,
  pollShowsRespondents,
  pollsComparePath,
  type LiveSessionPollReport,
  type LiveSessionsWithPollsPayload,
  type PollDetail,
  type PollLiveMonitor,
  type PollNonRespondentsPayload,
  type PollOptionDetail,
  type PollRespondentsPayload,
  type PollsCompareData,
} from "../../features/admin/reports/admin-polls-roster-api";
import { loadReportInitialData } from "./report-initial-data";
import { searchParam, type ReportSearchParams } from "./report-landing-initial-data";

/*
 * The first data each Polls report page shows, loaded on the server so the
 * page arrives filled in. Every path is the one the page's own first browser
 * load would request, so the page can skip that load; each resolves null on
 * failure and the page then loads in the browser as before.
 */

export function loadPollsLiveSessionsData() {
  return loadReportInitialData<LiveSessionsWithPollsPayload>(
    liveSessionsWithPollsPath(LIVE_SESSIONS_WITH_POLLS_DEFAULTS),
  );
}

export function loadLiveSessionPollReportData(liveSessionId: string) {
  return loadReportInitialData<LiveSessionPollReport>(liveSessionPollReportPath(liveSessionId));
}

/** A poll and, when it shows who answered, its first page of respondents. */
export async function loadPollDetailData(pollId: string) {
  const detail = await loadReportInitialData<PollDetail>(pollDetailPath(pollId));
  const respondents =
    detail && pollShowsRespondents(detail.data)
      ? await loadReportInitialData<PollRespondentsPayload>(
          pollRespondentsPath(pollId, {
            ...POLL_RESPONDENTS_DEFAULTS,
            columns: POLL_RESPONDENT_COLUMN_OPTIONS.map((column) => column.key),
          }),
        )
      : null;
  return { detail, respondents };
}

/** One option's report and, when the poll shows who answered, who chose it. */
export async function loadPollOptionDetailData(pollId: string, optionId: string) {
  const detail = await loadReportInitialData<PollOptionDetail>(
    pollOptionDetailPath(pollId, optionId),
  );
  const respondents =
    detail && pollShowsRespondents(detail.data)
      ? await loadReportInitialData<PollRespondentsPayload>(
          pollRespondentsPath(pollId, {
            optionId,
            sortBy: POLL_RESPONDENTS_DEFAULTS.sortBy,
            sortDir: POLL_RESPONDENTS_DEFAULTS.sortDir,
            page: POLL_RESPONDENTS_DEFAULTS.page,
          }),
        )
      : null;
  return { detail, respondents };
}

export function loadPollNonRespondentsData(pollId: string) {
  return loadReportInitialData<PollNonRespondentsPayload>(
    pollNonRespondentsPath(pollId, POLL_NON_RESPONDENTS_DEFAULTS),
  );
}

export function loadPollLiveMonitorData(pollId: string) {
  return loadReportInitialData<PollLiveMonitor>(pollLiveMonitorPath(pollId));
}

/** The comparison of the polls the address names; nothing to load for fewer than two. */
export function loadPollsCompareData(params: ReportSearchParams) {
  const ids = parsePollsCompareIds(searchParam(params, "pollIds"));
  if (ids.length < 2) return Promise.resolve(null);
  return loadReportInitialData<PollsCompareData>(
    pollsComparePath(ids, parsePollsCompareAlignBy(searchParam(params, "alignBy"))),
  );
}
