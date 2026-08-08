import { describe, expect, it } from "vitest";

function clampWalletSpend(args: {
  requested: number;
  balance: number;
  maxPerOrder: number | null;
  remainingCents: number;
  creditValueCents: number;
}) {
  const maxByOrder =
    args.maxPerOrder != null ? Math.min(args.requested, args.maxPerOrder) : args.requested;
  const maxByBalance = Math.min(maxByOrder, args.balance);
  const maxByMoney = Math.floor(args.remainingCents / args.creditValueCents);
  return Math.max(0, Math.min(maxByBalance, maxByMoney));
}

describe("wallet spend clamp", () => {
  it("respects balance, order cap, and remaining money", () => {
    expect(
      clampWalletSpend({
        requested: 100,
        balance: 80,
        maxPerOrder: 50,
        remainingCents: 4000,
        creditValueCents: 100,
      }),
    ).toBe(40);
  });

  it("returns zero when remaining money is below one credit", () => {
    expect(
      clampWalletSpend({
        requested: 10,
        balance: 10,
        maxPerOrder: null,
        remainingCents: 50,
        creditValueCents: 100,
      }),
    ).toBe(0);
  });
});
