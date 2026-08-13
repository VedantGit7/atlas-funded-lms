import { describe, expect, it } from "vitest";
import {
  buildInsightMarketingWorkflows,
  marketingWorkflowsToCsv,
  MARKETING_WORKFLOWS_EMPTY,
  MARKETING_WORKFLOWS_FAILURE_MIN_RUNS,
  MARKETING_WORKFLOWS_FAILURE_SHARE_WARN,
  MARKETING_WORKFLOWS_VOLUME_ALL_HEALTHY,
} from "../../../backend/apps/api/src/server/insights/insights-marketing-workflows";
import { insightMarketingWorkflowsResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

const dailyVolume = Array.from({ length: 30 }, (_, index) => {
  const day = String(index + 1).padStart(2, "0");
  const completed = index === 14 ? 18 : index === 10 ? 5 : 4;
  const failed = index === 14 ? 4 : index === 10 ? 2 : 0;
  return {
    period: `2026-07-${day}`,
    completed,
    failed,
    total: completed + failed,
  };
});

const snapshot = {
  workflowCount: 8,
  publishedWorkflowCount: 6,
  runs30d: 218,
  runsCompleted30d: 209,
  runsFailed30d: 9,
  lastRunAt: "2026-08-12T11:46:00.000Z",
  dailyVolume,
  byWorkflow: [
    {
      id: "w1",
      title: "Welcome sequence",
      status: "PUBLISHED",
      runs30d: 120,
      completed30d: 100,
      failed30d: 24,
      lastRunAt: "2026-08-12T11:46:00.000Z",
      publishedAt: "2026-06-01T10:00:00.000Z",
      href: "/admin/marketing/workflows/w1",
    },
    {
      id: "w2",
      title: "Form follow-up",
      status: "PUBLISHED",
      runs30d: 98,
      completed30d: 97,
      failed30d: 1,
      lastRunAt: "2026-08-11T08:00:00.000Z",
      publishedAt: "2026-06-15T10:00:00.000Z",
      href: "/admin/marketing/workflows/w2",
    },
  ],
  neverRun: [
    {
      id: "w3",
      title: "Dormant nurture",
      publishedAt: "2026-07-01T10:00:00.000Z",
      href: "/admin/marketing/workflows/w3",
    },
  ],
  triggers: [
    { trigger: "form_submitted", runs: 140 },
    { trigger: "learner_signup", runs: 78 },
  ],
  ledger: [
    {
      id: "r1",
      workflowId: "w1",
      workflowTitle: "Welcome sequence",
      status: "FAILED",
      triggerEventType: "form_submitted",
      createdAt: "2026-08-12T11:46:00.000Z",
      errorMessage: "SMTP timeout while sending step 2",
      href: "/admin/marketing/workflows/w1?runId=r1",
      workflowHref: "/admin/marketing/workflows/w1",
    },
  ],
};

describe("buildInsightMarketingWorkflows", () => {
  it("computes success rate from completed and failed runs", () => {
    const board = buildInsightMarketingWorkflows(snapshot, "2026-08-12T12:00:00.000Z");

    expect(board.slug).toBe("marketing-insight");
    expect(board.successRatePct).toBeCloseTo(95.9, 1);
    expect(board.runs30d).toBe(218);
    expect(board.runsFailed30d).toBe(9);
    expect(board.byWorkflow[0]?.successRatePct).toBeCloseTo(80.6, 1);
  });

  it("renders empty state when no published workflows exist", () => {
    const board = buildInsightMarketingWorkflows(
      {
        ...snapshot,
        workflowCount: 2,
        publishedWorkflowCount: 0,
        runs30d: 0,
        runsCompleted30d: 0,
        runsFailed30d: 0,
        lastRunAt: null,
        byWorkflow: [],
        neverRun: [],
        triggers: [],
        ledger: [],
        dailyVolume: dailyVolume.map((day) => ({ ...day, completed: 0, failed: 0, total: 0 })),
      },
      "2026-08-12T12:00:00.000Z",
    );

    expect(board.empty).toBe(true);
    expect(board.emptyCaption).toBe(MARKETING_WORKFLOWS_EMPTY);
    expect(JSON.stringify(board)).not.toContain("—");
  });

  it("marks allHealthy when there are runs but no failures", () => {
    const board = buildInsightMarketingWorkflows(
      {
        ...snapshot,
        runsFailed30d: 0,
        runsCompleted30d: 50,
        runs30d: 50,
        byWorkflow: snapshot.byWorkflow.map((row) => ({ ...row, failed30d: 0 })),
      },
      "2026-08-12T12:00:00.000Z",
    );

    expect(board.allHealthy).toBe(true);
    expect(board.volumeAllHealthyCaption).toBe(MARKETING_WORKFLOWS_VOLUME_ALL_HEALTHY);
    expect(board.volumeCaption).toBe(MARKETING_WORKFLOWS_VOLUME_ALL_HEALTHY);
  });

  it("flags failure rail when failure share crosses the threshold", () => {
    const board = buildInsightMarketingWorkflows(snapshot);

    expect(board.failureShareWarnThreshold).toBe(MARKETING_WORKFLOWS_FAILURE_SHARE_WARN);
    expect(board.failureMinRuns).toBe(MARKETING_WORKFLOWS_FAILURE_MIN_RUNS);
    expect(board.byWorkflow[0]?.warningRail).toBe(true);
    expect(board.byWorkflow[1]?.warningRail).toBe(false);
  });

  it("builds volume caption with busiest day and unusual failure share", () => {
    const board = buildInsightMarketingWorkflows(snapshot);

    expect(board.volumeCaption).toContain("Busiest day:");
    expect(board.volumeCaption).toContain("Unusual failure share");
    expect(board.volumeCaption).not.toContain("—");
  });

  it("parses through the response schema without em dashes", () => {
    const board = buildInsightMarketingWorkflows(snapshot);
    const parsed = insightMarketingWorkflowsResponseSchema.parse({ data: board });
    expect(parsed.data.ledger).toHaveLength(1);
    expect(JSON.stringify(parsed)).not.toContain("—");
  });

  it("exports CSV without an em dash", () => {
    const board = buildInsightMarketingWorkflows(snapshot);
    const csv = marketingWorkflowsToCsv(board);
    expect(csv).toContain("Welcome sequence");
    expect(csv).toContain("form_submitted");
    expect(csv).not.toContain("—");
  });
});
