import { describe, expect, it } from "vitest";
import {
  DEFAULT_OUTLIER_THRESHOLDS,
  outlierThresholdsSchema,
  superLiveInsightsOutliersPreviewResponseSchema,
  superLiveInsightsOutliersQuerySchema,
  superLiveInsightsOutliersResponseSchema,
} from "@atlas/domain/reports/super-live-insights-outliers.dto";
import { detectOutlierFindings } from "@atlas/domain/reports/super-live-insights-outliers.service";
import type { OutlierSessionRow } from "@atlas/domain/reports/super-live-insights-outliers.repository";

function session(partial: Partial<OutlierSessionRow> & { id: string }): OutlierSessionRow {
  return {
    title: "Week 6",
    course_id: "11111111-1111-4111-8111-111111111111",
    course_title: "Foundations",
    batch_name: "Cohort 12",
    scheduled_at: new Date("2026-07-12T10:00:00.000Z"),
    started_at: new Date("2026-07-12T10:05:00.000Z"),
    ended_at: new Date("2026-07-12T11:00:00.000Z"),
    duration_seconds: 3300,
    attended_count: 20,
    registered_count: 5,
    absent_count: 5,
    total_count: 30,
    avg_duration_seconds: 2400,
    attendance_rate: 66.7,
    start_delay_seconds: 300,
    course_avg_rate: 70,
    expected_registrations: 40,
    ...partial,
  };
}

describe("super live insights outliers dto", () => {
  it("parses query defaults and thresholds", () => {
    const parsed = superLiveInsightsOutliersQuerySchema.parse({
      startedFrom: "2026-07-01T00:00:00.000Z",
      startedTo: "2026-07-31T23:59:59.999Z",
    });
    expect(parsed.category).toBe("all");
    expect(outlierThresholdsSchema.parse({})).toEqual(DEFAULT_OUTLIER_THRESHOLDS);
  });

  it("accepts outliers response shape", () => {
    const response = superLiveInsightsOutliersResponseSchema.parse({
      data: {
        category: "all",
        thresholds: DEFAULT_OUTLIER_THRESHOLDS,
        counts: {
          all: 1,
          far_below: 1,
          far_above: 0,
          unresolved: 0,
          no_records: 0,
          short_duration: 0,
          started_late: 0,
        },
        dataQualityRecordsAffected: 30,
        findings: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:far_below",
            sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            category: "far_below",
            severity: "data_quality",
            title: "Attendance fell",
            sessionTitle: "Week 6",
            courseTitle: "Foundations",
            batchName: null,
            scheduledAt: "2026-07-12T10:00:00.000Z",
            evidence: [{ label: "rate 31.4%", tone: "ink" }],
            composition: {
              attendedCount: 10,
              registeredCount: 5,
              absentCount: 15,
              totalCount: 30,
            },
            metrics: {
              attendanceRate: 31.4,
              courseAvgRate: 63.2,
              avgDurationSeconds: 1200,
              sessionDurationSeconds: 3600,
              startDelaySeconds: 120,
            },
          },
        ],
      },
    });
    expect(response.data.findings).toHaveLength(1);

    const preview = superLiveInsightsOutliersPreviewResponseSchema.parse({
      data: { findingCount: 4, thresholds: DEFAULT_OUTLIER_THRESHOLDS },
    });
    expect(preview.data.findingCount).toBe(4);
  });
});

describe("detectOutlierFindings", () => {
  it("flags far below, unresolved, no records, short duration, and late start", () => {
    const findings = detectOutlierFindings(
      [
        session({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          attendance_rate: 30,
          course_avg_rate: 65,
          registered_count: 12,
          total_count: 40,
          attended_count: 12,
          absent_count: 16,
        }),
        session({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          total_count: 0,
          attended_count: 0,
          registered_count: 0,
          absent_count: 0,
          attendance_rate: null,
          expected_registrations: 38,
        }),
        session({
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          avg_duration_seconds: 600,
          duration_seconds: 3600,
          attendance_rate: 70,
          course_avg_rate: 70,
          registered_count: 1,
          total_count: 20,
        }),
        session({
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          start_delay_seconds: 22 * 60,
          attendance_rate: 55,
          course_avg_rate: 60,
        }),
      ],
      DEFAULT_OUTLIER_THRESHOLDS,
    );

    const categories = findings.map((finding) => finding.category);
    expect(categories).toContain("far_below");
    expect(categories).toContain("unresolved");
    expect(categories).toContain("no_records");
    expect(categories).toContain("short_duration");
    expect(categories).toContain("started_late");
  });

  it("ignores noisy small sessions for rate-based findings when enabled", () => {
    const findings = detectOutlierFindings(
      [
        session({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          total_count: 3,
          attended_count: 0,
          registered_count: 3,
          absent_count: 0,
          attendance_rate: 0,
          course_avg_rate: 80,
        }),
      ],
      DEFAULT_OUTLIER_THRESHOLDS,
    );
    expect(findings.filter((finding) => finding.category === "far_below")).toHaveLength(0);
    expect(findings.filter((finding) => finding.category === "unresolved")).toHaveLength(0);
  });
});
