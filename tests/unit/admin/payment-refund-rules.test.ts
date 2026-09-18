import { describe, expect, it } from "vitest";
import {
  isRefundAmountValid,
  isRefundNoteValid,
  isRefundable,
  parseRefundAmountCents,
  REFUND_NOTE_MAX,
  revokeAccessBlockedReason,
  type RefundableTransaction,
} from "../../../frontend/apps/web/src/features/admin/reports/payment-refund-rules";

/**
 * The rules both refund surfaces obey.
 *
 * Each mirrors a condition the refund endpoint enforces, so the value of these
 * tests is that a form cannot quietly start accepting something the server
 * rejects — or, worse, look like it accepted something the server skipped.
 */

const PAYMENT: RefundableTransaction = {
  membershipId: "8f2a41c9-0000-4000-8000-000000000001",
  refundableAmountCents: 1249900,
  canRefund: true,
  product: { courseId: "aa11bb22-0000-4000-8000-000000000002" },
};

describe("parsing a typed refund amount", () => {
  it("converts major units to minor units", () => {
    expect(parseRefundAmountCents("124.99")).toBe(12499);
    expect(parseRefundAmountCents("1,249.00")).toBe(124900);
    expect(parseRefundAmountCents(" 10 ")).toBe(1000);
  });

  it("does not lose a minor unit to binary floating point", () => {
    // `124.99 * 100` is 12498.999… — rounding the raw product is the bug.
    expect(parseRefundAmountCents("124.99")).not.toBe(12498);
    expect(parseRefundAmountCents("1.005")).toBe(100);
    expect(parseRefundAmountCents("8.29")).toBe(829);
  });

  it("returns NaN for anything unparseable rather than zero", () => {
    // Zero would read as a valid free refund; NaN fails the validity check.
    expect(parseRefundAmountCents("abc")).toBeNaN();
    expect(parseRefundAmountCents("")).toBeNaN();
  });
});

describe("refund amount validity", () => {
  it("accepts an amount up to and including the refundable balance", () => {
    expect(isRefundAmountValid(1249900, 1249900)).toBe(true);
    expect(isRefundAmountValid(1, 1249900)).toBe(true);
  });

  it("rejects more than the balance, which the endpoint would refuse", () => {
    expect(isRefundAmountValid(1249901, 1249900)).toBe(false);
  });

  it("rejects zero, negative and unparseable amounts", () => {
    expect(isRefundAmountValid(0, 1249900)).toBe(false);
    expect(isRefundAmountValid(-500, 1249900)).toBe(false);
    expect(isRefundAmountValid(Number.NaN, 1249900)).toBe(false);
  });
});

describe("whether a payment can be refunded at all", () => {
  it("needs both the flag and a remaining balance", () => {
    expect(isRefundable(PAYMENT)).toBe(true);
    expect(isRefundable({ ...PAYMENT, canRefund: false })).toBe(false);
    expect(isRefundable({ ...PAYMENT, refundableAmountCents: 0 })).toBe(false);
  });
});

describe("revoking course access", () => {
  it("is available when the payment has both a course and a learner", () => {
    expect(revokeAccessBlockedReason(PAYMENT)).toBeNull();
  });

  it("is blocked without a course", () => {
    expect(revokeAccessBlockedReason({ ...PAYMENT, product: { courseId: null } })).toMatch(
      /course/i,
    );
  });

  it("is blocked without a learner, which the old gate missed", () => {
    // The service checks membership *and* course; gating on the course alone
    // let an operator tick the box and believe access had been pulled.
    expect(revokeAccessBlockedReason({ ...PAYMENT, membershipId: null })).toMatch(/learner/i);
  });
});

describe("the refund note", () => {
  it("is required, because the endpoint requires it", () => {
    expect(isRefundNoteValid("")).toBe(false);
    expect(isRefundNoteValid("   ")).toBe(false);
    expect(isRefundNoteValid("Duplicate charge from the 24th")).toBe(true);
  });

  it("respects the server's length ceiling", () => {
    expect(isRefundNoteValid("x".repeat(REFUND_NOTE_MAX))).toBe(true);
    expect(isRefundNoteValid("x".repeat(REFUND_NOTE_MAX + 1))).toBe(false);
  });
});
