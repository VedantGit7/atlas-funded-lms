import { beforeEach, describe, expect, it, vi } from "vitest";

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

const exportsData =
  await import("../../../frontend/apps/web/src/lib/server/report-exports-initial-data");

beforeEach(() => {
  state.paths = [];
  state.fail = false;
});

const E = "/api/v1/reports/exports";

/*
 * Each Exports page skips its first browser load when the server sent data,
 * so the server must ask for exactly what that load would have. These are the
 * requests the pages made in the browser before they were server-rendered.
 */
describe("Exports initial data", () => {
  it("asks for what each page's first browser load would", async () => {
    await exportsData.loadExportRunData("run-1", {});
    await exportsData.loadExportScheduleData("schedule-1");
    await exportsData.loadExportSchedulesData();
    await exportsData.loadExportDestinationsData();
    expect(state.paths).toEqual([
      `${E}/run-1`,
      `${E}/schedules/schedule-1?runsPage=1&runsLimit=10`,
      `${E}/schedules?status=all&cadence=any&destination=any&sort=next_run_asc&page=1&limit=50`,
      `${E}/destinations?kind=any&status=all&sort=name_asc&page=1&limit=50`,
    ]);
  });

  it("reads a run's source from the address the way the page does", async () => {
    await exportsData.loadExportRunData("run-1", { source: "export_job" });
    await exportsData.loadExportRunData("run-1", { source: ["report_run", "export_job"] });
    await exportsData.loadExportRunData("run-1", { source: "bogus" });
    expect(state.paths).toEqual([
      `${E}/run-1?sourceType=export_job`,
      `${E}/run-1?sourceType=report_run`,
      `${E}/run-1`,
    ]);
  });

  it("keeps ids inside their own path segments", async () => {
    await exportsData.loadExportRunData("a/b?c", {});
    await exportsData.loadExportScheduleData("d/e");
    expect(state.paths).toEqual([`${E}/a%2Fb%3Fc`, `${E}/schedules/d%2Fe?runsPage=1&runsLimit=10`]);
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.fail = true;
    await expect(exportsData.loadExportRunData("run-1", {})).resolves.toBeNull();
    await expect(exportsData.loadExportScheduleData("schedule-1")).resolves.toBeNull();
    await expect(exportsData.loadExportSchedulesData()).resolves.toBeNull();
    await expect(exportsData.loadExportDestinationsData()).resolves.toBeNull();
    await expect(exportsData.loadNewExportData()).resolves.toEqual({
      definitions: null,
      destinations: null,
    });
    await expect(exportsData.loadExportSettingsData()).resolves.toBeNull();
    await expect(exportsData.loadAttributionExportSummaryData({})).resolves.toBeNull();
  });
});

describe("Export builder, settings and Attribution export initial data", () => {
  it("asks for what each page's first browser load would", async () => {
    await exportsData.loadNewExportData();
    await exportsData.loadExportSettingsData();
    await exportsData.loadAttributionExportSummaryData({});
    expect(state.paths).toEqual([
      "/api/v1/reports/definitions",
      `${E}/destinations?status=enabled&sort=name_asc&page=1&limit=100`,
      `${E}/settings`,
      "/api/v1/sales/attribution/summary",
    ]);
  });

  it("counts the Attribution export's filters the way the page reads them, without a UTM axis", async () => {
    await exportsData.loadAttributionExportSummaryData({
      eventType: "purchase_completed",
      attribution: "none",
      q: " diwali ",
      utmSource: "google",
    });
    expect(state.paths).toEqual([
      "/api/v1/sales/attribution/summary?eventType=purchase_completed&q=diwali&attribution=none",
    ]);
  });

  it("leaves an Attribution export with a date bound to the browser, which knows the viewer's midnight", async () => {
    await expect(
      exportsData.loadAttributionExportSummaryData({ from: "2026-09-01" }),
    ).resolves.toBeNull();
    await expect(
      exportsData.loadAttributionExportSummaryData({ to: "2026-09-30T23:59:59.999Z" }),
    ).resolves.toBeNull();
    expect(state.paths).toEqual([]);
  });
});
