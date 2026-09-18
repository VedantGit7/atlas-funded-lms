import { describe, expect, it } from "vitest";
import {
  SM_ATTRIBUTION_EXPORT_COLUMNS,
  SM_EXPORT_DATASETS,
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
          attribution: [],
        },
        capabilities: {
          formats: ["csv", "xlsx", "json"],
          datasets: ["sales", "coupons", "referral-wallet", "affiliate-products", "affiliates"],
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
  it("offers attribution as a dataset of its own", () => {
    // The event stream the other datasets are rolled up from.
    expect(SM_EXPORT_DATASETS).toContain("attribution");
    const body = createSalesMarketingExportBodySchema.parse({
      dataset: "attribution",
      columns: ["occurred_at", "event_type", "utm_source", "attributed"],
      format: "csv",
      attribution: "none",
    });
    expect(body.dataset).toBe("attribution");
    expect(body.attribution).toBe("none");
  });

  it("carries all five UTM fields plus a computed attributed flag", () => {
    const keys = SM_ATTRIBUTION_EXPORT_COLUMNS.map((column) => column.key);
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      expect(keys).toContain(key);
    }
    // Computed server side so a spreadsheet formula cannot drift from the
    // console's own definition of attributed.
    expect(keys).toContain("attributed");
  });

  it("treats the learner email as sensitive on attribution exports too", () => {
    expect(
      SM_ATTRIBUTION_EXPORT_COLUMNS.some((column) => column.key === "email" && column.sensitive),
    ).toBe(true);
  });

  it("leaves the identifying columns off by default", () => {
    // An attribution export is normally read in aggregate; the learner columns
    // are opt-in rather than shipped to every recipient by default.
    for (const key of ["email", "learner_name", "membership_id"]) {
      expect(
        SM_ATTRIBUTION_EXPORT_COLUMNS.find((column) => column.key === key)?.defaultSelected,
      ).toBe(false);
    }
  });

  it("rejects an attribution value outside the three it knows", () => {
    expect(() =>
      createSalesMarketingExportBodySchema.parse({
        dataset: "attribution",
        columns: ["event_type"],
        format: "csv",
        attribution: "partially",
      }),
    ).toThrow();
  });
});
