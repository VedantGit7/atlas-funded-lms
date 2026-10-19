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

const progress =
  await import("../../../frontend/apps/web/src/lib/server/report-progress-score-initial-data");

beforeEach(() => {
  state.paths = [];
  state.fail = false;
});

const P = "/api/v1/reports/progress-score";

/*
 * Each Progress & Score page skips its first browser load when the server sent
 * data, so the server must ask for exactly what that load would have. These
 * are the requests the pages made in the browser before they were
 * server-rendered.
 */
describe("Progress & Score initial data", () => {
  it("asks for what each page's first browser load would", async () => {
    await progress.loadCohortsData();
    await progress.loadProgressProductsData();
    await progress.loadScoreProductsData();
    await progress.loadProgressLearnersData("course", "c-1");
    await progress.loadProgressLearnerDetailData("course", "c-1", "e-1");
    await progress.loadScoreQuizzesData("course", "c-1");
    await progress.loadScoreLearnersData("a-1");
    await progress.loadScoreAttemptReviewData("a-1", "at-1");
    expect(state.paths).toEqual([
      `${P}/cohorts/groups?page=1&limit=10`,
      `${P}/cohorts/messages?page=1&limit=10`,
      `${P}/progress/course?page=1&limit=25&sortBy=enrolled_count&sortDir=desc`,
      `${P}/scores/course?page=1&limit=25&sortBy=attempts&sortDir=desc`,
      `${P}/progress/course/c-1/learners?view=all&sortBy=last_activity_at&sortDir=desc&columns=learner_name%2Cemail%2Ccompletion_pct%2Ccompleted_lessons%2Ctotal_lessons%2Cenrolled_type%2Cstatus%2Cenrolled_at%2Cexpires_at&page=1&limit=25`,
      `${P}/progress/course/c-1/learners/e-1`,
      `${P}/scores/course/c-1/quizzes?sortBy=title&sortDir=asc&page=1&limit=25`,
      `${P}/scores/quizzes/a-1/learners?view=all&sortBy=submitted_at&sortDir=desc&columns=learner_name%2Cemail%2Cresult_status%2Cattempt_count%2Cscore_pct%2Canswered_count%2Csubmitted_at&page=1&limit=25`,
      `${P}/scores/quizzes/a-1/attempts/at-1`,
    ]);
  });

  it("keeps ids inside their own path segments", async () => {
    await progress.loadProgressLearnerDetailData("bundle", "a/b", "c?d");
    await progress.loadScoreAttemptReviewData("x/y", "z");
    expect(state.paths).toEqual([
      `${P}/progress/bundle/a%2Fb/learners/c%3Fd`,
      `${P}/scores/quizzes/x%2Fy/attempts/z`,
    ]);
  });

  it("gives cohorts both lists or neither", async () => {
    await expect(progress.loadCohortsData()).resolves.toMatchObject({
      data: { groups: { path: `${P}/cohorts/groups?page=1&limit=10` } },
    });
    state.fail = true;
    await expect(progress.loadCohortsData()).resolves.toBeNull();
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.fail = true;
    await expect(progress.loadProgressProductsData()).resolves.toBeNull();
    await expect(progress.loadScoreLearnersData("a-1")).resolves.toBeNull();
    await expect(progress.loadScoreAttemptReviewData("a-1", "at-1")).resolves.toBeNull();
  });
});
