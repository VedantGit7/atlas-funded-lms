import { describe, expect, it } from "vitest";
import {
  FX_STALE_AFTER_MS,
  fxAgeMs,
  formatFxRate,
  isFxStale,
  rateAgainstHome,
  rateSentence,
} from "../../../frontend/apps/web/src/features/admin/learner-billing/fx-rates-shared";

/**
 * The exchange-rate panel's derived figures.
 *
 * The stored table is always USD-based, whatever a tenant sets as home. Getting
 * the second hop wrong does not look wrong — it produces a plausible number
 * that is off by the USD/home rate, which for a weak currency is a factor of
 * eighty.
 */

const NOW = Date.parse("2026-08-27T12:00:00.000Z");
const DAY = 86_400_000;

describe("rateAgainstHome", () => {
  // A USD-based table: 1 USD buys 83 INR, 0.92 EUR.
  const rates = { USD: 1, INR: 83, EUR: 0.92, AED: 3.67 };

  it("divides through the home currency rather than relabelling the base", () => {
    // 1 INR buys 3.67/83 AED. Reading the stored 3.67 as "per rupee" would be
    // wrong by a factor of 83.
    const rate = rateAgainstHome(rates, "AED", "INR");
    expect(rate).toBeCloseTo(3.67 / 83, 10);
  });

  it("is the identity when home is the stored base", () => {
    expect(rateAgainstHome(rates, "EUR", "USD")).toBe(0.92);
  });

  it("returns nothing when the target has no rate", () => {
    // Better an unknown cell than a figure derived from an absent rate.
    expect(rateAgainstHome(rates, "XYZ", "INR")).toBeNull();
  });

  it("returns nothing when the home currency has no rate", () => {
    expect(rateAgainstHome(rates, "EUR", "XYZ")).toBeNull();
  });

  it("does not divide by a zero home rate", () => {
    expect(rateAgainstHome({ ...rates, INR: 0 }, "EUR", "INR")).toBeNull();
  });
});

describe("formatFxRate", () => {
  it("keeps four decimals for ordinary rates", () => {
    expect(formatFxRate(0.0442)).toBe("0.0442");
    expect(formatFxRate(15.9032)).toBe("15.9032");
  });

  it("does not round a very weak unit away to zero", () => {
    // Four decimal places would render this as 0.0000 and read as free.
    expect(formatFxRate(0.00003219)).not.toBe("0");
    expect(Number(formatFxRate(0.00003219))).toBeCloseTo(0.00003219, 8);
  });

  it("drops decimals entirely on a very large rate", () => {
    // 1 unit buying 1.4 million of another needs no fractional part.
    expect(formatFxRate(1_412_345.67)).not.toContain(".");
  });

  it("renders a genuine zero as zero", () => {
    expect(formatFxRate(0)).toBe("0");
  });
});

describe("isFxStale", () => {
  it("is not stale over a long weekend", () => {
    // The provider publishes on business days; a quiet weekend is not a
    // stopped refresh.
    expect(isFxStale(new Date(NOW - 3 * DAY).toISOString(), NOW)).toBe(false);
  });

  it("is stale once past the threshold", () => {
    expect(isFxStale(new Date(NOW - FX_STALE_AFTER_MS).toISOString(), NOW)).toBe(true);
  });

  it("says nothing when no fetch has ever happened", () => {
    // An empty table needs the "refresh to fetch them" empty state, not a
    // staleness warning about rates that do not exist.
    expect(isFxStale(null, NOW)).toBe(false);
  });

  it("says nothing for an unparseable timestamp", () => {
    expect(isFxStale("not-a-date", NOW)).toBe(false);
  });
});

describe("fxAgeMs", () => {
  it("measures elapsed time", () => {
    expect(fxAgeMs(new Date(NOW - 2 * DAY).toISOString(), NOW)).toBe(2 * DAY);
  });

  it("reads a future fetch as zero rather than negative", () => {
    expect(fxAgeMs(new Date(NOW + DAY).toISOString(), NOW)).toBe(0);
  });
});

describe("rateSentence", () => {
  it("states the direction the number is quoted in", () => {
    // "AED 0.0442" alone does not say whether that is per rupee or per dirham.
    expect(rateSentence("INR", "AED", 0.0442)).toBe("1 INR = 0.0442 AED");
  });
});
