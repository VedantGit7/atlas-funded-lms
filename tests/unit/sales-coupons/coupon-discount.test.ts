import { describe, expect, it } from "vitest";

function computeDiscountCents(args: {
  originalAmountCents: number;
  discountType: string;
  discountValue: number;
  maxDiscountCents: number | null;
}): number {
  let discount =
    args.discountType === "PERCENT"
      ? Math.floor((args.originalAmountCents * args.discountValue) / 100)
      : args.discountValue;

  if (args.maxDiscountCents != null) {
    discount = Math.min(discount, args.maxDiscountCents);
  }
  discount = Math.max(0, Math.min(discount, args.originalAmountCents));
  return discount;
}

describe("coupon discount math", () => {
  it("applies percentage with max cap", () => {
    expect(
      computeDiscountCents({
        originalAmountCents: 10000,
        discountType: "PERCENT",
        discountValue: 30,
        maxDiscountCents: 1500,
      }),
    ).toBe(1500);
  });

  it("applies fixed amount without exceeding price", () => {
    expect(
      computeDiscountCents({
        originalAmountCents: 500,
        discountType: "FIXED",
        discountValue: 800,
        maxDiscountCents: null,
      }),
    ).toBe(500);
  });

  it("applies plain percentage", () => {
    expect(
      computeDiscountCents({
        originalAmountCents: 10000,
        discountType: "PERCENT",
        discountValue: 20,
        maxDiscountCents: null,
      }),
    ).toBe(2000);
  });
});
