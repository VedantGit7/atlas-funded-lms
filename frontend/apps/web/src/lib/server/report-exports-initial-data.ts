import "server-only";
import {
  DESTINATIONS_ROSTER_DEFAULTS,
  destinationsRosterPath,
  type DestinationsRosterPayload,
} from "../../features/admin/reports/admin-export-destinations-api";
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
