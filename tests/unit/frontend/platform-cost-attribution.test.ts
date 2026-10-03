import { describe, expect, it } from "vitest";
// React and the server renderer are imported from the web app's own install, the
// same copy the component resolves, so there is exactly one React instance.
import { createElement } from "../../../frontend/apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../frontend/apps/web/node_modules/react-dom/server.node.js";
import {
  CostReport,
  RateCardSection,
  type CostRateCardView,
  type CostReportView,
} from "../../../frontend/apps/web/src/features/platform/components/PlatformCostAttribution";

/**
 * P9, the platform cost screen (DoD item 8). Rendered to static markup rather
 * than in a browser: the authenticated platform journey needs a seeded operator
 * account, and these assertions are about what the numbers render as, which is
 * where a pricing screen can mislead -- an unpriced driver shown as $0, a
 * per-member cost rounded to the cent, an operator without manage rights
 * offered an edit button.
 */

const usage = {
  activeMembers: 0,
  memberDays: 0,
  apiRequests: 0,
  apiServerMs: 0,
  storageGb: 0,
  emailsSent: 0,
  customDomains: 0,
};

function report(overrides: Partial<CostReportView> = {}): CostReportView {
  return {
    month: "2026-08",
    isPartialMonth: false,
    snapshotAt: "2026-09-01T00:00:00.000Z",
    tenants: [
      {
        tenantId: "018f0000-0000-7000-8000-000000000001",
        slug: "northwind",
        displayName: "Northwind Academy",
        state: "ACTIVE",
        usage: {
          ...usage,
          activeMembers: 1200,
          apiRequests: 480_000,
          storageGb: 38.5,
          emailsSent: 9100,
        },
        variableCostUsd: 5.2,
        fixedCostUsd: 30.4,
        totalCostUsd: 35.6,
        costPerActiveMemberUsd: 0.0297,
        shareOfTotal: 0.72,
      },
      {
        tenantId: "018f0000-0000-7000-8000-000000000002",
        slug: "quiet-school",
        displayName: "Quiet School",
        state: "SUSPENDED",
        usage,
        variableCostUsd: 0,
        fixedCostUsd: 13.6,
        totalCostUsd: 13.6,
        costPerActiveMemberUsd: null,
        shareOfTotal: 0.28,
      },
    ],
    drivers: [
      {
        key: "email_sent",
        label: "Emails",
        unit: "email",
        rate: null,
        totalQuantity: 9100,
        totalCostUsd: null,
      },
    ],
    fixedCosts: [
      {
        id: "018f0000-0000-7000-8000-000000000010",
        label: "App server",
        monthlyCostUsd: 24,
        allocationKey: "api_requests",
        fellBackToEqualSplit: false,
        allocated: true,
      },
    ],
    totals: {
      variableCostUsd: 5.2,
      fixedCostUsd: 44,
      unallocatedFixedCostUsd: 0,
      totalCostUsd: 49.2,
      activeMembers: 1200,
      costPerActiveMemberUsd: 0.041,
    },
    unpricedDrivers: ["email_sent"],
    notMetered: [
      { key: "video_delivery", label: "Video storage and delivery", why: "Not recorded." },
    ],
    ...overrides,
  };
}

const rateCard: CostRateCardView = {
  drivers: [
    {
      key: "storage_gb_month",
      label: "File storage",
      unit: "GB-month",
      current: { unitCostUsd: 0.015, effectiveFrom: "2026-08" },
      suggestion: { unitCostUsd: 0.015, source: "Cloudflare R2 standard storage." },
    },
    {
      key: "email_sent",
      label: "Emails",
      unit: "email",
      current: null,
      suggestion: { unitCostUsd: 0.0001, source: "Amazon SES, $0.10 per 1,000 emails." },
    },
  ],
  allocationKeys: [{ key: "api_requests", label: "API requests" }],
  rateHistory: [],
  fixedCosts: [
    {
      id: "018f0000-0000-7000-8000-000000000010",
      label: "App server",
      monthlyCostUsd: 24,
      allocationKey: "api_requests",
      effectiveFrom: "2026-08",
      effectiveUntil: null,
      reason: "Lightsail Mumbai 4 GB",
    },
  ],
};

function renderReport(view: CostReportView): string {
  return renderToStaticMarkup(createElement(CostReport, { report: view }));
}

function renderRates(canManage: boolean): string {
  return renderToStaticMarkup(
    createElement(RateCardSection, {
      rateCard,
      canManage,
      reason: "Reviewing platform costs",
      onChanged: async () => {
        await Promise.resolve();
      },
    }),
  );
}

describe("cost report", () => {
  it("names an unpriced driver instead of letting it read as free", () => {
    const html = renderReport(report());
    expect(html).toContain("No rate set for Emails");
  });

  it("keeps per-member costs to four decimals instead of rounding to the cent", () => {
    // The figure a per-learner price is set from: $0.041 shown as $0.04 would
    // understate it by 2.5%.
    const html = renderReport(report());
    expect(html).toContain("$0.0297");
    expect(html).toContain("$0.041");
    expect(html).not.toMatch(/>\$0\.04</);
  });

  it("shows an undefined per-member cost as a dash, not zero", () => {
    const html = renderReport(report());
    expect(html).toMatch(/Quiet School[\s\S]*?—/);
  });

  it("marks a non-active tenant and keeps both rows", () => {
    const html = renderReport(report());
    expect(html).toContain("Northwind Academy");
    expect(html).toContain("quiet-school · suspended");
  });

  it("tells the reader a running month is incomplete", () => {
    expect(renderReport(report({ isPartialMonth: true }))).toContain("is still running");
    expect(renderReport(report())).not.toContain("is still running");
  });

  it("flags a fixed cost that had to fall back to an equal split", () => {
    const html = renderReport(
      report({
        fixedCosts: [
          {
            id: "018f0000-0000-7000-8000-000000000010",
            label: "App server",
            monthlyCostUsd: 24,
            allocationKey: "api_requests",
            fellBackToEqualSplit: true,
            allocated: true,
          },
        ],
      }),
    );
    expect(html).toContain("App server split equally");
  });

  it("lists what the totals leave out", () => {
    expect(renderReport(report())).toContain("Not included in these totals");
  });

  it("gives the table a caption for screen readers", () => {
    expect(renderReport(report())).toContain("<caption");
  });

  it("uses only semantic colour tokens", () => {
    // The frontend rules forbid palette utilities and raw colours; the screen
    // must follow light and dark mode from the theme tokens alone.
    const html = renderReport(report()) + renderRates(true);
    expect(html).not.toMatch(
      /\b(bg|text|border)-(white|black|neutral|gray|slate|zinc|red|amber|green|blue)(-\d+)?\b/,
    );
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});

describe("rate card", () => {
  it("offers editing only to an operator who can manage costs", () => {
    expect(renderRates(true)).toContain("Change rate");
    expect(renderRates(true)).toContain("Add fixed cost");
    expect(renderRates(false)).not.toContain("Change rate");
    expect(renderRates(false)).not.toContain("Set rate");
    expect(renderRates(false)).not.toContain("Add fixed cost");
    expect(renderRates(false)).not.toContain("End this cost");
  });

  it("shows a missing rate as not set", () => {
    expect(renderRates(false)).toContain("Not set");
  });
});
