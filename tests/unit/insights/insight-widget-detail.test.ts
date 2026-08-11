import { describe, expect, it } from "vitest";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { buildInsightWidgetDetail } from "../../../backend/apps/api/src/server/insights/insights-widget-detail";
import { insightWidgetDetailResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";
import type { InsightWidget } from "../../../backend/apps/api/src/server/insights/insights.schemas";

function seriesWidget(): InsightWidget {
  return {
    id: "monthly-revenue",
    title: "Revenue (12 months)",
    defaultViz: "line",
    span: "full",
    href: "/admin/reports/payments",
    deltaPct: 21.4,
    deltaAbs: 325100,
    footnote: "Best: 2026-03 (241800)",
    data: {
      columns: [
        { key: "period", label: "Period", kind: "date" },
        { key: "value", label: "Revenue", kind: "measure" },
      ],
      rows: [
        { period: "2025-05-01", value: 120000 },
        { period: "2026-03-01", value: 241800 },
        { period: "2026-04-01", value: 195400 },
        { period: "2026-05-01", value: 178250 },
      ],
      dimensions: ["period"],
      measures: ["value"],
    },
  };
}

function failedPaymentsWidget(): InsightWidget {
  return {
    id: "failed-payments",
    title: "Recent failed payments",
    defaultViz: "table",
    span: "full",
    href: "/admin/reports/payments/transactions",
    data: {
      columns: [
        { key: "learner", label: "Learner", kind: "string" },
        { key: "product", label: "Product", kind: "string" },
        { key: "amount", label: "Amount", kind: "measure" },
        { key: "gateway", label: "Gateway", kind: "dimension" },
        { key: "reason", label: "Failure reason", kind: "string" },
        { key: "attempted", label: "Attempted", kind: "date" },
      ],
      rows: [
        {
          learner: "learner-a",
          product: "Course A",
          amount: 4500,
          gateway: "razorpay",
          reason: "Insufficient funds",
          attempted: "2026-08-01T10:00:00.000Z",
        },
        {
          learner: "learner-b",
          product: "Course B",
          amount: 12000,
          gateway: "stripe",
          reason: "Card expired",
          attempted: "2026-08-01T11:00:00.000Z",
        },
        {
          learner: "learner-c",
          product: "Course C",
          amount: 999,
          gateway: "razorpay",
          reason: "Insufficient funds",
          attempted: "2026-08-01T12:00:00.000Z",
        },
      ],
      measures: ["amount"],
    },
  };
}

describe("insight widget detail", () => {
  it("builds comparison, average, related reports, and a valid payload", () => {
    const detail = buildInsightWidgetDetail(
      {
        slug: "dashboard",
        title: "Dashboard",
        currency: "INR",
        range: "12m",
        generatedAt: "2026-08-11T06:35:00.000Z",
        widgets: [seriesWidget()],
      },
      "monthly-revenue",
    );

    expect(detail.widget.id).toBe("monthly-revenue");
    expect(detail.description).toContain("Monthly breakdown");
    expect(detail.comparison?.unit).toBe("money");
    expect(detail.comparison?.deltaPct).toBe(21.4);
    expect(detail.average).toBeGreaterThan(0);
    expect(detail.related.some((item) => item.href === "/admin/reports/payments")).toBe(true);

    const parsed = insightWidgetDetailResponseSchema.parse({ data: detail });
    expect(parsed.data.slug).toBe("dashboard");
  });

  it("groups failed payments by reason and gateway", () => {
    const detail = buildInsightWidgetDetail(
      {
        slug: "dashboard",
        title: "Dashboard",
        range: "30d",
        generatedAt: "2026-08-11T06:35:00.000Z",
        widgets: [
          failedPaymentsWidget(),
          {
            id: "payment-orders",
            title: "Orders by status",
            defaultViz: "bar",
            span: "half",
            data: {
              columns: [
                { key: "label", label: "Status", kind: "dimension" },
                { key: "value", label: "Orders", kind: "measure" },
              ],
              rows: [
                { label: "paid", value: 92 },
                { label: "failed", value: 8 },
              ],
              dimensions: ["label"],
              measures: ["value"],
            },
          },
        ],
      },
      "failed-payments",
    );

    expect(detail.splitOptions.map((option) => option.id)).toEqual(
      expect.arrayContaining(["gateway", "reason"]),
    );
    expect(detail.splits["reason"]?.[0]?.label).toBe("Insufficient funds");
    expect(detail.failureRate?.currentPct).toBe(8);
    expect(detail.failureRate?.note).toMatch(/Insufficient funds/);
  });

  it("describes school vitals widgets and links related academy metrics", () => {
    const detail = buildInsightWidgetDetail(
      {
        slug: "school-vitals",
        title: "School Vitals",
        range: "30d",
        generatedAt: "2026-08-11T12:00:00.000Z",
        widgets: [
          {
            id: "daily-active-users",
            title: "Daily active users (30 days)",
            defaultViz: "area",
            span: "full",
            footnote: "Window is the last 30 days.",
            deltaPct: 10,
            data: {
              columns: [
                { key: "period", label: "Period", kind: "date" },
                { key: "value", label: "Active users", kind: "measure" },
              ],
              rows: [
                { period: "2026-08-01", value: 100 },
                { period: "2026-08-02", value: 140 },
                { period: "2026-08-03", value: 80 },
              ],
              dimensions: ["period"],
              measures: ["value"],
            },
          },
        ],
      },
      "daily-active-users",
    );

    expect(detail.description).toContain("Unique learners");
    expect(detail.splitOptions).toEqual([]);
    expect(detail.related.some((item) => item.href.includes("inactive-learners"))).toBe(true);
    expect(detail.insightNote).toContain("Window is the last 30 days.");
    expect(detail.insightNote).not.toContain("—");
    expect(detail.comparison?.current).toBe(107);
    expect(detail.comparison?.currentLabel).toContain("Average");
    expect(insightWidgetDetailResponseSchema.parse({ data: detail }).data.widget.id).toBe(
      "daily-active-users",
    );
  });

  it("points school vitals related funnel links at the dedicated funnel page", () => {
    const detail = buildInsightWidgetDetail(
      {
        slug: "school-vitals",
        title: "School Vitals",
        range: "30d",
        generatedAt: "2026-08-11T12:00:00.000Z",
        widgets: [
          {
            id: "practice-sessions",
            title: "Practice sessions",
            defaultViz: "kpi",
            span: "half",
            data: {
              columns: [{ key: "value", label: "Count", kind: "measure" }],
              rows: [{ value: 12 }],
              measures: ["value"],
            },
          },
        ],
      },
      "practice-sessions",
    );

    expect(
      detail.related.some((item) => item.href === "/admin/insights/school-vitals/funnel"),
    ).toBe(true);
  });

  it("points school vitals related content health links at the dedicated page", () => {
    const detail = buildInsightWidgetDetail(
      {
        slug: "school-vitals",
        title: "School Vitals",
        range: "30d",
        generatedAt: "2026-08-11T12:00:00.000Z",
        widgets: [
          {
            id: "moderation-opened",
            title: "Moderation cases opened",
            defaultViz: "kpi",
            span: "half",
            data: {
              columns: [{ key: "value", label: "Count", kind: "measure" }],
              rows: [{ value: 2 }],
              measures: ["value"],
            },
          },
        ],
      },
      "moderation-opened",
    );

    expect(
      detail.related.some((item) => item.href === "/admin/insights/school-vitals/content-health"),
    ).toBe(true);
  });

  it("links sales insight widgets to neighboring sales metrics", () => {
    const detail = buildInsightWidgetDetail(
      {
        slug: "sales-insight",
        title: "Sales Insight",
        currency: "INR",
        range: "12m",
        generatedAt: "2026-08-11T12:00:00.000Z",
        widgets: [seriesWidget()],
      },
      "monthly-revenue",
    );

    expect(detail.description).toContain("Monthly breakdown");
    expect(detail.related.some((item) => item.href === "/admin/insights/sales-insight")).toBe(
      false,
    );
    expect(detail.related.some((item) => item.href.includes("/widgets/pipeline"))).toBe(true);
    expect(detail.related.some((item) => item.href.includes("/widgets/failed-payments"))).toBe(
      true,
    );
    expect(detail.related.some((item) => item.href.includes("/widgets/top-products"))).toBe(true);
    expect(detail.insightNote).not.toContain("—");
  });

  it("does not sum sequential pipeline stages into comparison or average", () => {
    const detail = buildInsightWidgetDetail(
      {
        slug: "sales-insight",
        title: "Sales Insight",
        range: "12m",
        generatedAt: "2026-08-11T12:00:00.000Z",
        widgets: [
          {
            id: "pipeline",
            title: "Sales pipeline (all time)",
            defaultViz: "funnel",
            span: "half",
            footnote: "6% visited to enrolled.",
            data: {
              columns: [
                { key: "stage", label: "Stage", kind: "dimension" },
                { key: "count", label: "Leads", kind: "measure" },
              ],
              rows: [
                { stage: "Visited", count: 100 },
                { stage: "Started diagnostic", count: 40 },
                { stage: "Enrolled", count: 6 },
              ],
              dimensions: ["stage"],
              measures: ["count"],
            },
          },
        ],
      },
      "pipeline",
    );

    expect(detail.comparison).toBeNull();
    expect(detail.average).toBeNull();
    expect(detail.description).toContain("Sequential stages");
    expect(detail.related.some((item) => item.href.includes("/widgets/pipeline-30d"))).toBe(true);
    expect(
      detail.related.some((item) => item.href === "/admin/insights/sales-insight/pipeline"),
    ).toBe(true);
    expect(detail.insightNote).toBe("6% visited to enrolled.");
  });

  it("links top sources to the attribution board", () => {
    const detail = buildInsightWidgetDetail(
      {
        slug: "sales-insight",
        title: "Sales Insight",
        range: "12m",
        generatedAt: "2026-08-11T12:00:00.000Z",
        widgets: [
          {
            id: "top-sources",
            title: "Top attribution sources",
            defaultViz: "table",
            span: "half",
            href: "/admin/insights/sales-insight/attribution",
            data: {
              columns: [
                { key: "source", label: "Source", kind: "string" },
                { key: "events", label: "Events", kind: "measure" },
              ],
              rows: [{ source: "google", events: 12 }],
              measures: ["events"],
            },
          },
        ],
      },
      "top-sources",
    );

    expect(
      detail.related.some((item) => item.href === "/admin/insights/sales-insight/attribution"),
    ).toBe(true);
    expect(detail.related.some((item) => item.href === "/admin/insights/marketing-insight")).toBe(
      true,
    );
  });

  it("links conversion opportunity to the opportunity board", () => {
    const detail = buildInsightWidgetDetail(
      {
        slug: "sales-insight",
        title: "Sales Insight",
        range: "12m",
        generatedAt: "2026-08-11T12:00:00.000Z",
        widgets: [
          {
            id: "opportunity-pool",
            title: "Conversion opportunity",
            defaultViz: "table",
            span: "half",
            href: "/admin/insights/sales-insight/opportunity",
            data: {
              columns: [
                { key: "segment", label: "Segment", kind: "dimension" },
                { key: "count", label: "Count", kind: "measure" },
              ],
              rows: [{ segment: "Paid enrollments", count: 12 }],
              measures: ["count"],
            },
          },
        ],
      },
      "opportunity-pool",
    );

    expect(
      detail.related.some((item) => item.href === "/admin/insights/sales-insight/opportunity"),
    ).toBe(true);
  });

  it("throws when the widget is missing", () => {
    expect(() =>
      buildInsightWidgetDetail(
        {
          slug: "dashboard",
          title: "Dashboard",
          widgets: [],
        },
        "missing",
      ),
    ).toThrow(AtlasHttpError);
  });
});
