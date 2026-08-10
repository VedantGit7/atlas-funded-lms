import { describe, expect, it } from "vitest";
import {
  superLiveInsightsTrendsQuerySchema,
  superLiveInsightsTrendsResponseSchema,
} from "@atlas/domain/reports/super-live-insights-trends.dto";

describe("super live insights trends dto", () => {
  it("parses trends query defaults", () => {
    const parsed = superLiveInsightsTrendsQuerySchema.parse({
      startedFrom: "2026-07-01T00:00:00.000Z",
      startedTo: "2026-07-31T23:59:59.999Z",
    });
    expect(parsed.granularity).toBe("week");
    expect(parsed.breakDownBy).toBe("none");
  });

  it("accepts day/week/month and breakdown options", () => {
    const parsed = superLiveInsightsTrendsQuerySchema.parse({
      startedFrom: "2026-07-01T00:00:00.000Z",
      startedTo: "2026-07-31T23:59:59.999Z",
      granularity: "day",
      breakDownBy: "course",
    });
    expect(parsed.granularity).toBe("day");
    expect(parsed.breakDownBy).toBe("course");
  });

  it("accepts a full trends response payload", () => {
    const parsed = superLiveInsightsTrendsResponseSchema.parse({
      data: {
        granularity: "week",
        breakDownBy: "none",
        range: {
          from: "2026-07-01T00:00:00.000Z",
          to: "2026-07-31T23:59:59.999Z",
        },
        summary: {
          attendanceRate: 63.2,
          attendanceRateDeltaPts: -6.4,
          sessionCount: 84,
          sessionCountDelta: 12,
          totalAttended: 1842,
          totalAttendedDelta: 241,
          avgDurationSeconds: 2658,
          avgDurationSecondsDelta: 130,
          bestPeriod: {
            label: "12–18 Jul",
            from: "2026-07-12T00:00:00.000Z",
            to: "2026-07-18T23:59:59.999Z",
            attendanceRate: 78.4,
          },
        },
        periods: [
          {
            key: "2026-07-06",
            label: "6–12 Jul",
            from: "2026-07-06T00:00:00.000Z",
            to: "2026-07-12T23:59:59.999Z",
            sessionCount: 12,
            attendedCount: 200,
            registeredCount: 40,
            absentCount: 20,
            totalCount: 260,
            attendanceRate: 76.9,
            avgDurationSeconds: 2500,
            hasSessions: true,
            segments: [],
          },
        ],
        rangeAverageRate: 63.2,
        largestMovement: {
          fromLabel: "6–12 Jul",
          toLabel: "13–19 Jul",
          deltaPts: -8.2,
          caption: "Largest move: attendance fell 8.2 pts from 6–12 Jul to 13–19 Jul.",
        },
        compositionCaption: null,
        dayTimeMatrix: {
          days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          bands: ["Morning", "Afternoon", "Evening", "Late"],
          cells: [
            {
              dayIndex: 1,
              bandIndex: 2,
              dayLabel: "Tue",
              bandLabel: "Evening",
              sessionCount: 4,
              attendanceRate: 78.1,
            },
          ],
          dayAverages: [null, 70, null, null, 41.3, null, null],
          bandAverages: [null, 41.3, 78.1, null],
          bestSlotCaption: "Evening sessions on Tue average 78.1%.",
          worstSlotCaption: "Fri afternoons average 41.3%.",
          slotsRanked: [
            {
              dayLabel: "Tue",
              bandLabel: "Evening",
              sessionCount: 4,
              attendanceRate: 78.1,
            },
          ],
        },
        byCourse: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            title: "Markets 101",
            sessionCount: 8,
            attendanceRate: 52.1,
            deltaVsTenantPts: -11.1,
            sparkline: [60, 55, 52, null],
          },
        ],
        byBatch: [],
      },
    });
    expect(parsed.data.summary.sessionCount).toBe(84);
    expect(parsed.data.periods).toHaveLength(1);
    expect(parsed.data.byCourse[0]?.sparkline).toEqual([60, 55, 52, null]);
  });
});
