import { describe, expect, it, vi } from "vitest";
import {
  refundOutcomeTitle,
  refundRequestIdentity,
  refundBalanceLabel,
} from "../../../frontend/apps/web/src/features/admin/reports/refund-submission";

describe("refund submission", () => {
  it("does not classify a partly refunded order with a reserved remainder as fully refunded", () => {
    expect(
      refundBalanceLabel({
        amountCents: 10000,
        refundedAmountCents: 2500,
        reservedRefundAmountCents: 7500,
        refundableAmountCents: 0,
      }),
    ).toBe("Partially refunded");
    expect(
      refundBalanceLabel({
        amountCents: 10000,
        refundedAmountCents: 0,
        reservedRefundAmountCents: 10000,
        refundableAmountCents: 0,
      }),
    ).toBe("Balance reserved");
    expect(
      refundBalanceLabel({
        amountCents: 10000,
        refundedAmountCents: 10000,
        reservedRefundAmountCents: 0,
        refundableAmountCents: 0,
      }),
    ).toBe("Fully refunded");
    expect(
      refundBalanceLabel({
        amountCents: 10000,
        refundedAmountCents: 0,
        reservedRefundAmountCents: 0,
        refundableAmountCents: 0,
      }),
    ).toBe("No available balance");
  });
  it("creates request identities on development origins without randomUUID", () => {
    const original = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: original.getRandomValues.bind(original) });
    try {
      expect(refundRequestIdentity(null, { orderId: "order-1" }).refundRequestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("reuses a request identity for a retry and changes it for edited submissions", () => {
    const first = refundRequestIdentity(null, { orderId: "order-1", amountCents: 2500 });
    expect(refundRequestIdentity(first, { orderId: "order-1", amountCents: 2500 })).toBe(first);
    const edited = refundRequestIdentity(first, { orderId: "order-1", amountCents: 3000 });
    expect(edited.refundRequestId).not.toBe(first.refundRequestId);
    expect(
      refundRequestIdentity(edited, { orderId: "order-2", amountCents: 3000 }).refundRequestId,
    ).not.toBe(edited.refundRequestId);
    expect(
      refundRequestIdentity(null, { orderId: "order-1", amountCents: 2500 }).refundRequestId,
    ).not.toBe(first.refundRequestId);
  });

  it.each(["requested", "processing", "pending"] as const)(
    "does not claim money returned for %s",
    (status) => {
      expect(refundOutcomeTitle(status)).toBe("Refund requested — awaiting gateway confirmation");
    },
  );

  it("distinguishes manual adjustments, failed requests, and confirmed refunds", () => {
    expect(refundOutcomeTitle("manual_adjustment")).toBe(
      "Manual adjustment recorded — no money sent",
    );
    expect(refundOutcomeTitle("succeeded")).toBe("Refund confirmed by the gateway");
    expect(refundOutcomeTitle("reconciliation_required")).toBe(
      "Refund requires reconciliation — confirmation unavailable",
    );
    expect(refundOutcomeTitle("failed")).toBe("Refund failed — no refund confirmed");
    expect(refundOutcomeTitle("legacy_recorded")).toBe(
      "Legacy refund record — gateway confirmation unavailable",
    );
  });
});
