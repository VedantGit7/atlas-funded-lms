import { describe, expect, it } from "vitest";
import {
  activeDevicesExportsResponseSchema,
  createActiveDevicesExportBodySchema,
  DEVICE_EXPORT_COLUMNS,
} from "@atlas/domain/reports/active-devices-exports.dto";

describe("active devices exports dto", () => {
  it("exposes default column catalog", () => {
    expect(
      DEVICE_EXPORT_COLUMNS.some((column) => column.key === "ip_address" && column.sensitive),
    ).toBe(true);
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
            dataset: "device_roster",
            datasetLabel: "Device roster",
            scopeLabel: "Over device limit · last 7 days",
            rowCount: 1204,
            sizeLabel: "~42KB",
            requestedByLabel: "You",
            status: "SUCCEEDED",
            expired: false,
            expiresAt: "2026-08-11T12:00:05.000Z",
            createdAt: "2026-08-04T12:00:00.000Z",
            completedAt: "2026-08-04T12:00:05.000Z",
            errorCode: null,
            errorMessage: null,
            errorTrace: null,
            progressPercent: 100,
            downloadAvailable: true,
            columns: ["learner_name", "email", "status"],
          },
        ],
        schedules: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Weekly device audit",
            datasetLabel: "Device roster",
            cadenceLabel: "Weekly, Monday, 07:00 UTC",
            cronExpression: "0 7 * * 1",
            timezone: "UTC",
            formats: ["csv"],
            isActive: true,
            nextRunAt: "2026-08-10T07:00:00.000Z",
            nextRunLabel: "Next run in 6 days",
            recipients: [],
            webhookLabel: null,
            delivery: null,
          },
        ],
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
    expect(response.data.schedules[0]?.datasetLabel).toBe("Device roster");
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
