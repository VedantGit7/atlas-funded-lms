import { describe, expect, it } from "vitest";
import {
  manualEntryNote,
  orderChecks,
} from "../../../frontend/apps/web/src/features/admin/reports/payment-orders-shared";

/**
 * The order detail screen's consistency checks.
 *
 * Each is derived from the row itself, which is the whole point: a check that
 * cannot be evaluated from stored data is not shown at all. These tests pin the
 * derivations, because a check that silently always passes is worse than no
 * check — it is a reassurance nobody earned.
 */

const SOUND = {
  externalId: "pi_3MtwBwLkdIwMgDz1",
  amountCents: 1249900,
  status: "paid",
  paidAt: "2026-07-22T14:38:46.000Z",
  createdAt: "2026-07-22T14:38:00.000Z",
};

function statusOf(order: Parameters<typeof orderChecks>[0], key: string) {
  return orderChecks(order).find((check) => check.key === key)?.status;
}

describe("order consistency checks", () => {
  it("passes every check for a soundly settled order", () => {
    expect(orderChecks(SOUND).every((check) => check.status === "pass")).toBe(true);
  });

  it("fails when there is no external id for a webhook to match", () => {
    expect(statusOf({ ...SOUND, externalId: null }, "external-id")).toBe("fail");
    // Whitespace matches nothing, exactly like null.
    expect(statusOf({ ...SOUND, externalId: "   " }, "external-id")).toBe("fail");
  });

  it("fails when an order is marked paid with no settlement time", () => {
    expect(statusOf({ ...SOUND, paidAt: null }, "status-paid-at")).toBe("fail");
  });

  it("does not demand a settlement time from an unpaid order", () => {
    // A pending order has nothing to settle, so this must not read as a fault.
    expect(statusOf({ ...SOUND, status: "pending", paidAt: null }, "status-paid-at")).toBe("pass");
  });

  it("fails a fractional or negative minor-unit amount", () => {
    expect(statusOf({ ...SOUND, amountCents: 124.5 }, "amount")).toBe("fail");
    expect(statusOf({ ...SOUND, amountCents: -100 }, "amount")).toBe("fail");
  });

  it("accepts a zero amount, which is a legitimate ledger row", () => {
    expect(statusOf({ ...SOUND, amountCents: 0 }, "amount")).toBe("pass");
  });

  it("fails when settlement precedes creation", () => {
    expect(
      statusOf(
        { ...SOUND, paidAt: "2026-07-22T14:00:00.000Z", createdAt: "2026-07-22T14:38:00.000Z" },
        "timestamps",
      ),
    ).toBe("fail");
  });

  it("passes the sequence check when there is no settlement time to compare", () => {
    expect(statusOf({ ...SOUND, status: "pending", paidAt: null }, "timestamps")).toBe("pass");
  });

  it("explains only the checks that failed", () => {
    const failed = orderChecks({ ...SOUND, externalId: null }).filter(
      (check) => check.status === "fail",
    );
    expect(failed).toHaveLength(1);
    expect(failed[0]?.detail).toMatch(/external ID/i);
  });
});

describe("manual entry detection", () => {
  it("reads the reason a person gave when recording the order", () => {
    expect(manualEntryNote({ manualEntryNote: "Bank transfer confirmed" })).toBe(
      "Bank transfer confirmed",
    );
  });

  it("returns null when the order carries no metadata", () => {
    // Without this signal the screen must not claim a webhook settled anything.
    expect(manualEntryNote(null)).toBeNull();
  });

  it("ignores metadata that holds no note, or a blank one", () => {
    expect(manualEntryNote({ gatewayRef: "abc" })).toBeNull();
    expect(manualEntryNote({ manualEntryNote: "   " })).toBeNull();
    expect(manualEntryNote({ manualEntryNote: 42 })).toBeNull();
  });
});
