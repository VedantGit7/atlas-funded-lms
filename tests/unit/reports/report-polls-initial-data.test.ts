import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  paths: [] as string[],
  fail: false,
  hidden: false,
}));
vi.mock("../../../frontend/apps/web/src/lib/server-api", () => ({
  serverApi: {
    get: (path: string) => {
      state.paths.push(path);
      if (state.fail) return Promise.reject(new Error("The report is unavailable."));
      // Poll and option reports say whether the poll shows who answered.
      return Promise.resolve({
        data: { path, respondentsHidden: state.hidden, anonymousVote: false },
      });
    },
  },
}));

const polls = await import("../../../frontend/apps/web/src/lib/server/report-polls-initial-data");

/*
 * Each Polls page skips its first browser load when the server sent data, so
 * the server must ask for exactly what that load would have. These are the
 * requests the pages made in the browser before they were server-rendered.
 */
const RESPONDENTS =
  "/api/v1/reports/polls/poll-1/respondents?sortBy=responded_at&sortDir=desc&columns=learner_name%2Cemail%2Coption_label%2Cis_correct%2Cresponded_at&page=1&limit=25";

beforeEach(() => {
  state.paths = [];
  state.fail = false;
  state.hidden = false;
});

describe("Polls report initial data", () => {
  it("asks for what each page's first browser load would", async () => {
    await polls.loadPollsLiveSessionsData();
    await polls.loadLiveSessionPollReportData("ls-1");
    await polls.loadPollDetailData("poll-1");
    await polls.loadPollOptionDetailData("poll-1", "opt-a");
    await polls.loadPollNonRespondentsData("poll-1");
    await polls.loadPollLiveMonitorData("poll-1");
    await polls.loadPollsCompareData({ pollIds: "poll-1, poll-2,poll-1", alignBy: "order" });
    expect(state.paths).toEqual([
      "/api/v1/reports/polls/live-sessions?page=1&limit=25",
      "/api/v1/reports/polls/live-sessions/ls-1",
      "/api/v1/reports/polls/poll-1",
      RESPONDENTS,
      "/api/v1/reports/polls/poll-1/options/opt-a",
      "/api/v1/reports/polls/poll-1/respondents?optionId=opt-a&sortBy=responded_at&sortDir=desc&page=1&limit=25",
      "/api/v1/reports/polls/poll-1/non-respondents?presence=any&sortBy=learner_name&sortDir=asc&page=1&limit=25",
      "/api/v1/reports/polls/poll-1/live",
      "/api/v1/reports/polls/compare?pollIds=poll-1%2Cpoll-2&alignBy=order",
    ]);
  });

  it("loads no respondents for a poll that hides who answered", async () => {
    state.hidden = true;
    const detail = await polls.loadPollDetailData("poll-1");
    const option = await polls.loadPollOptionDetailData("poll-1", "opt-a");
    expect(detail.respondents).toBeNull();
    expect(option.respondents).toBeNull();
    expect(state.paths).toEqual([
      "/api/v1/reports/polls/poll-1",
      "/api/v1/reports/polls/poll-1/options/opt-a",
    ]);
  });

  it("compares nothing for fewer than two polls, and aligns by label unless told otherwise", async () => {
    await expect(polls.loadPollsCompareData({ pollIds: "poll-1,poll-1" })).resolves.toBeNull();
    await expect(polls.loadPollsCompareData({})).resolves.toBeNull();
    await polls.loadPollsCompareData({ pollIds: ["a,b", "c,d"], alignBy: "sideways" });
    expect(state.paths).toEqual(["/api/v1/reports/polls/compare?pollIds=a%2Cb&alignBy=label"]);
  });

  it("keeps an id from the address inside its own path segment", async () => {
    await polls.loadPollDetailData("../exports?x=1");
    expect(state.paths[0]).toBe("/api/v1/reports/polls/..%2Fexports%3Fx%3D1");
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.fail = true;
    await expect(polls.loadPollDetailData("poll-1")).resolves.toEqual({
      detail: null,
      respondents: null,
    });
    await expect(polls.loadPollLiveMonitorData("poll-1")).resolves.toBeNull();
    expect(state.paths).toEqual([
      "/api/v1/reports/polls/poll-1",
      "/api/v1/reports/polls/poll-1/live",
    ]);
  });
});
