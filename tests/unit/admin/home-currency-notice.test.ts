import { describe, expect, it } from "vitest";
import {
  HOME_CURRENCY_EXAMPLE_CENTS,
  conversionExample,
  convertExample,
} from "../../../frontend/apps/web/src/features/admin/learner-billing/home-currency-shared";

/**
 * The worked example in the change-currency confirmation.
 *
 * The dialog used to assert that "the amount stays the same — an amount of 100
 * keeps its value, only the symbol changes". `CoursePrice` renders through
 * `Money`, which calls `useCurrency().format` and converts at live rates, so
 * that was the opposite of what a learner sees. The example now shown has to
 * match `convertWith` in CurrencyProvider.tsx exactly, or the dialog is simply
 * wrong in a different way.
 */

// USD-based, as the stored table always is: 1 USD buys 83 INR, 0.92 EUR.
const RATES = { USD: 1, INR: 83, EUR: 0.92 };

describe("convertExample mirrors CurrencyProvider.convertWith", () => {
  it("converts through the shared USD base", () => {
    // 100 INR -> (100 * 0.92) / 83 EUR.
    expect(convertExample(RATES, 100, "INR", "EUR")).toBeCloseTo((100 * 0.92) / 83, 10);
  });

  it("is the identity when the currencies match", () => {
    expect(convertExample(RATES, 100, "USD", "USD")).toBe(100);
  });

  it("ignores case, as the provider does", () => {
    expect(convertExample(RATES, 100, "inr", "eur")).toBeCloseTo((100 * 0.92) / 83, 10);
  });

  it("returns nothing when the source rate is missing", () => {
    expect(convertExample(RATES, 100, "XYZ", "EUR")).toBeNull();
  });

  it("returns nothing when the target rate is missing", () => {
    expect(convertExample(RATES, 100, "INR", "XYZ")).toBeNull();
  });

  it("does not divide by a zero source rate", () => {
    expect(convertExample({ ...RATES, INR: 0 }, 100, "INR", "EUR")).toBeNull();
  });
});

describe("conversionExample", () => {
  it("shows a real before and after", () => {
    const example = conversionExample({ rates: RATES, from: "USD", to: "INR" });

    // The point of the example: 100 does not stay 100.
    expect(example).not.toBeNull();
    expect(example?.before).toContain("100");
    expect(example?.after).not.toBe(example?.before);
  });

  it("uses the representative amount by default", () => {
    const example = conversionExample({ rates: RATES, from: "USD", to: "USD" });
    // Same currency needs no warning about conversion at all.
    expect(example).toBeNull();
    expect(HOME_CURRENCY_EXAMPLE_CENTS).toBe(10_000);
  });

  it("omits itself rather than inventing a figure when a rate is missing", () => {
    // Better no example than one derived from a rate that is not there.
    expect(conversionExample({ rates: RATES, from: "USD", to: "XYZ" })).toBeNull();
    expect(conversionExample({ rates: {}, from: "USD", to: "INR" })).toBeNull();
  });

  it("honours an explicit amount", () => {
    const example = conversionExample({
      rates: RATES,
      from: "USD",
      to: "INR",
      amountCents: 100,
    });

    expect(example?.before).toContain("1");
  });

  it("survives an unknown currency code without throwing", () => {
    // Intl rejects a 2-letter code; the example must degrade, not crash the
    // dialog that is warning about the change.
    const example = conversionExample({
      rates: { ...RATES, XY: 2 },
      from: "USD",
      to: "XY",
    });

    expect(example?.after).toContain("XY");
  });
});
