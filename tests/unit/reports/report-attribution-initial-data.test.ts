import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ paths: [] as string[], failing: [] as string[] }));
vi.mock("../../../frontend/apps/web/src/lib/server-api", () => ({
  serverApi: {
    get: (path: string) => {
      state.paths.push(path);
      return state.failing.some((part) => path.includes(part))
        ? Promise.reject(new Error("The report is unavailable."))
        : Promise.resolve({
            data: path.includes("/exports/settings") ? { settings: { path } } : { path },
          });
    },
  },
}));

const attribution =
  await import("../../../frontend/apps/web/src/lib/server/report-attribution-initial-data");

beforeEach(() => {
  state.paths = [];
  state.failing = [];
});

const A = "/api/v1/sales/attribution";

/*
 * Each Attribution screen skips its first browser load when the server sent
 * data, so the server must ask for exactly what that load would have. These
 * are the requests the screens made in the browser before they were
 * server-rendered.
 */
describe("Attribution initial data", () => {
  it("asks for what each screen's first browser load would", async () => {
    await attribution.loadAttributionLogData({});
    await attribution.loadAttributionEventData("event-1");
    await attribution.loadAttributionBreakdownData({});
    await attribution.loadAttributionHealthData();
    await attribution.loadAttributionAnomaliesData();
    await attribution.loadAttributionGapsData();
    await attribution.loadAttributionSettingsData();
    expect(state.paths).toEqual([
      `${A}?limit=50`,
      `${A}/summary`,
      `${A}/event-1`,
      `${A}/breakdown?dimension=source`,
      `${A}/health?days=30`,
      `${A}/anomalies?days=30`,
      `${A}/unattributed?days=30`,
      `${A}/summary`,
      "/api/v1/marketing/integrations/snippets",
      "/api/v1/reports/exports/settings",
      `${A}/retention`,
    ]);
  });

  it("reads the log's filters from the address the way the page does", async () => {
    await attribution.loadAttributionLogData({
      utmSource: "google",
      utmMediumUnset: "true",
      utmCampaignUnset: "yes",
      attribution: ["attributed", "none"],
      q: " diwali ",
    });
    const query = "q=diwali&attribution=attributed&utmSource=google&utmMediumUnset=true";
    expect(state.paths).toEqual([`${A}?${query}&limit=50`, `${A}/summary?${query}`]);
  });

  it("leaves a log with a date bound to the browser, which knows the viewer's midnight", async () => {
    await expect(attribution.loadAttributionLogData({ from: "2026-09-01" })).resolves.toBeNull();
    await expect(
      attribution.loadAttributionLogData({ to: "2026-09-30T23:59:59.999Z" }),
    ).resolves.toBeNull();
    expect(state.paths).toEqual([]);
  });

  it("reads the breakdown's axis and filters from the address the way the page does", async () => {
    await attribution.loadAttributionBreakdownData({
      dimension: "medium",
      eventType: "purchase_completed",
      from: "2026-09-01T00:00:00.000Z",
      attribution: "bogus",
    });
    await attribution.loadAttributionBreakdownData({ dimension: "bogus", attribution: "none" });
    expect(state.paths).toEqual([
      `${A}/breakdown?eventType=purchase_completed&from=2026-09-01T00%3A00%3A00.000Z&dimension=medium`,
      `${A}/breakdown?attribution=none&dimension=source`,
    ]);
  });

  it("keeps an event id inside its own path segment", async () => {
    await attribution.loadAttributionEventData("a/b?c");
    expect(state.paths).toEqual([`${A}/a%2Fb%3Fc`]);
  });

  it("gives the settings page every section, or nothing", async () => {
    await expect(attribution.loadAttributionSettingsData()).resolves.toMatchObject({
      data: {
        summary: { path: `${A}/summary` },
        rules: { path: "/api/v1/reports/exports/settings" },
        retention: { path: `${A}/retention` },
      },
    });
    state.failing = ["/snippets"];
    await expect(attribution.loadAttributionSettingsData()).resolves.toBeNull();
  });

  it("gives the log its first page and totals together, or nothing", async () => {
    state.failing = ["/summary"];
    await expect(attribution.loadAttributionLogData({})).resolves.toBeNull();
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.failing = ["/"];
    await expect(attribution.loadAttributionEventData("event-1")).resolves.toBeNull();
    await expect(attribution.loadAttributionBreakdownData({})).resolves.toBeNull();
    await expect(attribution.loadAttributionHealthData()).resolves.toBeNull();
    await expect(attribution.loadAttributionAnomaliesData()).resolves.toBeNull();
    await expect(attribution.loadAttributionGapsData()).resolves.toBeNull();
  });
});
