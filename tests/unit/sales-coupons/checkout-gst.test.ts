import { describe, expect, it } from "vitest";

function computeTaxCents(args: {
  amountCents: number;
  gstEnabled: boolean;
  gstPercentage: number | null;
}): number {
  if (!args.gstEnabled || args.gstPercentage == null || args.gstPercentage <= 0) {
    return 0;
  }
  return Math.max(0, Math.round((args.amountCents * args.gstPercentage) / 100));
}

describe("checkout GST tax math", () => {
  it("returns 0 when GST is disabled", () => {
    expect(computeTaxCents({ amountCents: 10000, gstEnabled: false, gstPercentage: 18 })).toBe(0);
  });

  it("applies GST percentage to the discounted amount", () => {
    expect(computeTaxCents({ amountCents: 10000, gstEnabled: true, gstPercentage: 18 })).toBe(1800);
  });

  it("rounds fractional cents", () => {
    expect(computeTaxCents({ amountCents: 333, gstEnabled: true, gstPercentage: 18 })).toBe(60);
  });
});
