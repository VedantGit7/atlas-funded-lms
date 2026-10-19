import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  paths: [] as string[],
  fail: false,
  courseId: "c-1" as string | null,
}));
vi.mock("../../../frontend/apps/web/src/lib/server-api", () => ({
  serverApi: {
    get: (path: string) => {
      state.paths.push(path);
      if (state.fail) return Promise.reject(new Error("The report is unavailable."));
      return Promise.resolve({ data: { path, courseId: state.courseId } });
    },
  },
}));

const batches =
  await import("../../../frontend/apps/web/src/lib/server/report-batches-initial-data");

beforeEach(() => {
  state.paths = [];
  state.fail = false;
  state.courseId = "c-1";
});

const B = "/api/v1/reports/batches/b-1";

/*
 * Each Batches page skips its first browser load when the server sent data,
 * so the server must ask for exactly what that load would have, for the same
 * address. These are the requests the pages made in the browser before they
 * were server-rendered.
 */
describe("Batches initial data", () => {
  it("asks for what each page's first browser load would", async () => {
    await batches.loadBatchDetailData("b-1", {});
    await batches.loadBatchContentData("b-1", {});
    await batches.loadBatchExamsData("b-1", {});
    await batches.loadBatchLearnerData("b-1", "mem-1");
    await batches.loadBatchLiveSessionsData("b-1", {});
    await batches.loadBatchSessionAttendanceData("b-1", "s-1", {});
    await batches.loadBatchMessagesData("b-1");
    await batches.loadBatchesCompareData({ ids: "b-1,b-2" });
    expect(state.paths).toEqual([
      B,
      `${B}/content`,
      `${B}/content/learners?view=any&sortBy=days_since&sortDir=desc&page=1&limit=25`,
      `${B}/exams?sortBy=released_at&sortDir=asc`,
      `${B}/learners/mem-1`,
      `${B}/live-sessions?status=any&sortBy=scheduled_at&sortDir=desc&page=1&limit=25`,
      `${B}/live-sessions/s-1`,
      `${B}/live-sessions/s-1/attendees?attendanceKind=any&sortBy=status&sortDir=asc&page=1&limit=25`,
      `${B}/messages?page=1&limit=20`,
      `${B}/messages/audiences`,
      `${B}/messages/nudges`,
      "/api/v1/reports/batches/compare?batchIds=b-1%2Cb-2&normalize=week_of_batch",
    ]);
  });

  it("reads each page's address the way the page does", async () => {
    await batches.loadBatchDetailData("b-1", { tab: "learners" });
    await batches.loadBatchContentData("b-1", { q: " asha ", view: "stalled", page: "2" });
    await batches.loadBatchExamsData("b-1", { view: "matrix", q: "vik" });
    await batches.loadBatchLiveSessionsData("b-1", { view: "matrix", q: "x" });
    await batches.loadBatchLiveSessionsData("b-1", {
      sortBy: "attendance_rate",
      sortDir: "asc",
      page: "3",
      q: "drill",
    });
    await batches.loadBatchSessionAttendanceData("b-1", "s-1", {
      kind: "absent",
      sortBy: "watch_pct",
      sortDir: "desc",
      page: ["2", "9"],
    });
    expect(state.paths).toEqual([
      B,
      `${B}/learners?sortBy=joined_at&sortDir=desc&columns=learner_name%2Cemail%2Cactivity_at%2Clive_attendance_pct%2Ctest_score_pct%2Ccontent_completion_pct%2Cjoined_at&page=1&limit=25`,
      `${B}/content`,
      `${B}/content/learners?q=asha&view=stalled&sortBy=days_since&sortDir=desc&page=2&limit=25`,
      `${B}/exams/matrix?q=vik&limitLearners=100`,
      `${B}/exams?sortBy=released_at&sortDir=asc`,
      `${B}/live-sessions/matrix?q=x&limitLearners=100&limitSessions=40`,
      `${B}/live-sessions?status=any&sortBy=scheduled_at&sortDir=desc&page=1&limit=1`,
      `${B}/live-sessions?q=drill&status=any&sortBy=attendance_rate&sortDir=asc&page=3&limit=25`,
      `${B}/live-sessions/s-1`,
      `${B}/live-sessions/s-1/attendees?attendanceKind=absent&sortBy=watch_pct&sortDir=desc&page=2&limit=25`,
    ]);
  });

  it("ignores address values the pages do not know", async () => {
    await batches.loadBatchContentData("b-1", { view: "bogus", page: "-4" });
    await batches.loadBatchSessionAttendanceData("b-1", "s-1", { kind: "x", sortBy: "y" });
    expect(state.paths).toEqual([
      `${B}/content`,
      `${B}/content/learners?view=any&sortBy=days_since&sortDir=desc&page=1&limit=25`,
      `${B}/live-sessions/s-1`,
      `${B}/live-sessions/s-1/attendees?attendanceKind=any&sortBy=status&sortDir=asc&page=1&limit=25`,
    ]);
  });

  it("asks for no content learners when the batch has no course", async () => {
    state.courseId = null;
    await expect(batches.loadBatchContentData("b-1", {})).resolves.toMatchObject({
      learners: null,
    });
    expect(state.paths).toEqual([`${B}/content`]);
  });

  it("compares only two or more distinct batches", async () => {
    await expect(batches.loadBatchesCompareData({ ids: "b-1,b-1" })).resolves.toBeNull();
    await expect(batches.loadBatchesCompareData({})).resolves.toBeNull();
    await batches.loadBatchesCompareData({ ids: "a, b,a,c,d,e" });
    expect(state.paths).toEqual([
      "/api/v1/reports/batches/compare?batchIds=a%2Cb%2Cc%2Cd&normalize=week_of_batch",
    ]);
  });

  it("keeps ids from the address inside their own path segments", async () => {
    await batches.loadBatchLearnerData("compare", "a/b");
    await batches.loadBatchSessionAttendanceData("b?x", "s/1", {});
    expect(state.paths).toEqual([
      "/api/v1/reports/batches/compare/learners/a%2Fb",
      "/api/v1/reports/batches/b%3Fx/live-sessions/s%2F1",
      "/api/v1/reports/batches/b%3Fx/live-sessions/s%2F1/attendees?attendanceKind=any&sortBy=status&sortDir=asc&page=1&limit=25",
    ]);
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.fail = true;
    await expect(batches.loadBatchDetailData("b-1", {})).resolves.toEqual({
      detail: null,
      learners: null,
    });
    await expect(batches.loadBatchExamsData("b-1", { view: "matrix" })).resolves.toBeNull();
    await expect(batches.loadBatchSessionAttendanceData("b-1", "s-1", {})).resolves.toBeNull();
    await expect(batches.loadBatchMessagesData("b-1")).resolves.toBeNull();
  });
});
