import { describe, expect, it } from "vitest";
import {
  PAYMENT_EXPORT_COLUMNS,
  PAYMENT_EXPORT_DATASETS,
  createPaymentExportBodySchema,
  paymentExportsResponseSchema,
} from "@atlas/domain/reports/payments-exports.dto";

describe("payments exports dto", () => {
  it("exposes column catalog with sensitive billing fields", () => {
    expect(
      PAYMENT_EXPORT_COLUMNS.some((column) => column.key === "amount_cents" && column.sensitive),
    ).toBe(true);
    expect(PAYMENT_EXPORT_COLUMNS.some((column) => column.key === "learner_name")).toBe(true);
  });

  it("parses exports page response including expired history", () => {
    const response = paymentExportsResponseSchema.parse({
      data: {
        history: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            fileName: "payments_transactions_2026-08-04.csv",
            format: "csv",
            dataset: "transactions",
            datasetLabel: "Transactions",
            scopeLabel: "All sources · All time",
            rowCount: 45210,
            sizeLabel: "~2.8MB",
            status: "SUCCEEDED",
            expired: false,
            expiresAt: "2026-08-11T12:00:00.000Z",
            createdAt: "2026-08-04T12:00:00.000Z",
            completedAt: "2026-08-04T12:00:05.000Z",
            errorCode: null,
            errorMessage: null,
            errorTrace: null,
            progressPercent: 100,
            downloadAvailable: true,
            columns: ["learner_name", "amount_cents"],
          },
        ],
        schedules: [],
        columns: PAYMENT_EXPORT_COLUMNS.map((column) => ({ ...column })),
        capabilities: {
          formats: ["csv", "xlsx", "json"],
          datasets: ["transactions", "invoices", "instalments", "refunds", "gateways"],
          canSchedule: true,
          canEmailDelivery: true,
          canWebhookDelivery: true,
          groupingApplied: true,
          note: "note",
        },
      },
    });
    expect(response.data.history[0]?.dataset).toBe("transactions");
    expect(response.data.capabilities.groupingApplied).toBe(true);
  });

  it("parses create export body with schedule and refunds dataset", () => {
    const body = createPaymentExportBodySchema.parse({
      dataset: "refunds",
      columns: ["learner_name", "email", "amount_cents", "status"],
      format: "xlsx",
      paidFrom: "2026-07-01T00:00:00.000Z",
      paidTo: "2026-07-31T23:59:59.999Z",
      useCurrentFilters: true,
      grouping: "gateway",
      includeSubtotals: true,
      delivery: "recipients",
      recipients: ["finance@example.com"],
      webhookUrl: "https://example.com/hook",
      scheduleEnabled: true,
      cadence: "monthly",
      time: "06:00",
      timezone: "Asia/Kolkata",
    });
    expect(body.dataset).toBe("refunds");
    expect(body.format).toBe("xlsx");
    expect(body.scheduleEnabled).toBe(true);
    expect(body.recipients).toEqual(["finance@example.com"]);
  });

  it("offers orders as a dataset of its own", () => {
    // Not a synonym for transactions: same table, different axis. See the
    // comment on PAYMENT_EXPORT_DATASETS.
    expect(PAYMENT_EXPORT_DATASETS).toContain("orders");
    const body = createPaymentExportBodySchema.parse({
      dataset: "orders",
      columns: ["id", "external_id", "status", "amount_cents"],
      format: "csv",
      settlement: "unsettled",
    });
    expect(body.dataset).toBe("orders");
    expect(body.settlement).toBe("unsettled");
  });

  it("exposes the external id as a selectable column", () => {
    // It was queried by every payments dataset and selectable by none.
    expect(PAYMENT_EXPORT_COLUMNS.some((column) => column.key === "external_id")).toBe(true);
    expect(PAYMENT_EXPORT_COLUMNS.some((column) => column.key === "id")).toBe(true);
  });

  it("leaves the new identifier columns off by default", () => {
    // Existing schedules keep producing the file they produced yesterday.
    for (const key of ["id", "external_id"]) {
      expect(PAYMENT_EXPORT_COLUMNS.find((column) => column.key === key)?.defaultSelected).toBe(
        false,
      );
    }
  });

  it("rejects a settlement value outside the two it knows", () => {
    expect(() =>
      createPaymentExportBodySchema.parse({
        dataset: "orders",
        columns: ["status"],
        format: "csv",
        settlement: "partially",
      }),
    ).toThrow();
  });

  it("rejects empty columns", () => {
    expect(() =>
      createPaymentExportBodySchema.parse({
        dataset: "transactions",
        columns: [],
        format: "csv",
      }),
    ).toThrow();
  });
});
