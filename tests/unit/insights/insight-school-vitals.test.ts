import { describe, expect, it } from "vitest";
import {
  contentHealthRows,
  downsampleSparkline,
  joinFootnotes,
  SCHOOL_VITALS_FUNNEL_FOOTNOTE,
  SCHOOL_VITALS_INVERT_FOOTNOTE,
  SCHOOL_VITALS_WINDOW_FOOTNOTE,
  schoolVitalsWindowFootnote,
  seriesHalfDelta,
  seriesPeakCaption,
  weekdayWeekendCaption,
} from "../../../backend/apps/api/src/server/insights/insights-school-vitals";
import { insightDashboardResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

describe("school vitals series helpers", () => {
  it("computes second-half minus first-half delta and keeps the sparkline", () => {
    const delta = seriesHalfDelta([
      { period: "2026-08-01", value: 10 },
      { period: "2026-08-02", value: 10 },
      { period: "2026-08-03", value: 20 },
      { period: "2026-08-04", value: 30 },
    ]);

    expect(delta.sparkline).toEqual([10, 10, 20, 30]);
    expect(delta.deltaAbs).toBe(30);
    expect(delta.deltaPct).toBe(150);
  });

  it("returns null deltas when the series is too short", () => {
    const delta = seriesHalfDelta([
      { period: "2026-08-01", value: 4 },
      { period: "2026-08-02", value: 6 },
    ]);
    expect(delta.deltaAbs).toBeNull();
    expect(delta.deltaPct).toBeNull();
    expect(delta.sparkline).toEqual([4, 6]);
  });

  it("names the busiest and quietest days without an em dash", () => {
    const caption = seriesPeakCaption([
      { period: "2026-08-01", value: 12 },
      { period: "2026-08-04", value: 40 },
      { period: "2026-08-07", value: 3 },
    ]);
    expect(caption).toContain("Busiest: Aug 4 (40)");
    expect(caption).toContain("Quietest: Aug 7 (3)");
    expect(caption).not.toContain("—");
    expect(caption).not.toContain("–");
  });

  it("describes weekday versus weekend means", () => {
    const caption = weekdayWeekendCaption([
      { period: "2026-08-03", value: 100 },
      { period: "2026-08-04", value: 100 },
      { period: "2026-08-08", value: 40 },
      { period: "2026-08-09", value: 20 },
    ]);
    expect(caption).toContain("Weekday mean 100");
    expect(caption).toContain("weekend mean 30");
    expect(caption).not.toContain("—");
  });

  it("joins footnotes and skips empty parts", () => {
    expect(
      joinFootnotes(SCHOOL_VITALS_WINDOW_FOOTNOTE, undefined, SCHOOL_VITALS_FUNNEL_FOOTNOTE),
    ).toBe(`${SCHOOL_VITALS_WINDOW_FOOTNOTE} ${SCHOOL_VITALS_FUNNEL_FOOTNOTE}`);
    expect(joinFootnotes(undefined, "  ")).toBeUndefined();
  });

  it("downsamples long sparklines without changing short ones", () => {
    expect(downsampleSparkline([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    const long = Array.from({ length: 48 }, (_, index) => index + 1);
    const compact = downsampleSparkline(long, 24);
    expect(compact).toHaveLength(24);
    expect(compact[0]).toBe(2);
    expect(compact[compact.length - 1]).toBe(48);
  });

  it("labels the selected window without an em dash", () => {
    expect(schoolVitalsWindowFootnote("30d")).toBe(SCHOOL_VITALS_WINDOW_FOOTNOTE);
    expect(schoolVitalsWindowFootnote("ytd")).toBe("Window is year to date.");
    expect(schoolVitalsWindowFootnote("12m")).toBe("Window is the last 12 months.");
    expect(schoolVitalsWindowFootnote("12m")).not.toContain("—");
  });
});

describe("content health rows", () => {
  const snapshot = {
    learnerCount: 10,
    enrollmentCount: 4,
    currentMau: 3,
    activeUsers30d: 3,
    inactiveLearnerCount: 2,
    dormantCourseCount: 1,
    openModerationCases: 0,
    upcomingLiveCount: 5,
    dailyActiveUsers: [],
    topCourses: [],
  };

  it("tints the first three signals when they are non-zero and keeps live sessions neutral", () => {
    const rows = contentHealthRows(snapshot);
    expect(rows).toHaveLength(4);
    expect(rows[0]?.id).toBe("dormant-courses");
    expect(rows[0]?.tone).toBe("warning");
    expect(rows[0]?.href).toBe("/admin/reports/resource-usage/dormant");
    expect(rows[1]?.tone).toBe("warning");
    expect(rows[1]?.href).toBe("/admin/reports/resource-usage/inactive-learners");
    expect(rows[2]?.tone).toBe("neutral");
    expect(rows[2]?.href).toBe("/admin/moderation/cases");
    expect(rows[3]?.tone).toBe("neutral");
    expect(rows[3]?.href).toBe("/admin/live-sessions");
    expect(rows[2]?.consequence).toBe("No cases waiting in the queue.");
    expect(SCHOOL_VITALS_INVERT_FOOTNOTE).toBe("Higher is worse.");
  });
});

describe("school vitals dashboard schema", () => {
  it("accepts enriched school vitals widgets with footnotes, sparklines, and content-health rows", () => {
    const parsed = insightDashboardResponseSchema.parse({
      data: {
        slug: "school-vitals",
        title: "School Vitals",
        range: "30d",
        generatedAt: "2026-08-11T12:00:00.000Z",
        alerts: [],
        widgets: [
          {
            id: "inactive-learners",
            title: "Inactive learners (30d+)",
            defaultViz: "kpi",
            span: "third",
            footnote: SCHOOL_VITALS_INVERT_FOOTNOTE,
            href: "/admin/reports/resource-usage/inactive-learners",
            data: {
              columns: [
                { key: "metric", label: "Metric", kind: "dimension" },
                { key: "value", label: "Inactive learners (30d+)", kind: "measure" },
              ],
              rows: [{ metric: "Inactive learners (30d+)", value: 412 }],
              measures: ["value"],
            },
          },
          {
            id: "learning-activity",
            title: "Learning activity (30d)",
            defaultViz: "line",
            span: "full",
            footnote: SCHOOL_VITALS_WINDOW_FOOTNOTE,
            sparkline: [12, 18, 9, 22],
            data: {
              columns: [
                { key: "period", label: "Period", kind: "date" },
                { key: "value", label: "Activity", kind: "measure" },
              ],
              rows: [{ period: "2026-08-01", value: 12 }],
              dimensions: ["period"],
              measures: ["value"],
            },
          },
          {
            id: "content-health",
            title: "Content health",
            defaultViz: "table",
            span: "half",
            data: {
              columns: [
                { key: "signal", label: "Signal", kind: "dimension" },
                { key: "count", label: "Count", kind: "measure" },
                { key: "consequence", label: "Consequence", kind: "string" },
                { key: "href", label: "Report", kind: "string" },
                { key: "tone", label: "Tone", kind: "string" },
              ],
              rows: [
                {
                  signal: "Dormant courses (30d)",
                  count: 18,
                  consequence: "Published courses with no learner activity in 30 days.",
                  href: "/admin/reports/resource-usage/dormant",
                  tone: "warning",
                },
              ],
              dimensions: ["signal"],
              measures: ["count"],
            },
          },
        ],
      },
    });

    expect(parsed.data.widgets[0]?.footnote).toBe(SCHOOL_VITALS_INVERT_FOOTNOTE);
    expect(parsed.data.widgets[2]?.data.rows[0]?.tone).toBe("warning");
  });
});
