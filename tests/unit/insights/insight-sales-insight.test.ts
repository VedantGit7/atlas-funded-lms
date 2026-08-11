import { describe, expect, it } from "vitest";
import {
  SALES_INVERT_FOOTNOTE,
  SALES_OPPORTUNITY_FOOTNOTE,
  SALES_PIPELINE_EMPTY_CAPTION,
  salesConversionDisplay,
  salesConversionRate,
  salesMonthlyRevenueCaption,
  salesPipelineCaption,
  salesPipelinePairCaption,
  salesStepConversion,
  salesStepConversionPct,
  salesFormatSignedPts,
  salesLeakCaption,
} from "../../../backend/apps/api/src/server/insights/insights-sales-insight";
import { insightDashboardResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

describe("sales insight conversion helpers", () => {
  it("rounds visited-to-enrolled to a whole number", () => {
    expect(salesConversionRate(18420, 1284)).toBe(7);
    expect(salesConversionRate(4120, 370)).toBe(9);
  });

  it("returns null instead of 0% when nothing visited", () => {
    expect(salesConversionRate(0, 0)).toBeNull();
    expect(salesConversionRate(0, 12)).toBeNull();
    expect(salesConversionDisplay(0, 0)).toBe("-");
    expect(salesConversionDisplay(100, 6)).toBe("6%");
  });

  it("labels stage-to-stage conversion and uses a hyphen when the prior stage is empty", () => {
    expect(salesStepConversion(18420, 2140)).toBe("12%");
    expect(salesStepConversion(0, 4)).toBe("-");
    expect(salesStepConversionPct(18420, 2140)).toBe(11.6);
    expect(salesStepConversionPct(0, 4)).toBeNull();
    expect(salesFormatSignedPts(2)).toBe("+2 pts");
    expect(salesFormatSignedPts(0.3)).toBe("+0.3 pts");
    expect(salesFormatSignedPts(null)).toBe("-");
    expect(
      salesLeakCaption(
        { visited: 18420, startedDiagnostic: 2140, enrolled: 1284 },
        { visited: 3480, startedDiagnostic: 415, enrolled: 312 },
      ),
    ).toBe("Most visitors never start a diagnostic.");
  });

  it("captions a pipeline without an em dash", () => {
    expect(salesPipelineCaption({ visited: 18420, startedDiagnostic: 2140, enrolled: 1284 })).toBe(
      "7% visited to enrolled.",
    );
    expect(salesPipelineCaption({ visited: 0, startedDiagnostic: 0, enrolled: 0 })).toBe(
      SALES_PIPELINE_EMPTY_CAPTION,
    );
    expect(SALES_PIPELINE_EMPTY_CAPTION).not.toContain("—");
    expect(SALES_PIPELINE_EMPTY_CAPTION).not.toContain("–");
  });

  it("compares 30-day conversion against all time", () => {
    expect(
      salesPipelinePairCaption(
        { visited: 18420, startedDiagnostic: 2140, enrolled: 1284 },
        { visited: 4120, startedDiagnostic: 680, enrolled: 370 },
      ),
    ).toBe("Conversion is 2 points higher in the last 30 days than all time.");
    expect(
      salesPipelinePairCaption(
        { visited: 100, startedDiagnostic: 40, enrolled: 20 },
        { visited: 50, startedDiagnostic: 20, enrolled: 10 },
      ),
    ).toBe("Conversion in the last 30 days matches all time.");
    expect(
      salesPipelinePairCaption(
        { visited: 0, startedDiagnostic: 0, enrolled: 0 },
        { visited: 0, startedDiagnostic: 0, enrolled: 0 },
      ),
    ).toBe(SALES_PIPELINE_EMPTY_CAPTION);
  });
});

describe("sales insight captions", () => {
  it("names the highest and lowest revenue months with the currency code", () => {
    const caption = salesMonthlyRevenueCaption(
      [
        { period: "2026-01-01", amountMajor: 180000 },
        { period: "2026-06-01", amountMajor: 240000 },
        { period: "2026-12-01", amountMajor: 520000 },
      ],
      "INR",
    );
    expect(caption).toContain("Highest revenue in December (520,000.00 INR)");
    expect(caption).toContain("lowest in January (180,000.00 INR)");
    expect(caption).not.toContain("—");
  });

  it("says when the 12-month series has no paid revenue", () => {
    expect(
      salesMonthlyRevenueCaption(
        [
          { period: "2026-01-01", amountMajor: 0 },
          { period: "2026-02-01", amountMajor: 0 },
        ],
        "INR",
      ),
    ).toBe("No paid revenue in the last 12 months.");
  });

  it("keeps inverted and opportunity footnotes free of em dashes", () => {
    expect(SALES_INVERT_FOOTNOTE).toBe("Higher is worse.");
    expect(SALES_OPPORTUNITY_FOOTNOTE).toContain("overlap");
    expect(SALES_OPPORTUNITY_FOOTNOTE).not.toContain("—");
    expect(SALES_INVERT_FOOTNOTE).not.toContain("—");
  });
});

describe("sales insight dashboard schema", () => {
  it("accepts enriched sales widgets with footnotes and inverted failed-orders", () => {
    const parsed = insightDashboardResponseSchema.parse({
      data: {
        slug: "sales-insight",
        title: "Sales Insight",
        currency: "INR",
        widgets: [
          {
            id: "failed-orders",
            title: "Failed orders",
            defaultViz: "kpi",
            span: "third",
            footnote: SALES_INVERT_FOOTNOTE,
            href: "/admin/reports/payments",
            data: {
              columns: [
                { key: "metric", label: "Metric", kind: "dimension" },
                { key: "value", label: "Failed orders", kind: "measure" },
              ],
              rows: [{ metric: "Failed orders", value: 47 }],
              measures: ["value"],
            },
          },
          {
            id: "opportunity-pool",
            title: "Conversion opportunity",
            defaultViz: "table",
            span: "half",
            footnote: SALES_OPPORTUNITY_FOOTNOTE,
            data: {
              columns: [
                { key: "segment", label: "Segment", kind: "dimension" },
                { key: "count", label: "Count", kind: "measure" },
              ],
              rows: [{ segment: "Paid enrollments", count: 12 }],
              dimensions: ["segment"],
              measures: ["count"],
            },
          },
        ],
      },
    });

    expect(parsed.data.widgets[0]?.footnote).toBe(SALES_INVERT_FOOTNOTE);
    expect(parsed.data.widgets[1]?.footnote).toBe(SALES_OPPORTUNITY_FOOTNOTE);
  });
});
