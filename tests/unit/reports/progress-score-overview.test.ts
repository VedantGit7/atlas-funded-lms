import { describe, expect, it } from "vitest";
import {
  progressScoreOverviewQuerySchema,
  progressScoreOverviewResponseSchema,
} from "@atlas/domain/reports/progress-score-overview.dto";

describe("progress score overview dto", () => {
  it("defaults window to 30d", () => {
    const query = progressScoreOverviewQuerySchema.parse({});
    expect(query.window).toBe("30d");
  });

  it("parses overview response with signal band + distribution", () => {
    const response = progressScoreOverviewResponseSchema.parse({
      data: {
        windowLabel: "Last 30 days",
        windowFrom: "2026-07-06T00:00:00.000Z",
        windowTo: "2026-08-05T00:00:00.000Z",
        previousWindowFrom: "2026-06-05T00:00:00.000Z",
        previousWindowTo: "2026-07-05T23:59:59.000Z",
        empty: false,
        summary: {
          averageCompletionPct: 61.4,
          averageCompletionDeltaPoints: 4.2,
          activeEnrolmentCount: 3412,
          learnersAtRiskCount: 218,
          atRiskIdleDays: 14,
          assessmentPassRatePct: 74.8,
          assessmentAttemptCount: 1906,
          awaitingGradingCount: 42,
        },
        completionDistribution: [
          { key: "not_started", label: "Not started", count: 400, sharePct: 11.7 },
          { key: "early", label: "Early", count: 500, sharePct: 14.7 },
          { key: "in_progress", label: "In progress", count: 1200, sharePct: 35.2 },
          { key: "nearly_done", label: "Nearly done", count: 800, sharePct: 23.4 },
          { key: "complete", label: "Complete", count: 512, sharePct: 15.0 },
        ],
      },
    });
    expect(response.data.summary.learnersAtRiskCount).toBe(218);
    expect(response.data.completionDistribution).toHaveLength(5);
  });
});
