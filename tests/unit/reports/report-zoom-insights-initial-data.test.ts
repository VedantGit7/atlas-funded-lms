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

const zoom =
  await import("../../../frontend/apps/web/src/lib/server/report-zoom-insights-initial-data");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-17T07:30:00.000Z"));
  state.paths = [];
  state.fail = false;
});

afterEach(() => {
  vi.useRealTimers();
});

const PEOPLE =
  "/api/v1/reports/zoom-insights/participants?attendedFrom=2026-09-17T00%3A00%3A00.000Z&attendedTo=2026-10-17T23%3A59%3A59.999Z";

/*
 * Each Zoom insights page skips its first browser load when the server sent
 * data, so the server must ask for exactly what that load would have. These
 * are the requests the pages made in the browser before they were
 * server-rendered.
 */
describe("Zoom insights initial data", () => {
  it("asks for what each page's first browser load would", async () => {
    await zoom.loadZoomMeetingDetailData("m-1");
    await zoom.loadZoomParticipantDetailData("m-1", "p-1");
    await zoom.loadZoomConnectionData();
    await zoom.loadZoomPeopleData({});
    await zoom.loadZoomUnmatchedData();
    expect(state.paths).toEqual([
      "/api/v1/reports/zoom-insights/m-1",
      "/api/v1/reports/zoom-insights/m-1/participants?matchState=all&durationBucket=any&rejoinedOnly=false&columns=display_name%2Cemail%2Cjoin_time%2Cleave_time%2Cduration_seconds%2Cmatch_state%2Ccoverage%2Crejoins&page=1&limit=25",
      "/api/v1/reports/zoom-insights/m-1/participants/p-1",
      "/api/v1/reports/zoom-insights/connection",
      `${PEOPLE}&matchState=all&sortBy=meetings_attended&sortDir=desc&page=1&limit=25`,
      "/api/v1/reports/zoom-insights/unmatched?group=all&page=1&limit=50",
      "/api/v1/reports/zoom-insights/matching-rules",
    ]);
  });

  it("reads the participants match state from the address the way the page does", async () => {
    await zoom.loadZoomPeopleData({ matchState: "matched" });
    await zoom.loadZoomPeopleData({ matchState: ["guest", "matched"] });
    await zoom.loadZoomPeopleData({ matchState: "bogus" });
    expect(state.paths).toEqual([
      `${PEOPLE}&matchState=matched&sortBy=meetings_attended&sortDir=desc&page=1&limit=25`,
      `${PEOPLE}&matchState=guest&sortBy=meetings_attended&sortDir=desc&page=1&limit=25`,
      `${PEOPLE}&matchState=all&sortBy=meetings_attended&sortDir=desc&page=1&limit=25`,
    ]);
  });

  it("starts the participants page on the range it counted", async () => {
    await expect(zoom.loadZoomPeopleData({})).resolves.toMatchObject({
      range: { from: "2026-09-17", to: "2026-10-17" },
    });
  });

  it("keeps ids from the address inside their own path segments", async () => {
    await zoom.loadZoomParticipantDetailData("connection?x=1", "a/b");
    expect(state.paths).toEqual([
      "/api/v1/reports/zoom-insights/connection%3Fx%3D1/participants/a%2Fb",
    ]);
  });

  it("asks for no participants when the meeting fails to load", async () => {
    state.fail = true;
    await expect(zoom.loadZoomMeetingDetailData("m-1")).resolves.toEqual({
      detail: null,
      participants: null,
    });
    expect(state.paths).toEqual(["/api/v1/reports/zoom-insights/m-1"]);
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.fail = true;
    await expect(zoom.loadZoomConnectionData()).resolves.toBeNull();
    await expect(zoom.loadZoomPeopleData({})).resolves.toBeNull();
    await expect(zoom.loadZoomUnmatchedData()).resolves.toEqual({ unmatched: null, rules: null });
  });
});
