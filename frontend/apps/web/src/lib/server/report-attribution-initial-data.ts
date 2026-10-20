import "server-only";
import {
  ATTRIBUTION_DEFAULT_WINDOW_DAYS,
  attributionAnomaliesPath,
  attributionBreakdownPath,
  attributionEventPath,
  attributionEventsPath,
  attributionGapsPath,
  attributionHealthPath,
  attributionLogFilters,
  attributionSummaryPath,
  readAttributionBreakdownAddress,
  readAttributionLogFields,
  type AttributionAnomalies,
  type AttributionBreakdown,
  type AttributionEventDetail,
  type AttributionEventsPage,
  type AttributionGaps,
  type AttributionHealth,
  type AttributionLog,
  type AttributionSummary,
} from "../../features/admin/reports/attribution-api";
import {
  ATTRIBUTION_EXPORT_RULES_PATH,
  ATTRIBUTION_RETENTION_PATH,
  ATTRIBUTION_SNIPPETS_PATH,
  type AttributionExportRules,
  type AttributionRetention,
  type AttributionSettingsInitial,
  type AttributionSnippets,
} from "../../features/admin/reports/attribution-settings-api";
import { loadReportInitialData, type ReportInitialData } from "./report-initial-data";
import { searchParam, type ReportSearchParams } from "./report-landing-initial-data";

/*
 * The first data each Attribution screen shows, loaded on the server so the
 * page arrives filled in. Every path is the one the page's own first browser
 * load would request, so the page can skip that load; each resolves null on
 * failure and the page then loads in the browser as before.
 */

/**
 * The log's first page and totals for the filters in the address. A date
 * bound in the address is left to the browser: the page turns it into the
 * viewer's own midnight, which the server cannot know.
 */
export async function loadAttributionLogData(
  params: ReportSearchParams,
): Promise<ReportInitialData<AttributionLog> | null> {
  const fields = readAttributionLogFields((name) => searchParam(params, name));
  if (fields.fromDate.trim() !== "" || fields.toDate.trim() !== "") return null;
  const filters = attributionLogFilters(fields, undefined, undefined);
  const [page, summary] = await Promise.all([
    loadReportInitialData<AttributionEventsPage>(attributionEventsPath(filters)),
    loadReportInitialData<AttributionSummary>(attributionSummaryPath(filters)),
  ]);
  if (!page || !summary) return null;
  return {
    data: { page: page.data, summary: summary.data },
    loadedAt: Math.min(page.loadedAt, summary.loadedAt),
  };
}

export function loadAttributionEventData(eventId: string) {
  return loadReportInitialData<AttributionEventDetail>(attributionEventPath(eventId));
}

/** The breakdown for the axis and filters in the address. */
export function loadAttributionBreakdownData(params: ReportSearchParams) {
  const { dimension, filters } = readAttributionBreakdownAddress((name) =>
    searchParam(params, name),
  );
  return loadReportInitialData<AttributionBreakdown>(attributionBreakdownPath(filters, dimension));
}

export function loadAttributionHealthData() {
  return loadReportInitialData<AttributionHealth>(
    attributionHealthPath(ATTRIBUTION_DEFAULT_WINDOW_DAYS),
  );
}

export function loadAttributionAnomaliesData() {
  return loadReportInitialData<AttributionAnomalies>(
    attributionAnomaliesPath(ATTRIBUTION_DEFAULT_WINDOW_DAYS),
  );
}

export function loadAttributionGapsData() {
  return loadReportInitialData<AttributionGaps>(
    attributionGapsPath(ATTRIBUTION_DEFAULT_WINDOW_DAYS),
  );
}

/**
 * Every section of the settings page, or nothing: a refused section is told
 * apart from a failed one in the browser, as before.
 */
export async function loadAttributionSettingsData(): Promise<ReportInitialData<AttributionSettingsInitial> | null> {
  const [summary, snippets, rules, retention] = await Promise.all([
    loadReportInitialData<AttributionSummary>(attributionSummaryPath({})),
    loadReportInitialData<AttributionSnippets>(ATTRIBUTION_SNIPPETS_PATH),
    loadReportInitialData<{ settings: AttributionExportRules }>(ATTRIBUTION_EXPORT_RULES_PATH),
    loadReportInitialData<AttributionRetention>(ATTRIBUTION_RETENTION_PATH),
  ]);
  if (!summary || !snippets || !rules || !retention) return null;
  return {
    data: {
      summary: summary.data,
      snippets: snippets.data,
      rules: rules.data.settings,
      retention: retention.data,
    },
    loadedAt: Math.min(summary.loadedAt, snippets.loadedAt, rules.loadedAt, retention.loadedAt),
  };
}
