import { describe, expect, it } from "vitest";
import {
  SM_SALES_EXPORT_COLUMNS,
  createSalesMarketingExportBodySchema,
  salesMarketingExportsResponseSchema,
} from "@atlas/domain/reports/sales-marketing-exports.dto";

describe("sales-marketing exports dto", () => {
  it("marks email as sensitive on purchaser exports", () => {
    expect(
      SM_SALES_EXPORT_COLUMNS.some((column) => column.key === "email" && column.sensitive),
    ).toBe(true);
    expect(SM_SALES_EXPORT_COLUMNS.some((column) => column.key === "learner_name")).toBe(true);
  });

  it("parses exports overview response with history and schedules", () => {
    const response = salesMarketingExportsResponseSchema.parse({
      data: {
        history: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            fileName: "sales-2026-08-06.csv",
            format: "csv",
            dataset: "sales",
            datasetLabel: "Purchasers",
            scopeLabel: "All products · All time",
            rowCount: 12405,
            sizeLabel: "~775KB",
            requestedByLabel: "System",
            status: "SUCCEEDED",
            expired: false,
            expiresAt: "2026-08-13T12:00:00.000Z",
            createdAt: "2026-08-06T12:00:00.000Z",
            completedAt: "2026-08-06T12:00:05.000Z",
            errorCode: null,
            errorMessage: null,
            errorTrace: null,
            progressPercent: 100,
            downloadAvailable: true,
            columns: ["learner_name", "email"],
          },
        ],
        schedules: [],
        columnsByDataset: {
          sales: SM_SALES_EXPORT_COLUMNS.map((column) => ({ ...column })),
          coupons: [],
          "referral-wallet": [],
          "affiliate-products": [],
          affiliates: [],
        },
        capabilities: {
          formats: ["csv", "xlsx", "json"],
          datasets: [
            "sales",
            "coupons",
            "referral-wallet",
            "affiliate-products",
            "affiliates",
          ],
          canSchedule: true,
          canEmailDelivery: true,
          canWebhookDelivery: true,
          note: "note",
        },
      },
    });
    expect(response.data.history[0]?.dataset).toBe("sales");
    expect(response.data.capabilities.canSchedule).toBe(true);
  });

  it("parses create export body with schedule and recipients", () => {
    const body = createSalesMarketingExportBodySchema.parse({
      dataset: "affiliates",
      columns: ["learner_name", "email", "commission_earned_cents"],
      format: "xlsx",
      useCurrentFilters: true,
      grouping: "none",
      delivery: "recipients",
      recipients: ["finance@example.com"],
      webhookUrl: "https://example.com/hook",
      scheduleEnabled: true,
      cadence: "monthly",
      time: "06:00",
      timezone: "Asia/Kolkata",
    });
    expect(body.dataset).toBe("affiliates");
    expect(body.format).toBe("xlsx");
    expect(body.scheduleEnabled).toBe(true);
    expect(body.recipients).toEqual(["finance@example.com"]);
  });
});
