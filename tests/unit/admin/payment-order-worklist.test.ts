import { describe, expect, it } from "vitest";
import {
  ORDER_FAULT_COPY,
  ageInDays,
  formatAge,
  unmatchedOrdersToCsv,
} from "../../../frontend/apps/web/src/features/admin/reports/payment-orders-shared";
import {
  PAYMENT_ORDER_FAULTS,
  type PaymentOrder,
} from "../../../frontend/apps/web/src/features/admin/reports/payment-orders-api";

/**
 * The reconciliation worklist's derived figures.
 *
 * Age is the one an operator compares against a threshold, so an off-by-one
 * here puts a row on the wrong side of "pending longer than 7 days".
 */

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const DAY = 86_400_000;

function order(overrides: Partial<PaymentOrder> = {}): PaymentOrder {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    membershipId: null,
    externalId: null,
    amountCents: 149900,
    currency: "INR",
    status: "pending",
    paidAt: null,
    createdAt: new Date(NOW - 3 * DAY).toISOString(),
    ...overrides,
  };
}

describe("ageInDays", () => {
  it("counts whole elapsed days", () => {
    expect(ageInDays(new Date(NOW - 3 * DAY).toISOString(), NOW)).toBe(3);
  });

  it("floors a partial day rather than rounding it up", () => {
    // 6 days and 23 hours is not yet 7 — the threshold is a boundary an
    // operator relies on, not an approximation.
    expect(ageInDays(new Date(NOW - (7 * DAY - 3_600_000)).toISOString(), NOW)).toBe(6);
  });

  it("reads a future timestamp as zero rather than negative", () => {
    // Clock skew between the app and the database is real; a "-1d" age in a
    // finance worklist reads as corruption.
    expect(ageInDays(new Date(NOW + DAY).toISOString(), NOW)).toBe(0);
  });

  it("survives an unparseable timestamp", () => {
    expect(ageInDays("not-a-date", NOW)).toBe(0);
  });
});

describe("formatAge", () => {
  it("says today rather than 0d", () => {
    expect(formatAge(new Date(NOW - 3_600_000).toISOString(), NOW)).toBe("today");
  });

  it("reports days, not a rounded relative label", () => {
    // "2 months ago" hides which of two rows is older, which is the only
    // question this column exists to answer.
    expect(formatAge(new Date(NOW - 64 * DAY).toISOString(), NOW)).toBe("64d");
  });
});

describe("ORDER_FAULT_COPY", () => {
  it("covers every fault the server can return", () => {
    for (const fault of PAYMENT_ORDER_FAULTS) {
      expect(ORDER_FAULT_COPY[fault]?.title).toBeTruthy();
      expect(ORDER_FAULT_COPY[fault]?.remedy).toBeTruthy();
    }
  });

  it("never promises an action this console cannot perform", () => {
    // There is no endpoint that asks a gateway for a payment's true state, so
    // no remedy may imply a button that does.
    const remedies = Object.values(ORDER_FAULT_COPY)
      .map((copy) => copy.remedy.toLowerCase())
      .join(" ");
    expect(remedies).not.toContain("check status");
    expect(remedies).not.toContain("bulk-cancel");
    expect(remedies).not.toContain("retry the webhook");
  });
});

describe("unmatchedOrdersToCsv", () => {
  function rows(csv: string): string[] {
    return csv.split("\r\n");
  }

  it("labels every row with the fault it came from", () => {
    const csv = unmatchedOrdersToCsv(
      [
        { fault: "missing-external-id", items: [order()] },
        { fault: "stale-pending", items: [order({ externalId: "pay_1" })] },
      ],
      NOW,
    );
    const lines = rows(csv);
    expect(lines[0]?.startsWith("Fault,")).toBe(true);
    expect(lines[1]?.startsWith(ORDER_FAULT_COPY["missing-external-id"].title)).toBe(true);
    expect(lines[2]?.startsWith(ORDER_FAULT_COPY["stale-pending"].title)).toBe(true);
  });

  it("lists an order once per group it belongs to", () => {
    // The same order stuck for two reasons genuinely belongs in both; dropping
    // the duplicate would hide half of why it is stuck.
    const stuck = order();
    const csv = unmatchedOrdersToCsv(
      [
        { fault: "missing-external-id", items: [stuck] },
        { fault: "stale-pending", items: [stuck] },
      ],
      NOW,
    );
    expect(rows(csv)).toHaveLength(3);
  });

  it("writes the age as a bare number a spreadsheet can filter", () => {
    const csv = unmatchedOrdersToCsv([{ fault: "stale-pending", items: [order()] }], NOW);
    expect(rows(csv)[1]?.endsWith(",3")).toBe(true);
  });

  it("neutralises a gateway-supplied formula in the external id", () => {
    const csv = unmatchedOrdersToCsv(
      [{ fault: "stale-pending", items: [order({ externalId: "=1+1" })] }],
      NOW,
    );
    expect(rows(csv)[1]).toContain("'=1+1");
  });

  it("writes a header even when every group is empty", () => {
    const csv = unmatchedOrdersToCsv([{ fault: "stale-pending", items: [] }], NOW);
    expect(rows(csv)).toHaveLength(1);
  });
});
