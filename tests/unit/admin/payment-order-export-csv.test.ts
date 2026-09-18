import { describe, expect, it } from "vitest";
import {
  ALL_ORDER_EXPORT_COLUMN_KEYS,
  ORDER_EXPORT_COLUMNS,
  orderExportFilename,
  ordersToCsv,
  type OrderExportColumnKey,
} from "../../../frontend/apps/web/src/features/admin/reports/payment-orders-shared";
import type { PaymentOrder } from "../../../frontend/apps/web/src/features/admin/reports/payment-orders-api";

/**
 * The order export's column selection and filename.
 *
 * Both are places where a plausible-looking bug is invisible in the UI and only
 * shows up in a spreadsheet someone reconciles against: a reordered column, a
 * localised amount that will not sum, a second file that silently overwrites
 * the first.
 */

function order(overrides: Partial<PaymentOrder> = {}): PaymentOrder {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    membershipId: "22222222-2222-4222-8222-222222222222",
    externalId: "pay_abc123",
    amountCents: 149900,
    currency: "INR",
    status: "paid",
    paidAt: "2026-08-20T10:00:00.000Z",
    createdAt: "2026-08-20T09:59:00.000Z",
    ...overrides,
  };
}

function rows(csv: string): string[] {
  return csv.split("\r\n");
}

describe("ordersToCsv column selection", () => {
  it("writes every column when none are named", () => {
    const [header] = rows(ordersToCsv([order()]));
    expect(header).toBe(ORDER_EXPORT_COLUMNS.map((column) => column.label).join(","));
  });

  it("writes only the chosen columns", () => {
    const csv = ordersToCsv([order()], ["id", "amount", "currency"]);
    const [header, first] = rows(csv);
    expect(header).toBe("Order ID,Amount,Currency");
    expect(first).toBe("11111111-1111-4111-8111-111111111111,1499.00,INR");
  });

  it("keeps file order fixed regardless of how the columns were named", () => {
    // Selecting is not reordering — a file whose columns follow click order
    // breaks every downstream import that maps by position.
    const forwards = ordersToCsv([order()], ["id", "status", "currency"]);
    const backwards = ordersToCsv([order()], ["currency", "status", "id"]);
    expect(backwards).toBe(forwards);
    expect(rows(forwards)[0]).toBe("Order ID,Status,Currency");
  });

  it("falls back to every column rather than writing an empty file", () => {
    const csv = ordersToCsv([order()], []);
    expect(rows(csv)[0]).toBe(ORDER_EXPORT_COLUMNS.map((column) => column.label).join(","));
  });

  it("writes amounts as bare summable numbers, not localised currency", () => {
    const csv = ordersToCsv([order({ amountCents: 5 })], ["amount"]);
    expect(rows(csv)[1]).toBe("0.05");
  });

  it("leaves absent optional values empty rather than writing null", () => {
    const csv = ordersToCsv(
      [order({ externalId: null, membershipId: null, paidAt: null })],
      ["externalId", "membershipId", "paidAt"],
    );
    expect(rows(csv)[1]).toBe(",,");
  });

  it("neutralises a gateway-supplied formula in the external id", () => {
    // `externalId` comes from a payment gateway and lands in a file an
    // administrator opens in Excel.
    const csv = ordersToCsv(
      [order({ externalId: '=HYPERLINK("https://evil.test")' })],
      ["externalId"],
    );
    expect(rows(csv)[1]?.startsWith("\"'=HYPERLINK")).toBe(true);
  });

  it("reports the faults the ledger flags", () => {
    const csv = ordersToCsv([order({ externalId: null })], ["faults"]);
    expect(rows(csv)[1]).toContain("No external ID");
  });

  it("names every column exactly once", () => {
    const keys = ORDER_EXPORT_COLUMNS.map((column) => column.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(ALL_ORDER_EXPORT_COLUMN_KEYS).toEqual(keys);
  });

  it("writes a header even when there are no orders", () => {
    const csv = ordersToCsv([], ["id"]);
    expect(csv).toBe("Order ID");
  });
});

describe("orderExportFilename", () => {
  it("names an unfiltered export by date alone", () => {
    expect(orderExportFilename({})).toMatch(/^payment-orders-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("distinguishes two exports taken the same day under different filters", () => {
    // Two files called payment-orders-2026-08-26.csv in one downloads folder
    // are indistinguishable at the point it matters.
    const failed = orderExportFilename({ status: "failed" });
    const paid = orderExportFilename({ status: "paid" });
    expect(failed).not.toBe(paid);
    expect(failed).toContain("failed");
  });

  it("lower-cases the currency and records that a search was applied", () => {
    const name = orderExportFilename({ currency: "INR", settlement: "unsettled", q: "pay_abc" });
    expect(name).toContain("-inr-");
    expect(name).toContain("unsettled");
    // The term itself is not in the filename — it is operator-typed text going
    // into a path.
    expect(name).toContain("search");
    expect(name).not.toContain("pay_abc");
  });
});

describe("column keys stay in sync with the value functions", () => {
  it("produces one cell per selected key", () => {
    for (const key of ALL_ORDER_EXPORT_COLUMN_KEYS as OrderExportColumnKey[]) {
      const csv = ordersToCsv([order()], [key]);
      expect(rows(csv)).toHaveLength(2);
    }
  });
});
