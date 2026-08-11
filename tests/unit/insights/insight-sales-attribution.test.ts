import { describe, expect, it } from "vitest";
import {
  buildInsightSalesAttribution,
  salesAttributionToCsv,
  salesRevenuePerEvent,
  salesSourceLabel,
  SALES_ATTRIBUTION_CAVEAT,
  SALES_ATTRIBUTION_EMPTY_CAPTION,
} from "../../../backend/apps/api/src/server/insights/insights-sales-attribution";
import { insightSalesAttributionResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

const snapshot = {
  currency: "INR",
  revenueCents: 418620000,
  attributionTotal: 84120,
  attributionRevenueCents: 241890000,
};

describe("sales attribution helpers", () => {
  it("labels source and medium as a slug and uses a hyphen when the rate has no events", () => {
    expect(salesSourceLabel("google", "organic")).toBe("google / organic");
    expect(salesSourceLabel("direct", "none")).toBe("direct");
    expect(salesRevenuePerEvent(2418900, 0)).toBeNull();
    expect(salesRevenuePerEvent(84.2 * 7150, 7150)).toBe(84.2);
  });
});

describe("buildInsightSalesAttribution", () => {
  it("compares sources by attributed revenue and does not invent ROAS or period deltas", () => {
    const board = buildInsightSalesAttribution(
      snapshot,
      [
        { source: "google", medium: "organic", count: 42500, revenueCents: 78625000 },
        { source: "instagram", medium: "paid", count: 7150, revenueCents: 60203000 },
        { source: "referral", medium: "partner-rd", count: 5800, revenueCents: 36047000 },
        { source: "direct", medium: "none", count: 4100, revenueCents: 18450000 },
        { source: "email", medium: "newsletter", count: 2000, revenueCents: 2420000 },
      ],
      "2026-08-11T12:00:00.000Z",
    );

    expect(board.title).toBe("Attribution");
    expect(board.currency).toBe("INR");
    expect(board.attributedRevenue).toBe(1957450);
    expect(board.unattributedRevenue).toBe(2228750);
    expect(board.events).toBe(61550);
    expect(board.sourceCount).toBe(5);
    expect(board.sources[0]?.label).toBe("google / organic");
    expect(board.sources[0]?.pattern).toBe("high-volume low-value");
    expect(board.sources[1]?.pattern).toBe("low-volume high-value");
    expect(board.caveat).toBe(SALES_ATTRIBUTION_CAVEAT);
    expect(board.caveat).not.toContain("—");
    expect(board.reportHref).toBe("/admin/reports/sales-marketing");
    expect(JSON.stringify(board)).not.toContain("ROAS");
    expect(insightSalesAttributionResponseSchema.parse({ data: board }).data.sources).toHaveLength(
      5,
    );
  });

  it("renders an empty board with hyphen rates and no invented tracking model", () => {
    const board = buildInsightSalesAttribution(
      { currency: "INR", revenueCents: 0, attributionTotal: 0, attributionRevenueCents: 0 },
      [],
      "2026-08-11T12:00:00.000Z",
    );

    expect(board.empty).toBe(true);
    expect(board.caption).toBe(SALES_ATTRIBUTION_EMPTY_CAPTION);
    expect(board.revenuePerEvent).toBeNull();
    expect(board.composition).toEqual([]);
    expect(JSON.stringify(board)).not.toContain("—");
    expect(JSON.stringify(board)).not.toContain("Multi-Touch");
  });

  it("exports a source CSV without an em dash", () => {
    const board = buildInsightSalesAttribution(
      snapshot,
      [{ source: "google", medium: "organic", count: 100, revenueCents: 185000 }],
      "2026-08-11T12:00:00.000Z",
    );
    const csv = salesAttributionToCsv(board);
    expect(csv).toContain("google / organic,100,1850.00");
    expect(csv).not.toContain("—");
  });
});
