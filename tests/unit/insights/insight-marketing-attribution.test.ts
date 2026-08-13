import { describe, expect, it } from "vitest";
import {
  buildInsightMarketingAttribution,
  marketingAttributionToCsv,
  MARKETING_ATTRIBUTION_CAVEAT,
  MARKETING_ATTRIBUTION_EMPTY_CAPTION,
} from "../../../backend/apps/api/src/server/insights/insights-marketing-attribution";
import { insightMarketingAttributionResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

const snapshot = {
  currency: "INR",
  events: 84120,
  events30d: 12480,
  attributedRevenueCents: 241890000,
  sourceCount: 18,
  mediumCount: 6,
  campaignCount: 24,
};

describe("buildInsightMarketingAttribution", () => {
  it("builds source medium and campaign dimensions over the same events", () => {
    const board = buildInsightMarketingAttribution(
      snapshot,
      [
        { value: "google", count: 35330, revenueCents: 145020000 },
        { value: "direct", count: 23553, revenueCents: 54010000 },
        { value: "facebook.com", count: 12618, revenueCents: 15646000 },
        { value: "partner-rd", count: 6729, revenueCents: 22140000 },
        { value: "(not set)", count: 5890, revenueCents: 5074000 },
      ],
      [
        { value: "organic", count: 40000, revenueCents: 120000000 },
        { value: "cpc", count: 25000, revenueCents: 80000000 },
        { value: "none", count: 19120, revenueCents: 41890000 },
      ],
      [
        { value: "aug-intake-2026", count: 40000, revenueCents: 40000000 },
        { value: "risk-desk-launch", count: 30000, revenueCents: 50000000 },
        { value: "vip-invite-only", count: 850, revenueCents: 120000000 },
      ],
      [
        { source: "google", medium: "organic", count: 28600 },
        { source: "direct", medium: "none", count: 23553 },
      ],
      "2026-08-12T12:00:00.000Z",
    );

    expect(board.slug).toBe("marketing-insight");
    expect(board.events).toBe(84120);
    expect(board.events30d).toBe(12480);
    expect(board.attributedRevenue).toBe(2418900);
    expect(board.dimensions.source.rows[0]?.value).toBe("google");
    expect(board.dimensions.campaign.rows[2]?.pattern).toBe("low-volume high-value");
    expect(board.crossCaption).toContain("google / organic");
    expect(board.caveat).toBe(MARKETING_ATTRIBUTION_CAVEAT);
    expect(board.caveat).not.toContain("—");
    expect(JSON.stringify(board)).not.toContain("ROAS");
    expect(
      insightMarketingAttributionResponseSchema.parse({ data: board }).data.dimensions.source.rows,
    ).toHaveLength(5);
  });

  it("renders empty state without inventing multi-touch copy", () => {
    const board = buildInsightMarketingAttribution(
      {
        currency: "INR",
        events: 0,
        events30d: 0,
        attributedRevenueCents: 0,
        sourceCount: 0,
        mediumCount: 0,
        campaignCount: 0,
      },
      [],
      [],
      [],
      [],
      "2026-08-12T12:00:00.000Z",
    );
    expect(board.empty).toBe(true);
    expect(board.caption).toBe(MARKETING_ATTRIBUTION_EMPTY_CAPTION);
    expect(JSON.stringify(board)).not.toContain("Multi-Touch");
    expect(JSON.stringify(board)).not.toContain("—");
  });

  it("exports dimension CSV without an em dash", () => {
    const board = buildInsightMarketingAttribution(
      snapshot,
      [{ value: "google", count: 100, revenueCents: 185000 }],
      [{ value: "organic", count: 100, revenueCents: 185000 }],
      [{ value: "aug-intake-2026", count: 100, revenueCents: 185000 }],
      [{ source: "google", medium: "organic", count: 100 }],
    );
    const csv = marketingAttributionToCsv(board, "campaign");
    expect(csv).toContain("aug-intake-2026");
    expect(csv).not.toContain("—");
  });
});
