import "server-only";
import {
  BATCHES_ROSTER_DEFAULTS,
  batchesRosterPath,
  type BatchesRosterPayload,
} from "../../features/admin/reports/admin-batches-roster-api";
import {
  CUSTOM_FIELD_DEFINITIONS_PATH,
  CUSTOM_FIELD_ROSTER_DEFAULTS,
  customFieldRosterPath,
  type CustomFieldDefinitionsPayload,
  type CustomFieldRosterPayload,
} from "../../features/admin/reports/admin-custom-field-roster-api";
import {
  ENROLLMENT_ROSTER_DEFAULTS,
  enrollmentOverviewPath,
  enrollmentRosterPath,
  type EnrollmentOverview,
  type EnrollmentRosterResponse,
} from "../../features/admin/reports/admin-enrollments-roster-api";
import {
  EXPORTS_HISTORY_DEFAULTS,
  dateInputToEndIso as exportsDateToEndIso,
  dateInputToStartIso as exportsDateToStartIso,
  exportsHistoryPath,
  exportsHistoryPresetRange,
  type ExportsHistoryPayload,
} from "../../features/admin/reports/admin-exports-roster-api";
import {
  LIVE_SESSIONS_DEFAULT_DATE_PRESET,
  dateInputToEndIso as liveDateToEndIso,
  dateInputToStartIso as liveDateToStartIso,
  liveSessionsPresetRange,
  liveSessionsRosterPath,
  type LiveSessionsRosterPayload,
} from "../../features/admin/reports/admin-live-class-attendance-roster-api";
import {
  POLLS_ROSTER_DEFAULTS,
  pollsRosterPath,
  type PollsRosterPayload,
} from "../../features/admin/reports/admin-polls-roster-api";
import {
  PROGRESS_SCORE_DEFAULT_WINDOW,
  progressScoreOverviewPath,
  type ProgressScoreOverview,
} from "../../features/admin/reports/admin-progress-score-overview-api";
import {
  RESOURCE_USAGE_DEFAULT_PERIOD,
  resourceUsageOverviewPath,
  type ResourceUsageOverview,
} from "../../features/admin/reports/admin-resource-usage-roster-api";
import {
  ZOOM_MEETINGS_DEFAULTS,
  dateInputToEndIso as zoomDateToEndIso,
  dateInputToStartIso as zoomDateToStartIso,
  zoomMeetingsPresetRange,
  zoomMeetingsRosterPath,
  type ZoomMeetingsRosterPayload,
} from "../../features/admin/reports/admin-zoom-insights-roster-api";
import { loadReportInitialData, type ReportInitialDataInRange } from "./report-initial-data";

/*
 * The first data each report landing page shows, loaded on the server so the
 * page arrives filled in. Every path is the one the page's own first browser
 * load would request, built from the same defaults the page starts with, so
 * the page can skip that load. Each resolves null on failure and the page then
 * loads in the browser as before.
 */

async function loadInRange<T>(
  range: { from: string; to: string },
  path: string,
): Promise<ReportInitialDataInRange<T> | null> {
  const loaded = await loadReportInitialData<T>(path);
  return loaded === null ? null : { ...loaded, range };
}

export function loadProgressScoreLandingData() {
  return loadReportInitialData<ProgressScoreOverview>(
    progressScoreOverviewPath({ window: PROGRESS_SCORE_DEFAULT_WINDOW }),
  );
}

export function loadPollsLandingData() {
  return loadReportInitialData<PollsRosterPayload>(pollsRosterPath(POLLS_ROSTER_DEFAULTS));
}

export function loadBatchesLandingData() {
  return loadReportInitialData<BatchesRosterPayload>(batchesRosterPath(BATCHES_ROSTER_DEFAULTS));
}

export async function loadEnrollmentsLandingData() {
  const [roster, overview] = await Promise.all([
    loadReportInitialData<EnrollmentRosterResponse["data"]>(
      enrollmentRosterPath({
        ...ENROLLMENT_ROSTER_DEFAULTS,
        columns: [...ENROLLMENT_ROSTER_DEFAULTS.columns],
      }),
    ),
    loadReportInitialData<EnrollmentOverview>(enrollmentOverviewPath()),
  ]);
  return { roster, overview };
}

export async function loadCustomFieldLandingData() {
  const [roster, definitions] = await Promise.all([
    loadReportInitialData<CustomFieldRosterPayload>(
      customFieldRosterPath({
        ...CUSTOM_FIELD_ROSTER_DEFAULTS,
        columns: [...CUSTOM_FIELD_ROSTER_DEFAULTS.columns],
      }),
    ),
    loadReportInitialData<CustomFieldDefinitionsPayload>(CUSTOM_FIELD_DEFINITIONS_PATH),
  ]);
  return { roster, definitions };
}

export function loadZoomInsightsLandingData() {
  const range = zoomMeetingsPresetRange(ZOOM_MEETINGS_DEFAULTS.datePreset);
  const { datePreset: _datePreset, ...defaults } = ZOOM_MEETINGS_DEFAULTS;
  return loadInRange<ZoomMeetingsRosterPayload>(
    range,
    zoomMeetingsRosterPath({
      ...defaults,
      startedFrom: zoomDateToStartIso(range.from),
      startedTo: zoomDateToEndIso(range.to),
    }),
  );
}

export function loadLiveClassAttendanceLandingData() {
  const range = liveSessionsPresetRange(LIVE_SESSIONS_DEFAULT_DATE_PRESET);
  return loadInRange<LiveSessionsRosterPayload>(
    range,
    liveSessionsRosterPath({
      startedFrom: liveDateToStartIso(range.from),
      startedTo: liveDateToEndIso(range.to),
      page: 1,
    }),
  );
}

export function loadResourceUsageLandingData() {
  return loadReportInitialData<ResourceUsageOverview>(
    resourceUsageOverviewPath(RESOURCE_USAGE_DEFAULT_PERIOD),
  );
}

export function loadExportsLandingData() {
  const range = exportsHistoryPresetRange(EXPORTS_HISTORY_DEFAULTS.datePreset);
  return loadInRange<ExportsHistoryPayload>(
    range,
    exportsHistoryPath({
      createdFrom: exportsDateToStartIso(range.from),
      createdTo: exportsDateToEndIso(range.to),
      columns: [...EXPORTS_HISTORY_DEFAULTS.columns],
      page: EXPORTS_HISTORY_DEFAULTS.page,
      limit: EXPORTS_HISTORY_DEFAULTS.limit,
    }),
  );
}
