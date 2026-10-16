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

const landing =
  await import("../../../frontend/apps/web/src/lib/server/report-landing-initial-data");

const NOW = new Date("2026-10-16T07:30:00.000Z");

/*
 * Each landing page skips its first browser load when the server sent data,
 * so the server must ask for exactly what that load would have. These are the
 * requests the pages made in the browser before they were server-rendered.
 */
const BROWSER_FIRST_LOADS = {
  progressScore: ["/api/v1/reports/progress-score/overview?window=30d"],
  polls: ["/api/v1/reports/polls?view=all&page=1&limit=25"],
  batches: [
    "/api/v1/reports/batches?status=ACTIVE&window=any&health=any&sortBy=member_count&sortDir=desc&page=1&limit=25",
  ],
  enrollments: [
    "/api/v1/reports/enrollments/roster?sortBy=enrolled_at&sortDir=desc&columns=learner_name%2Cemail%2Cproduct_title%2Cenrolled_type%2Cstatus%2Cenrolled_at%2Cexpires_at&page=1&limit=20",
    "/api/v1/reports/enrollments/overview",
  ],
  customField: [
    "/api/v1/reports/custom-field/roster?sortBy=signed_up_at&sortDir=desc&columns=learner_name%2Cemail%2Cenrollment_count%2Ctotal_spent_cents%2Clast_active_at%2Csigned_up_at%2Cstatus&page=1&limit=25",
    "/api/v1/reports/custom-field/definitions",
  ],
  zoomInsights: [
    "/api/v1/reports/zoom-insights?startedFrom=2026-09-16T00%3A00%3A00.000Z&startedTo=2026-10-16T23%3A59%3A59.999Z&view=all&sortBy=started_at&sortDir=desc&page=1&limit=50",
  ],
  liveClassAttendance: [
    "/api/v1/reports/live-class-attendance?startedFrom=2026-09-16T00%3A00%3A00.000Z&startedTo=2026-10-16T23%3A59%3A59.999Z&page=1&limit=50",
  ],
  resourceUsage: ["/api/v1/reports/resource-usage?period=this_month"],
  exports: [
    "/api/v1/reports/exports?createdFrom=2026-09-17T00%3A00%3A00.000Z&createdTo=2026-10-16T23%3A59%3A59.999Z&columns=status%2Ccreated_at%2Cdefinition_title%2Crow_count%2Cformat%2Crequested_by_name&page=1&limit=50",
  ],
} as const;

const LOADERS: Record<keyof typeof BROWSER_FIRST_LOADS, () => Promise<unknown>> = {
  progressScore: landing.loadProgressScoreLandingData,
  polls: landing.loadPollsLandingData,
  batches: landing.loadBatchesLandingData,
  enrollments: landing.loadEnrollmentsLandingData,
  customField: landing.loadCustomFieldLandingData,
  zoomInsights: landing.loadZoomInsightsLandingData,
  liveClassAttendance: landing.loadLiveClassAttendanceLandingData,
  resourceUsage: landing.loadResourceUsageLandingData,
  exports: landing.loadExportsLandingData,
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  state.paths = [];
  state.fail = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("report landing initial data", () => {
  for (const [report, expected] of Object.entries(BROWSER_FIRST_LOADS)) {
    it(`${report} asks for what the page's first browser load would`, async () => {
      await LOADERS[report as keyof typeof LOADERS]();
      expect(state.paths).toEqual(expected);
    });
  }

  it("stamps when it loaded, and the range a date-ranged page starts on", async () => {
    await expect(landing.loadPollsLandingData()).resolves.toEqual({
      data: { path: BROWSER_FIRST_LOADS.polls[0] },
      loadedAt: NOW.getTime(),
    });
    await expect(landing.loadZoomInsightsLandingData()).resolves.toMatchObject({
      range: { from: "2026-09-16", to: "2026-10-16" },
    });
    await expect(landing.loadLiveClassAttendanceLandingData()).resolves.toMatchObject({
      range: { from: "2026-09-16", to: "2026-10-16" },
    });
    await expect(landing.loadExportsLandingData()).resolves.toMatchObject({
      range: { from: "2026-09-17", to: "2026-10-16" },
    });
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.fail = true;
    await expect(landing.loadBatchesLandingData()).resolves.toBeNull();
    await expect(landing.loadExportsLandingData()).resolves.toBeNull();
    await expect(landing.loadEnrollmentsLandingData()).resolves.toEqual({
      roster: null,
      overview: null,
    });
  });
});
