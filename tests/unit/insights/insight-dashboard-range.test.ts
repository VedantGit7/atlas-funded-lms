import { describe, expect, it } from "vitest";
import {
  computeDeltaPct,
  insightRangeBucketFragments,
  insightRangeDayCount,
  isInsightDashboardRange,
  resolveInsightRangeWindow,
} from "../../../backend/apps/api/src/server/insights/insights-range";
import { insightDashboardQuerySchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

describe("insight dashboard range", () => {
  it("accepts known range tokens", () => {
    expect(isInsightDashboardRange("12m")).toBe(true);
    expect(isInsightDashboardRange("30d")).toBe(true);
    expect(isInsightDashboardRange("ytd")).toBe(true);
    expect(isInsightDashboardRange("7d")).toBe(false);
  });

  it("defaults the query schema to last 12 months", () => {
    expect(insightDashboardQuerySchema.parse({}).range).toBe("12m");
    expect(insightDashboardQuerySchema.parse({ range: "30d" }).range).toBe("30d");
  });

  it("builds a 30-day window with an equal previous period", () => {
    const now = new Date("2026-08-11T12:00:00.000Z");
    const window = resolveInsightRangeWindow("30d", now);
    expect(window.grain).toBe("day");
    expect(window.to.toISOString()).toBe(now.toISOString());
    expect(window.from.getTime()).toBe(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    expect(window.previousTo.getTime()).toBe(window.from.getTime());
  });

  it("builds a year-to-date window from January 1 UTC", () => {
    const now = new Date("2026-08-11T12:00:00.000Z");
    const window = resolveInsightRangeWindow("ytd", now);
    expect(window.grain).toBe("month");
    expect(window.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("counts inclusive calendar days for each range token", () => {
    const now = new Date("2026-08-11T12:00:00.000Z");
    expect(insightRangeDayCount("30d", now)).toBe(30);
    expect(insightRangeDayCount("ytd", now)).toBe(223);
  });

  it("computes percent delta without dividing by zero", () => {
    expect(computeDeltaPct(120, 100)).toBe(20);
    expect(computeDeltaPct(0, 0)).toBe(0);
    expect(computeDeltaPct(40, 0)).toBeNull();
    expect(computeDeltaPct(80, 100)).toBe(-20);
  });

  it("exposes date_trunc field names as SQL literals, not bind parameters", () => {
    const month = insightRangeBucketFragments("month");
    const day = insightRangeBucketFragments("day");
    expect(month.truncFieldSql).toBe("'month'");
    expect(month.intervalSql).toBe("interval '1 month'");
    expect(day.truncFieldSql).toBe("'day'");
    expect(day.intervalSql).toBe("interval '1 day'");
  });
});
