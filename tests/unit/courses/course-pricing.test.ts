import { describe, expect, it } from "vitest";
import { readCoursePricing } from "../../../backend/apps/api/src/server/courses/courses.repository";

describe("readCoursePricing", () => {
  it("defaults to FREE when metadata is missing or has no tier", () => {
    expect(readCoursePricing(null)).toEqual({
      accessTier: "FREE",
      priceCents: null,
      currency: null,
    });
    expect(readCoursePricing({})).toEqual({
      accessTier: "FREE",
      priceCents: null,
      currency: null,
    });
  });

  it("reads PAID tier with normalized price and currency", () => {
    expect(readCoursePricing({ accessTier: "PAID", priceCents: 4999, currency: "usd" })).toEqual({
      accessTier: "PAID",
      priceCents: 4999,
      currency: "USD",
    });
  });

  it("ignores invalid price and currency values", () => {
    expect(readCoursePricing({ accessTier: "PAID", priceCents: -10, currency: "US" })).toEqual({
      accessTier: "PAID",
      priceCents: null,
      currency: null,
    });

    expect(readCoursePricing({ accessTier: "PAID", priceCents: "free", currency: 123 })).toEqual({
      accessTier: "PAID",
      priceCents: null,
      currency: null,
    });
  });

  it("floors fractional price values", () => {
    expect(readCoursePricing({ accessTier: "PAID", priceCents: 1999.9 }).priceCents).toBe(1999);
  });

  it("treats any non-PAID tier as FREE", () => {
    expect(readCoursePricing({ accessTier: "premium" }).accessTier).toBe("FREE");
  });
});
