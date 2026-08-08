import { describe, expect, it } from "vitest";
import {
  activeDevicesExportsResponseSchema,
  createActiveDevicesExportBodySchema,
  DEVICE_EXPORT_COLUMNS,
} from "@atlas/domain/reports/active-devices-exports.dto";

describe("active devices exports dto", () => {
  it("exposes default column catalog", () => {
    expect(DEVICE_EXPORT_COLUMNS.some((column) => column.key === "ip_address" && column.sensitive)).toBe(
      true,
    );
    expect(DEVICE_EXPORT_COLUMNS.some((column) => column.key === "learner_name")).toBe(true);
  });

  it("parses exports page response", () => {
    const response = activeDevicesExportsResponseSchema.parse({
      data: {
        history: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            fileName: "device-roster-2026-08-04.csv",
            format: "csv",
            scopeLabel: "Over device limit · last 7 days",
            rowCount: 1204,
            sizeLabel: "~42KB",
            status: "SUCCEEDED",
            createdAt: "2026-08-04T12:00:00.000Z",
            completedAt: "2026-08-04T12:00:05.000Z",
            errorCode: null,
            errorMessage: null,
            downloadAvailable: true,
          },
        ],
        schedules: [],
        columns: DEVICE_EXPORT_COLUMNS.map((column) => ({ ...column })),
        capabilities: {
          formats: ["csv", "xlsx", "json"],
          canSchedule: true,
          canEmailDelivery: false,
          canWebhookDelivery: false,
          geoColumnsAvailable: false,
          note: "note",
        },
      },
    });
    expect(response.data.history[0]?.status).toBe("SUCCEEDED");
  });

  it("parses create export body with schedule", () => {
    const body = createActiveDevicesExportBodySchema.parse({
      columns: ["learner_name", "email", "status"],
      format: "json",
      window: "7d",
      overLimitOnly: true,
      useCurrentFilters: true,
      delivery: "recipients",
      recipients: ["ops@example.com"],
      webhookUrl: "https://example.com/hook",
      scheduleEnabled: true,
      cadence: "weekly",
      time: "07:00",
      timezone: "Asia/Kolkata",
    });
    expect(body.format).toBe("json");
    expect(body.scheduleEnabled).toBe(true);
    expect(body.recipients).toEqual(["ops@example.com"]);
  });
});
