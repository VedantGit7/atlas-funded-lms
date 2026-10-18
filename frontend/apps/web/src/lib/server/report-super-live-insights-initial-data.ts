import "server-only";
import {
  DEFAULT_OUTLIER_THRESHOLDS,
  SUPER_LIVE_INSIGHTS_OUTLIERS_DEFAULTS,
  SUPER_LIVE_INSIGHTS_TRENDS_DEFAULTS,
  dateInputToEndIso,
  dateInputToStartIso,
  parseSuperLiveInsightsCompareAddress,
  superLiveInsightDetailPath,
  superLiveInsightsComparePath,
  superLiveInsightsOutliersPath,
  superLiveInsightsPresetRange,
  superLiveInsightsTrendsPath,
  type SuperLiveInsightDetail,
  type SuperLiveInsightsCompareData,
  type SuperLiveInsightsOutliersData,
  type SuperLiveInsightsTrendsData,
} from "../../features/admin/reports/admin-super-live-insights-roster-api";
import { loadReportInitialData, type ReportInitialDataInRange } from "./report-initial-data";
import { searchParam, type ReportSearchParams } from "./report-landing-initial-data";

/*
 * The first data each Super live insights page shows, loaded on the server so
 * the page arrives filled in. Every path is the one the page's own first
 * browser load would request, so the page can skip that load; each resolves
 * null on failure and the page then loads in the browser as before.
 */

async function loadInRange<T>(
  range: { from: string; to: string },
  path: string,
): Promise<ReportInitialDataInRange<T> | null> {
  const loaded = await loadReportInitialData<T>(path);
  return loaded === null ? null : { ...loaded, range };
}

export function loadSuperLiveInsightDetailData(sessionId: string) {
  return loadReportInitialData<SuperLiveInsightDetail>(superLiveInsightDetailPath(sessionId));
}

export function loadSuperLiveInsightsTrendsData() {
  const range = superLiveInsightsPresetRange(SUPER_LIVE_INSIGHTS_TRENDS_DEFAULTS.datePreset);
  return loadInRange<SuperLiveInsightsTrendsData>(
    range,
    superLiveInsightsTrendsPath({
      startedFrom: dateInputToStartIso(range.from) ?? "",
      startedTo: dateInputToEndIso(range.to) ?? "",
      granularity: SUPER_LIVE_INSIGHTS_TRENDS_DEFAULTS.granularity,
      breakDownBy: SUPER_LIVE_INSIGHTS_TRENDS_DEFAULTS.breakDownBy,
    }),
  );
}

/** Opens on the default thresholds; ones the viewer saved are applied in the browser. */
export function loadSuperLiveInsightsOutliersData() {
  const range = superLiveInsightsPresetRange(SUPER_LIVE_INSIGHTS_OUTLIERS_DEFAULTS.datePreset);
  return loadInRange<SuperLiveInsightsOutliersData>(
    range,
    superLiveInsightsOutliersPath({
      startedFrom: dateInputToStartIso(range.from) ?? "",
      startedTo: dateInputToEndIso(range.to) ?? "",
      category: SUPER_LIVE_INSIGHTS_OUTLIERS_DEFAULTS.category,
      thresholds: DEFAULT_OUTLIER_THRESHOLDS,
    }),
  );
}

/** The comparison the address names; nothing to load for fewer than two. */
export function loadSuperLiveInsightsCompareData(params: ReportSearchParams) {
  const address = parseSuperLiveInsightsCompareAddress((name) => searchParam(params, name));
  if (address.ids.length < 2) return Promise.resolve(null);
  return loadReportInitialData<SuperLiveInsightsCompareData>(
    superLiveInsightsComparePath({
      mode: address.mode,
      ids: address.ids,
      ...(address.mode === "series" ? { seriesKind: address.seriesKind } : {}),
    }),
  );
}
