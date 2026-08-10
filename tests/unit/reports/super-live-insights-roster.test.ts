import { describe, expect, it } from "vitest";
import {
  SUPER_LIVE_INSIGHT_COLUMNS,
  exportSuperLiveInsightsRosterBodySchema,
  superLiveInsightDetailResponseSchema,
  superLiveInsightsListQuerySchema,
} from "@atlas/domain/reports/super-live-insights-roster.dto";

describe("super live insights roster dto", () => {
  it("parses list query defaults", () => {
    const parsed = superLiveInsightsListQuerySchema.parse({
      page: "2",
      status: "ended",
      minAttended: "3",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.sortBy).toBe("scheduled_at");
    expect(parsed.status).toBe("ended");
    expect(parsed.minAttended).toBe(3);
  });

  it("parses columns and falls back when invalid", () => {
    const selected = superLiveInsightsListQuerySchema.parse({
      columns: "title,attended_count,attendance_rate",
    });
    expect(selected.columns).toEqual(["title", "attended_count", "attendance_rate"]);

    const fallback = superLiveInsightsListQuerySchema.parse({ columns: "nope" });
    expect(fallback.columns).toEqual([...SUPER_LIVE_INSIGHT_COLUMNS]);
  });

  it("parses hasUnresolved boolean query flags", () => {
    expect(superLiveInsightsListQuerySchema.parse({ hasUnresolved: "true" }).hasUnresolved).toBe(
      true,
    );
    expect(superLiveInsightsListQuerySchema.parse({ hasUnresolved: "0" }).hasUnresolved).toBe(
      false,
    );
  });

  it("accepts session detail response with context", () => {
    const parsed = superLiveInsightDetailResponseSchema.parse({
      data: {
        session: {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Week 6 live",
          status: "ended",
          courseId: null,
          courseTitle: null,
          batchId: null,
          batchName: null,
          scheduledAt: "2026-08-01T10:00:00.000Z",
          startedAt: "2026-08-01T10:02:00.000Z",
          endedAt: "2026-08-01T11:06:00.000Z",
          durationSeconds: 3840,
          attendedCount: 24,
          registeredCount: 11,
          absentCount: 3,
          totalCount: 38,
          avgDurationSeconds: 2892,
          attendanceRate: 63.2,
        },
        context: {
          courseAvgAttendanceRate: 74.6,
          tenantAvgAttendanceRate: 68.1,
          courseRateP25: 55,
          courseRateP75: 82,
          courseAvgDurationSeconds: 3000,
          durationCoveragePct: 75.3,
          rateDeltaVsCourse: -11.4,
          courseRankCaption: "Bottom third of sessions in this course.",
          estimatedTurnout: null,
          cancelledAt: null,
          series: [],
          trend: [],
          trendDeltaPoints: -19,
        },
      },
    });
    expect(parsed.data.session.attendanceRate).toBe(63.2);
    expect(parsed.data.context.rateDeltaVsCourse).toBe(-11.4);
  });

  it("accepts export body and rejects tenant fields", () => {
    const exported = exportSuperLiveInsightsRosterBodySchema.parse({
      sessionId: "11111111-1111-4111-8111-111111111111",
      q: "math",
    });
    expect(exported.emailDownloadLink).toBe(true);
    expect(exported.q).toBe("math");

    expect(() =>
      exportSuperLiveInsightsRosterBodySchema.parse({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });
});
