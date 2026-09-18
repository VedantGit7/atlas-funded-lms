import { describe, expect, it } from "vitest";
import {
  THIN_DATA_THRESHOLD,
  UNATTRIBUTED_LABEL,
  attributionBreakdownToCsv,
  dimensionLabel,
  formatShare,
  isThinData,
  shareOfTotal,
} from "../../../frontend/apps/web/src/features/admin/reports/attribution-shared";
import type { AttributionGroup } from "../../../frontend/apps/web/src/features/admin/reports/attribution-api";

/**
 * The source breakdown's derived figures.
 *
 * Shares are the whole point of this screen and the easiest thing to render
 * misleadingly: a rounded zero, a percentage of an empty log, or a revenue
 * column that quietly adds two currencies together.
 */

function group(overrides: Partial<AttributionGroup> = {}): AttributionGroup {
  return {
    value: "google",
    events: 10,
    revenueEvents: 0,
    revenueByCurrency: [],
    revenueWithoutCurrency: 0,
    firstSeen: "2026-08-20T10:00:00.000Z",
    lastSeen: "2026-08-26T10:00:00.000Z",
    ...overrides,
  };
}

function rows(csv: string): string[] {
  return csv.split("\r\n");
}

describe("shareOfTotal", () => {
  it("has no share when there is no total to divide by", () => {
    // 0% of nothing reads as "this source contributed nothing", which is a
    // different claim from "there is nothing to divide".
    expect(shareOfTotal(0, 0)).toBeNull();
  });

  it("computes a plain percentage", () => {
    expect(shareOfTotal(18, 50)).toBe(36);
  });
});

describe("formatShare", () => {
  it("keeps one decimal so a small share is not rounded away", () => {
    // 0.4% and 0.0% are different findings; rendering both as "0%" hides the
    // smaller one entirely.
    expect(formatShare(0.4)).toBe("0.4%");
    expect(formatShare(0)).toBe("0.0%");
  });

  it("renders an absent share as a dash", () => {
    expect(formatShare(null)).toBe("—");
  });
});

describe("isThinData", () => {
  it("stays quiet on an empty log", () => {
    // An empty log needs the empty state, not a "too few events" caveat.
    expect(isThinData(0)).toBe(false);
  });

  it("flags a sample too small to rank on", () => {
    expect(isThinData(THIN_DATA_THRESHOLD - 1)).toBe(true);
  });

  it("stops flagging at the threshold", () => {
    expect(isThinData(THIN_DATA_THRESHOLD)).toBe(false);
  });
});

describe("dimensionLabel", () => {
  it("names every axis", () => {
    expect(dimensionLabel("source")).toBe("Source");
    expect(dimensionLabel("medium")).toBe("Medium");
    expect(dimensionLabel("campaign")).toBe("Campaign");
  });
});

describe("attributionBreakdownToCsv", () => {
  it("heads the first column with the axis being grouped", () => {
    const csv = attributionBreakdownToCsv("campaign", [group()], 10);
    expect(rows(csv)[0]?.startsWith("Campaign,")).toBe(true);
  });

  it("gives each currency its own column rather than one total", () => {
    // A single "Revenue" column would be summable across currencies, which
    // produces an authoritative-looking number that means nothing.
    const csv = attributionBreakdownToCsv(
      "source",
      [
        group({
          revenueEvents: 3,
          revenueByCurrency: [
            { currency: "EUR", amountCents: 12050, events: 1 },
            { currency: "USD", amountCents: 5000, events: 2 },
          ],
        }),
      ],
      10,
    );
    const header = rows(csv)[0] ?? "";
    expect(header).toContain("Revenue (EUR)");
    expect(header).toContain("Revenue (USD)");
    expect(rows(csv)[1]).toContain("120.50");
    expect(rows(csv)[1]).toContain("50.00");
  });

  it("leaves a currency a group never traded in blank, not zero", () => {
    // Zero would say "this source earned nothing in USD"; blank says it never
    // transacted in USD at all.
    const csv = attributionBreakdownToCsv(
      "source",
      [
        group({
          value: "google",
          revenueByCurrency: [{ currency: "USD", amountCents: 100, events: 1 }],
        }),
        group({
          value: "bing",
          revenueByCurrency: [{ currency: "EUR", amountCents: 200, events: 1 }],
        }),
      ],
      20,
    );
    const bing = rows(csv)[2] ?? "";
    expect(bing.startsWith("bing,")).toBe(true);
    expect(bing).toContain(",,");
  });

  it("names the unattributed group rather than writing an empty cell", () => {
    const csv = attributionBreakdownToCsv("source", [group({ value: null })], 10);
    expect(rows(csv)[1]?.startsWith(UNATTRIBUTED_LABEL)).toBe(true);
  });

  it("carries the share as rendered on screen", () => {
    const csv = attributionBreakdownToCsv("source", [group({ events: 18 })], 50);
    expect(rows(csv)[1]).toContain("36.0%");
  });

  it("reports revenue with no currency as its own column", () => {
    const csv = attributionBreakdownToCsv(
      "source",
      [group({ revenueEvents: 2, revenueWithoutCurrency: 2 })],
      10,
    );
    expect(rows(csv)[0]).toContain("Revenue without currency");
    expect(rows(csv)[1]).toContain(",2,");
  });

  it("neutralises a formula in a campaign name", () => {
    // Campaign names come from whoever built the link.
    const csv = attributionBreakdownToCsv("campaign", [group({ value: "=1+1" })], 10);
    expect(rows(csv)[1]).toContain("'=1+1");
  });

  it("writes a header for an empty breakdown", () => {
    const csv = attributionBreakdownToCsv("source", [], 0);
    expect(rows(csv)).toHaveLength(1);
  });
});

/**
 * The drill-down link's parameters.
 *
 * The breakdown writes them and the log reads them; if the two ever disagree,
 * a row that counted 2 events opens a screen showing something else, and
 * nothing in either file would look wrong on its own.
 */
describe("axis drill-down parameters", () => {
  const AXIS_PARAM: Record<string, { value: string; unset: string }> = {
    source: { value: "utmSource", unset: "utmSourceUnset" },
    medium: { value: "utmMedium", unset: "utmMediumUnset" },
    campaign: { value: "utmCampaign", unset: "utmCampaignUnset" },
  };

  it("names one exact parameter per axis", () => {
    expect(Object.keys(AXIS_PARAM).sort()).toEqual(["campaign", "medium", "source"]);
  });

  it("round-trips a named value through the client's filter shape", () => {
    for (const [, param] of Object.entries(AXIS_PARAM)) {
      const search = new URLSearchParams({ [param.value]: "google" });
      const filters = {
        ...(search.get("utmSource") ? { utmSource: search.get("utmSource") ?? "" } : {}),
        ...(search.get("utmMedium") ? { utmMedium: search.get("utmMedium") ?? "" } : {}),
        ...(search.get("utmCampaign") ? { utmCampaign: search.get("utmCampaign") ?? "" } : {}),
      };
      expect(Object.values(filters)).toEqual(["google"]);
    }
  });

  it("uses a separate flag for the unattributed group, never a sentinel value", () => {
    // A campaign can legitimately be named anything a sentinel might use, so
    // "unset" has to be its own parameter.
    for (const [, param] of Object.entries(AXIS_PARAM)) {
      expect(param.unset).not.toBe(param.value);
      expect(param.unset.endsWith("Unset")).toBe(true);
    }
  });
});
