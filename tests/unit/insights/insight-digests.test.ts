import { describe, expect, it } from "vitest";
import {
  applyDigestMutation,
  createDigest,
  digestPreviewSelection,
  digestStatus,
  historyCells,
  isOutsideDomain,
  isValidEmail,
  nextSendAt,
  parseInsightDigestState,
  projectDigestSummary,
  recipientInitials,
  scheduleLabel,
} from "../../../backend/apps/api/src/server/insights/insights-digests";
import { insightDigestsResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

const mondayMorningUtc = new Date("2026-08-10T07:00:00.000Z");

function sampleDigest() {
  return createDigest(
    {
      name: "Weekly ops",
      sourceSlug: "dashboard",
      includeAlerts: true,
      includeKpis: true,
      widgetIds: ["monthly-revenue"],
      period: "30d",
      format: "inline",
      recipients: ["ops@academy.test", "consultant@external.agency"],
      cadence: "weekly",
      weekday: "mon",
      time: "08:00",
      timezone: "UTC",
    },
    mondayMorningUtc,
  );
}

describe("insight digests", () => {
  it("computes the next weekly send in the digest timezone", () => {
    const digest = sampleDigest();
    expect(nextSendAt(digest, mondayMorningUtc)?.toISOString()).toBe("2026-08-10T08:00:00.000Z");
    expect(nextSendAt(digest, new Date("2026-08-10T09:00:00.000Z"))?.toISOString()).toBe(
      "2026-08-17T08:00:00.000Z",
    );
  });

  it("flags recipients outside the academy domain", () => {
    expect(isOutsideDomain("ops@academy.test", ["academy.test"])).toBe(false);
    expect(isOutsideDomain("consultant@external.agency", ["academy.test"])).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(recipientInitials("ops.team@academy.test")).toBe("OT");
  });

  it("summarizes enabled, paused, failing, and unique recipients", () => {
    const enabled = sampleDigest();
    const paused = {
      ...sampleDigest(),
      id: "paused",
      enabled: false,
      recipients: ["ops@academy.test"],
    };
    const failing = {
      ...sampleDigest(),
      id: "failing",
      recipients: ["ops@academy.test"],
      sends: [
        {
          at: "2026-08-03T08:00:00.000Z",
          status: "failed" as const,
          error: "No recipients delivered",
          test: false,
        },
      ],
    };
    const summary = projectDigestSummary(
      [enabled, paused, failing],
      ["academy.test"],
      mondayMorningUtc,
    );
    expect(summary.total).toBe(3);
    expect(summary.enabled).toBe(2);
    expect(summary.paused).toBe(1);
    expect(summary.failing).toBe(1);
    expect(summary.recipients).toBe(2);
    expect(summary.outsideDomain).toBe(1);
    expect(summary.sendsThisMonth).toBe(1);
  });

  it("builds a 30-day history strip and paused status", () => {
    const digest = {
      ...sampleDigest(),
      enabled: false,
      sends: [
        { at: "2026-08-10T08:00:00.000Z", status: "delivered" as const, error: null, test: false },
        {
          at: "2026-08-09T08:00:00.000Z",
          status: "failed" as const,
          error: "Timeout",
          test: false,
        },
      ],
    };
    expect(digestStatus(digest)).toBe("paused");
    const cells = historyCells(digest, new Date("2026-08-10T12:00:00.000Z"), 4);
    expect(cells).toEqual(["empty", "empty", "failed", "delivered"]);
    expect(scheduleLabel(digest)).toContain("Monday");
  });

  it("applies create, toggle, test send, and delete without mutating other keys", () => {
    const created = sampleDigest();
    let state = applyDigestMutation({ items: {} }, { type: "create", digest: created });
    expect(Object.keys(state["items"])).toEqual([created.id]);
    state = applyDigestMutation(state, { type: "toggle", id: created.id, enabled: false });
    expect(state["items"][created.id]?.enabled).toBe(false);
    state = applyDigestMutation(state, {
      type: "send-test",
      id: created.id,
      at: "2026-08-10T08:05:00.000Z",
      status: "delivered",
    });
    expect(state["items"][created.id]?.sends).toHaveLength(1);
    state = applyDigestMutation(state, { type: "delete", id: created.id });
    expect(state["items"]).toEqual({});
  });

  it("includes KPIs even when widgetIds only list charts", () => {
    const widgets = [
      { id: "enrollments", defaultViz: "kpi" },
      { id: "current-mau", defaultViz: "kpi" },
      { id: "engagement-funnel", defaultViz: "funnel" },
      { id: "monthly-revenue", defaultViz: "bar" },
    ];
    const withKpis = digestPreviewSelection(widgets, {
      includeKpis: true,
      widgetIds: ["monthly-revenue"],
    });
    expect(withKpis.kpiIds).toEqual(["enrollments", "current-mau"]);
    expect(withKpis.chartIds).toEqual(["monthly-revenue"]);

    const withoutKpis = digestPreviewSelection(widgets, {
      includeKpis: false,
      widgetIds: ["monthly-revenue", "engagement-funnel"],
    });
    expect(withoutKpis.kpiIds).toEqual([]);
    expect(withoutKpis.chartIds).toEqual(["engagement-funnel", "monthly-revenue"]);
  });

  it("parses persisted JSON and accepts the board schema", () => {
    const parsed = parseInsightDigestState({
      items: {
        dg_1: {
          id: "dg_1",
          name: "Daily performance",
          sourceSlug: "school-vitals",
          enabled: true,
          includeAlerts: false,
          includeKpis: true,
          widgetIds: ["a"],
          period: "ytd",
          format: "link",
          recipients: ["lead@academy.test"],
          cadence: "daily",
          weekday: "tue",
          time: "07:00",
          timezone: "Asia/Kolkata",
          createdAt: "2026-08-01T00:00:00.000Z",
          sends: [],
        },
      },
    });
    expect(parsed["items"]["dg_1"]?.timezone).toBe("Asia/Kolkata");
    const result = insightDigestsResponseSchema.safeParse({
      data: {
        slug: "dashboard",
        title: "Dashboard",
        academyName: "Insights",
        actorEmail: "ops@academy.test",
        tenantDomains: ["academy.test"],
        generatedAt: "2026-08-11T00:00:00.000Z",
        sections: [{ slug: "dashboard", title: "Dashboard" }],
        timezones: ["UTC"],
        weekdays: [{ value: "mon", label: "Monday" }],
        catalog: [],
        summary: {
          total: 0,
          enabled: 0,
          paused: 0,
          sendsThisMonth: 0,
          deliveredThisMonth: 0,
          recipients: 0,
          outsideDomain: 0,
          nextSendAt: null,
          nextSendName: null,
          failing: 0,
        },
        digests: [],
        preview: null,
      },
    });
    expect(result.success).toBe(true);
  });
});
