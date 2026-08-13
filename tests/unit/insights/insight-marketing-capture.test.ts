import { describe, expect, it } from "vitest";
import {
  buildInsightMarketingCapture,
  marketingCaptureToCsv,
  MARKETING_CAPTURE_CHAIN_CAPTION,
  MARKETING_CAPTURE_CLICK_RATE_WARN,
  MARKETING_CAPTURE_EMPTY,
  MARKETING_CAPTURE_UNSTABLE_VIEWS,
} from "../../../backend/apps/api/src/server/insights/insights-marketing-capture";
import { insightMarketingCaptureResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

const snapshot = {
  formCount: 9,
  liveFormCount: 4,
  submissionCount: 1284,
  submissions30d: 0,
  contactCount: 3412,
  ctaCount: 14,
  liveCtaCount: 7,
  ctaViews: 42180,
  ctaClicks: 2140,
};

const forms = [
  {
    id: "f1",
    title: "Free strategy call",
    status: "LIVE",
    submissions: 640,
    submissions30d: 0,
    lastSubmissionAt: "2026-07-01T10:00:00.000Z",
    href: "/admin/marketing/forms/f1",
  },
  {
    id: "f2",
    title: "Foundations waitlist",
    status: "DRAFT",
    submissions: 120,
    submissions30d: 0,
    lastSubmissionAt: null,
    href: "/admin/marketing/forms/f2",
  },
];

const ctas = [
  {
    id: "c1",
    title: "Book a call",
    ctaType: "button",
    status: "LIVE",
    views: 30000,
    clicks: 1500,
    href: "/admin/marketing/cta/c1",
  },
  {
    id: "c2",
    title: "Start diagnostic",
    ctaType: "banner",
    status: "LIVE",
    views: 12180,
    clicks: 640,
    href: "/admin/marketing/cta/c2",
  },
  {
    id: "c3",
    title: "New CTA",
    ctaType: "inline",
    status: "LIVE",
    views: 20,
    clicks: 0,
    href: "/admin/marketing/cta/c3",
  },
];

describe("buildInsightMarketingCapture", () => {
  it("builds chain rates and marks the largest absolute drop", () => {
    const board = buildInsightMarketingCapture(snapshot, forms, ctas, "2026-08-12T12:00:00.000Z");

    expect(board.slug).toBe("marketing-insight");
    expect(board.overallClickRatePct).toBe(5.1);
    expect(board.chain.steps).toHaveLength(4);
    expect(board.chain.steps[0]?.connectorRatePct).toBeCloseTo(-94.9, 1);
    expect(board.chain.steps[1]?.connectorRatePct).toBeCloseTo(-40, 1);
    expect(board.chain.steps[2]?.connectorRatePct).toBeCloseTo(165.7, 1);
    expect(board.chain.steps[0]?.connectorIsLargestDrop).toBe(true);
    expect(board.chain.dropCaption).toContain("CTA views to CTA clicks");
    expect(board.chain.caption).toBe(MARKETING_CAPTURE_CHAIN_CAPTION);
    expect(board.chain.caption).not.toContain("—");
  });

  it("renders empty state when no forms or CTAs exist", () => {
    const board = buildInsightMarketingCapture(
      {
        formCount: 0,
        liveFormCount: 0,
        submissionCount: 0,
        submissions30d: 0,
        contactCount: 0,
        ctaCount: 0,
        liveCtaCount: 0,
        ctaViews: 0,
        ctaClicks: 0,
      },
      [],
      [],
      "2026-08-12T12:00:00.000Z",
    );

    expect(board.empty).toBe(true);
    expect(board.emptyCaption).toBe(MARKETING_CAPTURE_EMPTY);
    expect(JSON.stringify(board)).not.toContain("—");
  });

  it("flags zero submission warning when live forms have no 30d submissions", () => {
    const board = buildInsightMarketingCapture(snapshot, forms, ctas);

    expect(board.zeroSubmissionWarning).toBe(true);
    expect(board.warningTitle).toBe("No form submissions (30d)");
    expect(board.warningMessage).toContain("4 live forms");
    expect(board.submissions30dWarning).toBe(true);
    expect(board.forms[0]?.submissions30dWarning).toBe(true);
    expect(board.forms[0]?.warningRail).toBe(true);
    expect(board.forms[1]?.isDraft).toBe(true);
  });

  it("aggregates click rate by CTA type with unstable caption", () => {
    const board = buildInsightMarketingCapture(snapshot, forms, ctas);

    expect(board.clickRateByType.rows.length).toBeGreaterThan(0);
    expect(board.clickRateByType.overallRatePct).toBe(5.1);
    expect(board.clickRateByType.caption).toContain("Best:");
    expect(board.clickRateByType.caption).toContain("unstable");
    expect(board.clickRateWarnThreshold).toBe(MARKETING_CAPTURE_CLICK_RATE_WARN);
    expect(board.unstableViewThreshold).toBe(MARKETING_CAPTURE_UNSTABLE_VIEWS);
    expect(board.ctas[2]?.clickRateWarning).toBe(true);
    expect(board.ctas[2]?.noViews).toBe(false);
  });

  it("parses through the response schema without em dashes", () => {
    const board = buildInsightMarketingCapture(snapshot, forms, ctas);
    const parsed = insightMarketingCaptureResponseSchema.parse({ data: board });
    expect(parsed.data.forms).toHaveLength(2);
    expect(JSON.stringify(parsed)).not.toContain("—");
  });

  it("exports CSV without an em dash", () => {
    const board = buildInsightMarketingCapture(snapshot, forms, ctas);
    const csv = marketingCaptureToCsv(board);
    expect(csv).toContain("Free strategy call");
    expect(csv).toContain("Book a call");
    expect(csv).not.toContain("—");
  });
});
