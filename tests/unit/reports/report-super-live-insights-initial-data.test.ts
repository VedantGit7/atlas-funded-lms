import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ paths: [] as string[], fail: false }));
vi.mock("../../../frontend/apps/web/src/lib/server-api", () => ({
  serverApi: {
    get: (path: string) => {
      state.paths.push(path);
      return state.fail
        ? Promise.reject(new Error("The report is unavailable."))
        : Promise.resolve({ data: { path } });
    },
  },
}));

const insights =
  await import("../../../frontend/apps/web/src/lib/server/report-super-live-insights-initial-data");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-17T07:30:00.000Z"));
  state.paths = [];
  state.fail = false;
});

afterEach(() => {
  vi.useRealTimers();
});

/*
 * Each Super live insights page skips its first browser load when the server
 * sent data, so the server must ask for exactly what that load would have.
 * These are the requests the pages made in the browser before they were
 * server-rendered.
 */
describe("Super live insights initial data", () => {
  it("asks for what each page's first browser load would", async () => {
    await insights.loadSuperLiveInsightDetailData("s-1");
    await insights.loadSuperLiveInsightsTrendsData();
    await insights.loadSuperLiveInsightsOutliersData();
    await insights.loadSuperLiveInsightsCompareData({ ids: "s-1, s-2,s-1" });
    expect(state.paths).toEqual([
      "/api/v1/reports/super-live-insights/s-1",
      "/api/v1/reports/super-live-insights/trends?startedFrom=2026-09-17T00%3A00%3A00.000Z&startedTo=2026-10-17T23%3A59%3A59.999Z&granularity=week&breakDownBy=none",
      "/api/v1/reports/super-live-insights/outliers?startedFrom=2026-09-17T00%3A00%3A00.000Z&startedTo=2026-10-17T23%3A59%3A59.999Z&category=all&rateDeltaPts=20&unresolvedPct=20&shortDurationPct=25&lateStartMinutes=15&ignoreSmallSessions=true&minRecords=5",
      "/api/v1/reports/super-live-insights/compare?mode=sessions&ids=s-1%2Cs-2",
    ]);
  });

  it("starts the date-ranged pages on the range it counted", async () => {
    await expect(insights.loadSuperLiveInsightsTrendsData()).resolves.toMatchObject({
      range: { from: "2026-09-17", to: "2026-10-17" },
    });
    await expect(insights.loadSuperLiveInsightsOutliersData()).resolves.toMatchObject({
      range: { from: "2026-09-17", to: "2026-10-17" },
    });
  });

  it("reads the compare address the way the page does", async () => {
    await expect(insights.loadSuperLiveInsightsCompareData({ ids: "s-1" })).resolves.toBeNull();
    await expect(insights.loadSuperLiveInsightsCompareData({})).resolves.toBeNull();
    await insights.loadSuperLiveInsightsCompareData({
      mode: "series",
      seriesKind: "batch",
      ids: ["b-1,b-2,b-3,b-4,b-5", "x"],
    });
    await insights.loadSuperLiveInsightsCompareData({
      mode: "other",
      seriesKind: "batch",
      ids: "a,b",
    });
    expect(state.paths).toEqual([
      "/api/v1/reports/super-live-insights/compare?mode=series&ids=b-1%2Cb-2%2Cb-3%2Cb-4&seriesKind=batch",
      "/api/v1/reports/super-live-insights/compare?mode=sessions&ids=a%2Cb",
    ]);
  });

  it("keeps a session id from the address inside its own path segment", async () => {
    await insights.loadSuperLiveInsightDetailData("trends?x=1");
    expect(state.paths).toEqual(["/api/v1/reports/super-live-insights/trends%3Fx%3D1"]);
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.fail = true;
    await expect(insights.loadSuperLiveInsightDetailData("s-1")).resolves.toBeNull();
    await expect(insights.loadSuperLiveInsightsTrendsData()).resolves.toBeNull();
  });
});
