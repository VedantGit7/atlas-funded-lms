import { describe, expect, it } from "vitest";
import {
  buildInsightEngagementFunnel,
  engagementFunnelToCsv,
  ENGAGEMENT_FUNNEL_STAGES,
} from "../../../backend/apps/api/src/server/insights/insights-engagement-funnel";
import { SCHOOL_VITALS_FUNNEL_CAVEAT } from "../../../backend/apps/api/src/server/insights/insights-school-vitals";
import { insightEngagementFunnelResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";
import type {
  LearningRollupBundle,
  SchoolVitalsRollupKey,
} from "../../../backend/apps/api/src/server/insights/insights.repository";

function emptyTotals(): Record<SchoolVitalsRollupKey, number> {
  return {
    lessons_completed: 0,
    assessments_submitted: 0,
    assessments_passed: 0,
    practice_sessions_completed: 0,
    certificates_issued: 0,
    community_posts_created: 0,
    moderation_cases_opened: 0,
    path_steps_completed: 0,
  };
}

function emptySeries(): LearningRollupBundle["seriesByKey"] {
  return {
    lessons_completed: [],
    assessments_submitted: [],
    assessments_passed: [],
    practice_sessions_completed: [],
    certificates_issued: [],
    community_posts_created: [],
    moderation_cases_opened: [],
    path_steps_completed: [],
  };
}

function points(values: number[]): Array<{ period: string; value: number }> {
  return values.map((value, index) => ({
    period: `2026-08-${String(index + 1).padStart(2, "0")}`,
    value,
  }));
}

function bundle(overrides: Partial<LearningRollupBundle> = {}): LearningRollupBundle {
  return {
    from: "2026-07-13",
    to: "2026-08-11",
    totals: emptyTotals(),
    seriesByKey: emptySeries(),
    activitySeries: [],
    ...overrides,
  };
}

describe("buildInsightEngagementFunnel", () => {
  it("treats stages as independent event counts and uses share of max, not conversion", () => {
    const board = buildInsightEngagementFunnel(
      bundle({
        totals: {
          ...emptyTotals(),
          lessons_completed: 12840,
          assessments_submitted: 3412,
          assessments_passed: 2088,
          practice_sessions_completed: 1204,
          community_posts_created: 486,
          certificates_issued: 218,
        },
      }),
      "30d",
      "2026-08-11T12:00:00.000Z",
    );

    expect(board.stages).toHaveLength(6);
    expect(board.stages.map((stage) => stage.key)).toEqual(
      ENGAGEMENT_FUNNEL_STAGES.map((stage) => stage.key),
    );
    expect(board.stages[0]?.maxSharePct).toBe(100);
    expect(board.stages[1]?.maxSharePct).toBe(26.6);
    expect(board.stages[1]?.sharePct).toBe(16.9);
    expect(board.totalEvents).toBe(20248);
    expect(board.empty).toBe(false);
    expect(board.caveat).toBe(SCHOOL_VITALS_FUNNEL_CAVEAT);
    expect(board.caveat).not.toContain("—");
    expect(board.title).toBe("Learning engagement funnel");
    expect(insightEngagementFunnelResponseSchema.parse({ data: board }).data.stages).toHaveLength(
      6,
    );
  });

  it("computes pass rate and certificates per pass only when denominators exist", () => {
    const withDenominators = buildInsightEngagementFunnel(
      bundle({
        totals: {
          ...emptyTotals(),
          assessments_submitted: 3412,
          assessments_passed: 2088,
          certificates_issued: 218,
        },
      }),
      "30d",
    );
    expect(withDenominators.ratios).toEqual([
      {
        id: "pass-rate",
        label: "Pass rate",
        detail: "Assessments passed / assessments submitted",
        valuePct: 61.2,
      },
      {
        id: "certificates-per-pass",
        label: "Certificates per pass",
        detail: "Certificates issued / assessments passed",
        valuePct: 10.4,
      },
    ]);

    const emptyRatios = buildInsightEngagementFunnel(bundle(), "30d");
    expect(emptyRatios.ratios).toEqual([]);
    expect(emptyRatios.empty).toBe(true);
  });

  it("uses equal-length half windows for comparison, not a fake cohort", () => {
    const board = buildInsightEngagementFunnel(
      bundle({
        totals: {
          ...emptyTotals(),
          lessons_completed: 100,
          practice_sessions_completed: 40,
        },
        seriesByKey: {
          ...emptySeries(),
          lessons_completed: points([10, 10, 20, 60]),
          practice_sessions_completed: points([5, 5, 14, 16]),
        },
      }),
      "30d",
    );

    const lessons = board.stages.find((stage) => stage.key === "lessons_completed");
    const practice = board.stages.find((stage) => stage.key === "practice_sessions_completed");
    expect(lessons?.previousCount).toBe(20);
    expect(lessons?.currentHalf).toBe(80);
    expect(lessons?.deltaPct).toBe(300);
    expect(practice?.deltaPct).toBe(200);
    expect(board.comparable).toBe(true);
    expect(board.topMover).toEqual({ label: "Lessons completed", deltaPct: 300 });
    expect(board.currentLabel).toBe("Latest 15 days");
    expect(board.previousLabel).toBe("Prior 15 days");
  });

  it("does not claim comparability when the series is too short", () => {
    const board = buildInsightEngagementFunnel(
      bundle({
        totals: { ...emptyTotals(), lessons_completed: 4 },
        seriesByKey: {
          ...emptySeries(),
          lessons_completed: points([1, 3]),
        },
      }),
      "12m",
    );
    expect(board.comparable).toBe(false);
    expect(board.topMover).toBeNull();
    expect(board.rangeLabel).toBe("Last 12 months");
    expect(board.stages[0]?.previousCount).toBeNull();
  });

  it("exports csv without an em dash and includes community posts", () => {
    const board = buildInsightEngagementFunnel(
      bundle({
        totals: {
          ...emptyTotals(),
          lessons_completed: 10,
          community_posts_created: 2,
        },
      }),
      "ytd",
    );
    const csv = engagementFunnelToCsv(board);
    expect(csv).toContain("Community posts");
    expect(csv).toContain("Stage,Events,Share %,Change %,Current half,Previous half");
    expect(csv).not.toContain("—");
    expect(csv).not.toContain("–");
    expect(board.rangeLabel).toBe("Year to date");
  });
});
