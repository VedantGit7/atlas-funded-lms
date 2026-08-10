import { describe, expect, it } from "vitest";
import {
  superLiveInsightsCompareCandidatesQuerySchema,
  superLiveInsightsCompareQuerySchema,
  superLiveInsightsCompareResponseSchema,
} from "@atlas/domain/reports/super-live-insights-compare.dto";

describe("super live insights compare dto", () => {
  it("parses session ids list and defaults", () => {
    const parsed = superLiveInsightsCompareQuerySchema.parse({
      ids: "11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222",
    });
    expect(parsed.mode).toBe("sessions");
    expect(parsed.ids).toHaveLength(2);
  });

  it("requires seriesKind for series mode", () => {
    expect(() =>
      superLiveInsightsCompareQuerySchema.parse({
        mode: "series",
        ids: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
      }),
    ).toThrow();

    const parsed = superLiveInsightsCompareQuerySchema.parse({
      mode: "series",
      seriesKind: "course",
      ids: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
    });
    expect(parsed.seriesKind).toBe("course");
  });

  it("accepts compare response and candidates query", () => {
    const response = superLiveInsightsCompareResponseSchema.parse({
      data: {
        mode: "sessions",
        seriesKind: null,
        items: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            title: "Week 6",
            subtitle: "Foundations",
            scheduledAt: "2026-07-12T10:00:00.000Z",
            courseTitle: "Foundations",
            batchName: null,
            colorIndex: 0,
            metrics: {
              totalRecords: 40,
              attendedCount: 30,
              registeredCount: 7,
              absentCount: 3,
              attendanceRate: 75,
              avgDurationSeconds: 2800,
              sessionDurationSeconds: 3600,
              coveragePct: 77.8,
              startDelaySeconds: 120,
              scheduledSlot: "Sat 10:00",
              sessionsHeld: null,
            },
            composition: {
              attendedCount: 30,
              registeredCount: 7,
              absentCount: 3,
              totalCount: 40,
            },
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            title: "Week 5",
            subtitle: "Foundations",
            scheduledAt: "2026-07-05T10:00:00.000Z",
            courseTitle: "Foundations",
            batchName: null,
            colorIndex: 1,
            metrics: {
              totalRecords: 38,
              attendedCount: 28,
              registeredCount: 8,
              absentCount: 2,
              attendanceRate: 73.7,
              avgDurationSeconds: 2700,
              sessionDurationSeconds: 3600,
              coveragePct: 75,
              startDelaySeconds: 60,
              scheduledSlot: "Sat 10:00",
              sessionsHeld: null,
            },
            composition: {
              attendedCount: 28,
              registeredCount: 8,
              absentCount: 2,
              totalCount: 38,
            },
          },
        ],
        tenantAverages: {
          attendanceRate: 68,
          coveragePct: 74,
          avgDurationSeconds: 2600,
        },
        compositionCaption: null,
      },
    });
    expect(response.data.items).toHaveLength(2);

    const candidates = superLiveInsightsCompareCandidatesQuerySchema.parse({
      mode: "sessions",
      q: "week",
      excludeIds: "11111111-1111-4111-8111-111111111111",
    });
    expect(candidates.excludeIds).toHaveLength(1);
    expect(candidates.limit).toBe(20);
  });
});
