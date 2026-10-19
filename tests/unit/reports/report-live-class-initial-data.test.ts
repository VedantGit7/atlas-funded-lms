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

const live =
  await import("../../../frontend/apps/web/src/lib/server/report-live-class-initial-data");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-17T07:30:00.000Z"));
  state.paths = [];
  state.fail = false;
});

afterEach(() => {
  vi.useRealTimers();
});

const BASE = "/api/v1/reports/live-class-attendance";

/*
 * Each Live class attendance page skips its first browser load when the
 * server sent data, so the server must ask for exactly what that load would
 * have. These are the requests the pages made in the browser before they were
 * server-rendered.
 */
describe("Live class attendance initial data", () => {
  it("asks for what each page's first browser load would", async () => {
    await live.loadLiveSessionDetailData("s-1");
    await live.loadLiveAttendeeDetailData("s-1", "a-1");
    await live.loadLiveMonitorData("s-2");
    await live.loadLiveLearnerDetailData("mem-1");
    await live.loadLiveLearnersData();
    await live.loadLiveSeriesData();
    expect(state.paths).toEqual([
      `${BASE}/s-1`,
      `${BASE}/s-1/attendees?sortBy=status&sortDir=asc&columns=learner_name%2Cemail%2Cstatus%2Cjoined_at%2Cleft_at%2Cduration_seconds&page=1&limit=25`,
      `${BASE}/s-1/attendees/a-1`,
      `${BASE}/s-2/live`,
      `${BASE}/learners/mem-1`,
      `${BASE}/learners?scheduledFrom=2026-09-17T00%3A00%3A00.000Z&scheduledTo=2026-10-17T23%3A59%3A59.999Z&sortBy=attendance_rate&sortDir=asc&columns=learner_name%2Cbatch%2Cregistered_count%2Cattendance_rate%2Cabsent_count%2Cavg_coverage%2Clast_attended%2Cstreak&page=1&limit=25`,
      `${BASE}/series?groupBy=course&scheduledFrom=2026-07-19T00%3A00%3A00.000Z&scheduledTo=2026-10-17T23%3A59%3A59.999Z&sortBy=avg_turnout&sortDir=asc&page=1&limit=25`,
    ]);
  });

  it("starts the date-ranged pages on the range it counted", async () => {
    await expect(live.loadLiveLearnersData()).resolves.toMatchObject({
      range: { from: "2026-09-17", to: "2026-10-17" },
    });
    await expect(live.loadLiveSeriesData()).resolves.toMatchObject({
      range: { from: "2026-07-19", to: "2026-10-17" },
    });
  });

  it("keeps ids from the address inside their own path segments", async () => {
    await live.loadLiveAttendeeDetailData("learners", "a/b");
    await live.loadLiveMonitorData("s?x=1");
    await live.loadLiveLearnerDetailData("c/d");
    expect(state.paths).toEqual([
      `${BASE}/learners/attendees/a%2Fb`,
      `${BASE}/s%3Fx%3D1/live`,
      `${BASE}/learners/c%2Fd`,
    ]);
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.fail = true;
    await expect(live.loadLiveSessionDetailData("s-1")).resolves.toEqual({
      detail: null,
      attendees: null,
    });
    await expect(live.loadLiveMonitorData("s-2")).resolves.toBeNull();
    await expect(live.loadLiveLearnersData()).resolves.toBeNull();
    await expect(live.loadLiveSeriesData()).resolves.toBeNull();
  });
});
