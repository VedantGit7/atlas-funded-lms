import { describe, expect, it } from "vitest";
import {
  analyticsDashboardQuerySchema,
  analyticsFunnelQuerySchema,
  analyticsItemStatisticsQuerySchema,
} from "@atlas/domain/analytics/analytics.dto";
import {
  ANALYTICS_MAX_RANGE_DAYS,
  getDashboardDefinition,
  getFunnelDefinition,
  parseBoundedDateRange,
} from "@atlas/domain/analytics/analytics-definition-registry";
import { isDeferredAnalyticsEvent } from "@atlas/domain/analytics/analytics.worker";
import {
  isRollingItemStatisticWindow,
  itemStatisticWindowCutoff,
  liveItemStatisticWindowKeys,
} from "@atlas/domain/analytics/analytics-window";

describe("analytics query validation", () => {
  it("accepts registered dashboard query fields", () => {
    const parsed = analyticsDashboardQuerySchema.parse({
      dashboardKey: "tenant.learning",
      from: "2026-05-01",
      to: "2026-05-20",
      limit: "25",
    });

    expect(parsed.dashboardKey).toBe("tenant.learning");
    expect(parsed.limit).toBe(25);
  });

  it("rejects unknown dashboard keys and forbidden fields", () => {
    expect(() =>
      analyticsDashboardQuerySchema.parse({
        dashboardKey: "funded.conversion",
      }),
    ).toThrow();

    expect(() =>
      analyticsDashboardQuerySchema.parse({
        tenant_id: "00000000-0000-0000-0000-000000000001",
      }),
    ).toThrow();

    expect(() =>
      analyticsDashboardQuerySchema.parse({
        rollup_key: "secret",
      }),
    ).toThrow();

    expect(() =>
      analyticsDashboardQuerySchema.parse({
        filter: JSON.stringify({ a: 1 }),
      }),
    ).toThrow();
  });

  it("rejects unknown funnel keys", () => {
    expect(() =>
      analyticsFunnelQuerySchema.parse({
        funnelKey: "payment.checkout",
      }),
    ).toThrow();
  });

  it("requires assessmentId for item statistics", () => {
    expect(() =>
      analyticsItemStatisticsQuerySchema.parse({
        windowKey: "rolling_30d",
      }),
    ).toThrow();
  });

  it("rejects unknown window keys", () => {
    expect(() =>
      analyticsItemStatisticsQuerySchema.parse({
        assessmentId: "00000000-0000-0000-0000-000000000010",
        windowKey: "custom",
      }),
    ).toThrow();
  });

  it("enforces maximum date range", () => {
    expect(() =>
      parseBoundedDateRange({
        from: "2026-01-01",
        to: "2026-06-01",
      }),
    ).toThrow(`Date range cannot exceed ${String(ANALYTICS_MAX_RANGE_DAYS)} days.`);
  });

  it("ignores deferred challenge and payment source events", () => {
    expect(isDeferredAnalyticsEvent("challenge.purchased")).toBe(true);
    expect(isDeferredAnalyticsEvent("payment.failed")).toBe(true);
    expect(isDeferredAnalyticsEvent("lesson.completed")).toBe(false);
  });

  it("registers only approved dashboard and funnel definitions", () => {
    expect(getDashboardDefinition("tenant.learning")?.scopeType).toBe("tenant");
    expect(getDashboardDefinition("unknown")).toBeNull();
    expect(getFunnelDefinition("learning.engagement")?.stageKeys.length).toBeGreaterThan(0);
    expect(getFunnelDefinition("funded.status")).toBeNull();
  });
});

describe("analytics item statistic windows", () => {
  it("live writes only all_time", () => {
    expect(liveItemStatisticWindowKeys()).toEqual(["all_time"]);
  });

  it("identifies rolling windows and cutoffs", () => {
    expect(isRollingItemStatisticWindow("rolling_30d")).toBe(true);
    expect(isRollingItemStatisticWindow("rolling_90d")).toBe(true);
    expect(isRollingItemStatisticWindow("all_time")).toBe(false);

    const now = new Date("2026-07-24T12:00:00.000Z");
    const cutoff30 = itemStatisticWindowCutoff("rolling_30d", now);
    const cutoff90 = itemStatisticWindowCutoff("rolling_90d", now);
    expect(cutoff30?.toISOString()).toBe("2026-06-24T12:00:00.000Z");
    expect(cutoff90?.toISOString()).toBe("2026-04-25T12:00:00.000Z");
    expect(itemStatisticWindowCutoff("all_time", now)).toBeNull();
  });
});

describe("analytics source registry", () => {
  it("does not register wildcard analytics source events by default", async () => {
    await import("../../../backend/apps/api/src/server/analytics/analytics-source-adapters");
    const { listRegisteredAnalyticsSourceEvents } =
      await import("@atlas/domain/analytics/analytics-source-registry");
    const events = listRegisteredAnalyticsSourceEvents();
    expect(events).toContain("lesson.completed");
    expect(events).not.toContain("challenge.purchased");
    expect(events).not.toContain("payment.failed");
  });
});

describe("progress dashboard composition", () => {
  it("does not reference advanced analytics API paths", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile("frontend/apps/web/src/app/(learner)/progress/page.tsx", "utf8"),
    );

    expect(source).not.toContain("/api/v1/analytics/");
  });
});
