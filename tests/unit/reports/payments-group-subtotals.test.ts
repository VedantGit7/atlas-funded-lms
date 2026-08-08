import { describe, expect, it } from "vitest";
import { applyPaymentExportGrouping } from "@atlas/domain/reports/reports-group-subtotals";

describe("applyPaymentExportGrouping", () => {
  it("groups by gateway and inserts subtotals for single-currency groups", () => {
    const result = applyPaymentExportGrouping(
      {
        columns: ["learner_name", "gateway_key", "amount_cents", "currency", "status"],
        rows: [
          {
            learner_name: "A",
            gateway_key: "stripe",
            amount_cents: 1000,
            currency: "USD",
            status: "paid",
          },
          {
            learner_name: "B",
            gateway_key: "stripe",
            amount_cents: 500,
            currency: "USD",
            status: "paid",
          },
          {
            learner_name: "C",
            gateway_key: "paypal",
            amount_cents: 200,
            currency: "USD",
            status: "paid",
          },
        ],
      },
      "gateway",
      true,
    );

    expect(result.columns[0]).toBe("_group");
    const subtotals = result.rows.filter((row) => row._is_subtotal === true);
    expect(subtotals).toHaveLength(2);
    const stripe = subtotals.find((row) => row._group === "stripe");
    expect(stripe?.amount_cents).toBe(1500);
    expect(stripe?.learner_name).toBe("SUBTOTAL · stripe");
  });

  it("skips amount subtotals when a group mixes currencies", () => {
    const result = applyPaymentExportGrouping(
      {
        columns: ["gateway_key", "amount_cents", "currency"],
        rows: [
          { gateway_key: "stripe", amount_cents: 100, currency: "USD" },
          { gateway_key: "stripe", amount_cents: 200, currency: "EUR" },
        ],
      },
      "gateway",
      true,
    );
    const subtotal = result.rows.find((row) => row._is_subtotal === true);
    expect(subtotal?.amount_cents).toBeNull();
  });
});
