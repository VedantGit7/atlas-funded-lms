import "server-only";
import {
  DESTINATIONS_ROSTER_DEFAULTS,
  ENABLED_DESTINATIONS_FILTERS,
  destinationsRosterPath,
  type DestinationsRosterPayload,
} from "../../features/admin/reports/admin-export-destinations-api";
import {
  EXPORT_SETTINGS_PATH,
  type ExportSettingsPayload,
} from "../../features/admin/reports/admin-export-settings-api";
import {
  exportRunDetailPath,
  exportRunSourceType,
  type ExportRunDetail,
} from "../../features/admin/reports/admin-export-run-detail-api";
import {
  SCHEDULES_ROSTER_DEFAULTS,
  SCHEDULE_DETAIL_RUNS_DEFAULTS,
  scheduleDetailPath,
  schedulesRosterPath,
  type ScheduleDetail,
  type SchedulesRosterPayload,
} from "../../features/admin/reports/admin-export-schedules-api";
import {
  REPORT_DEFINITIONS_PATH,
  type DomainDefinition,
} from "../../features/admin/reports/admin-reports-api";
import {
  ATTRIBUTION_EXPORT_AXIS,
  attributionLogFilters,
  attributionSummaryPath,
  readAttributionLogFields,
  type AttributionSummary,
} from "../../features/admin/reports/attribution-api";
import { loadReportInitialData } from "./report-initial-data";
import { searchParam, type ReportSearchParams } from "./report-landing-initial-data";

/*
 * The first data each Exports page shows, loaded on the server so the page
 * arrives filled in. Every path is the one the page's own first browser load
 * would request, so the page can skip that load; each resolves null on
 * failure and the page then loads in the browser as before.
 */

/** A run, from the source the address names with `?source=`, read the way the page reads it. */
export function loadExportRunData(runId: string, params: ReportSearchParams) {
  return loadReportInitialData<ExportRunDetail>(
    exportRunDetailPath(runId, exportRunSourceType(searchParam(params, "source"))),
  );
}

/** A schedule and its first page of runs. */
export function loadExportScheduleData(scheduleId: string) {
  return loadReportInitialData<ScheduleDetail>(
    scheduleDetailPath(scheduleId, SCHEDULE_DETAIL_RUNS_DEFAULTS),
  );
}

export function loadExportSchedulesData() {
  return loadReportInitialData<SchedulesRosterPayload>(
    schedulesRosterPath(SCHEDULES_ROSTER_DEFAULTS),
  );
}

export function loadExportDestinationsData() {
  return loadReportInitialData<DestinationsRosterPayload>(
    destinationsRosterPath(DESTINATIONS_ROSTER_DEFAULTS),
  );
}

/** The export builder's report definitions, as the API returns them, and the destinations it offers. */
export async function loadNewExportData() {
  const [definitions, destinations] = await Promise.all([
    loadReportInitialData<{ items: DomainDefinition[] }>(REPORT_DEFINITIONS_PATH),
    loadReportInitialData<DestinationsRosterPayload>(
      destinationsRosterPath(ENABLED_DESTINATIONS_FILTERS),
    ),
  ]);
  return { definitions, destinations };
}

export function loadExportSettingsData() {
  return loadReportInitialData<ExportSettingsPayload>(EXPORT_SETTINGS_PATH);
}

/**
 * The Attribution export screen's count for the filters in the address. A
 * date bound is left to the browser, which turns it into the viewer's own
 * midnight.
 */
export function loadAttributionExportSummaryData(params: ReportSearchParams) {
  const fields = readAttributionLogFields((name) => searchParam(params, name));
  if (fields.fromDate.trim() !== "" || fields.toDate.trim() !== "") return Promise.resolve(null);
  return loadReportInitialData<AttributionSummary>(
    attributionSummaryPath(
      attributionLogFilters({ ...fields, axis: ATTRIBUTION_EXPORT_AXIS }, undefined, undefined),
    ),
  );
}
