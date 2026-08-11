import { describe, expect, it } from "vitest";
import { buildInsightContentHealth } from "../../../backend/apps/api/src/server/insights/insights-content-health";
import { SCHOOL_VITALS_HEALTH_CAVEAT } from "../../../backend/apps/api/src/server/insights/insights-school-vitals";
import { insightContentHealthResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";
import type {
  ContentHealthDetail,
  LearningRollupBundle,
  SchoolVitalsRollupKey,
  SchoolVitalsSnapshot,
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

function snapshot(overrides: Partial<SchoolVitalsSnapshot> = {}): SchoolVitalsSnapshot {
  return {
    learnerCount: 10,
    enrollmentCount: 8,
    currentMau: 4,
    activeUsers30d: 5,
    inactiveLearnerCount: 0,
    dormantCourseCount: 0,
    openModerationCases: 0,
    upcomingLiveCount: 0,
    dailyActiveUsers: [],
    topCourses: [],
    ...overrides,
  };
}

function detail(overrides: Partial<ContentHealthDetail> = {}): ContentHealthDetail {
  return {
    dormantLessonCount: 0,
    neverActiveLearnerCount: 0,
    inactivePaidCount: 0,
    inactiveEnrollmentCount: 0,
    moderationOldestOpenDays: null,
    moderationOver72hCount: 0,
    moderationReviewingCount: 0,
    liveNowCount: 0,
    upcomingRegisteredCount: 0,
    upcomingSessions: [],
    ...overrides,
  };
}

function rollups(overrides: Partial<LearningRollupBundle> = {}): LearningRollupBundle {
  return {
    from: "2026-07-13",
    to: "2026-08-11",
    totals: emptyTotals(),
    seriesByKey: emptySeries(),
    activitySeries: [],
    ...overrides,
  };
}

describe("buildInsightContentHealth", () => {
  it("keeps four independent signals and does not invent a combined score", () => {
    const board = buildInsightContentHealth(
      snapshot({
        dormantCourseCount: 18,
        inactiveLearnerCount: 412,
        openModerationCases: 9,
        upcomingLiveCount: 3,
      }),
      detail({
        dormantLessonCount: 218,
        neverActiveLearnerCount: 84,
        inactivePaidCount: 96,
        inactiveEnrollmentCount: 1204,
        moderationOldestOpenDays: 6,
        moderationOver72hCount: 3,
        moderationReviewingCount: 2,
        liveNowCount: 1,
        upcomingRegisteredCount: 186,
      }),
      rollups(),
      "30d",
      "2026-08-11T12:00:00.000Z",
    );

    expect(board.signals).toHaveLength(4);
    expect(board.allClear).toBe(false);
    expect(board.caveat).toBe(SCHOOL_VITALS_HEALTH_CAVEAT);
    expect(board.caveat).not.toContain("—");
    expect(board.windowNote).toContain("30-day lookback");
    expect(board.signals[0]?.tone).toBe("warning");
    expect(board.signals[0]?.chips.some((chip) => chip.label.includes("218"))).toBe(true);
    expect(board.signals[1]?.chips.some((chip) => chip.label.includes("never active"))).toBe(true);
    expect(board.signals[2]?.consequence).toContain("6 days");
    expect(board.signals[2]?.chips.some((chip) => chip.tone === "danger")).toBe(true);
    expect(board.signals[3]?.informational).toBe(true);
    expect(board.signals[3]?.tone).toBe("neutral");
    expect(insightContentHealthResponseSchema.parse({ data: board }).data.signals).toHaveLength(4);
  });

  it("marks all-clear when inverted signals are zero, even if live sessions exist", () => {
    const board = buildInsightContentHealth(
      snapshot({ upcomingLiveCount: 2 }),
      detail({
        upcomingSessions: [
          {
            id: "sess-1",
            title: "Office hours",
            status: "scheduled",
            scheduledAt: "2026-08-12T14:00:00.000Z",
            registeredCount: 12,
          },
        ],
      }),
      rollups(),
      "30d",
    );

    expect(board.allClear).toBe(true);
    expect(
      board.signals.filter((signal) => signal.inverted).every((signal) => signal.count === 0),
    ).toBe(true);
    expect(board.signals.find((signal) => signal.id === "dormant-courses")?.tone).toBe("success");
    expect(
      board.signals.find((signal) => signal.id === "inactive-learners")?.secondaryHref,
    ).toBeNull();
    expect(board.sessions).toHaveLength(1);
    expect(board.sessions[0]?.href).toContain("/admin/reports/live-class-attendance/sess-1");
    expect(board.sessions[0]?.title).toBe("Office hours");
  });

  it("omits invented chips when extras are zero and keeps cases-opened series honest", () => {
    const board = buildInsightContentHealth(
      snapshot({ openModerationCases: 2 }),
      detail({ moderationOldestOpenDays: 1 }),
      rollups({
        seriesByKey: {
          ...emptySeries(),
          moderation_cases_opened: [
            { period: "2026-08-01", value: 1 },
            { period: "2026-08-02", value: 0 },
            { period: "2026-08-03", value: 3 },
          ],
        },
      }),
      "ytd",
    );

    expect(board.signals[0]?.chips).toEqual([]);
    expect(board.signals[2]?.chips).toEqual([]);
    expect(board.openedSparkline).toEqual([1, 0, 3]);
    expect(board.rangeLabel).toBe("Year to date");
    expect(JSON.stringify(board)).not.toContain("—");
    expect(JSON.stringify(board)).not.toContain("LS-");
    expect(JSON.stringify(board)).not.toContain("Overall Risk");
  });
});
