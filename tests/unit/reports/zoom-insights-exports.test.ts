import { describe, expect, it } from "vitest";
import {
  ZOOM_EXPORT_DATASETS,
  createZoomExportBodySchema,
  updateZoomExportScheduleBodySchema,
  zoomInsightsExportsResponseSchema,
} from "@atlas/domain/reports/zoom-insights-exports.dto";

describe("zoom insights exports dto", () => {
  it("lists meetings participants unmatched and connection datasets", () => {
    expect(ZOOM_EXPORT_DATASETS).toEqual(["meetings", "participants", "unmatched", "connection"]);
  });

  it("parses exports ledger response", () => {
    const response = zoomInsightsExportsResponseSchema.parse({
      data: {
        history: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            fileName: "zoom_meetings_20260807.csv",
            format: "csv",
            dataset: "meetings",
            datasetLabel: "Meetings",
            scopeLabel: "Last 30 days · All meetings in range",
            rowCount: 42,
            sizeLabel: "~3KB",
            requestedByLabel: "You",
            status: "SUCCEEDED",
            expired: false,
            expiresAt: "2026-08-14T12:00:00.000Z",
            createdAt: "2026-08-07T12:00:00.000Z",
            completedAt: "2026-08-07T12:00:05.000Z",
            errorCode: null,
            errorMessage: null,
            errorTrace: null,
            progressPercent: 100,
            downloadAvailable: true,
          },
        ],
        schedules: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Weekly Zoom attendance",
            dataset: "participants",
            datasetLabel: "Participants",
            cadenceLabel: "Every Monday at 09:00 UTC",
            cronExpression: "0 9 * * 1",
            timezone: "UTC",
            formats: ["csv"],
            isActive: true,
            nextRunAt: "2026-08-11T09:00:00.000Z",
            nextRunLabel: "Next run in 3 days",
            recipients: ["ops@example.com"],
            delivery: { mode: "email_me", emails: ["ops@example.com"] },
          },
        ],
        connection: {
          status: "connected",
          connectedAt: "2026-08-01T00:00:00.000Z",
          lastSyncedAt: "2026-08-07T11:48:00.000Z",
          meetingsImportedToday: 3,
          hasConnectionRecord: true,
        },
        capabilities: {
          formats: ["csv", "xlsx", "json"],
          datasets: ["meetings", "participants", "unmatched", "connection"],
          canSchedule: true,
          canEmailDelivery: true,
          note: "note",
        },
      },
    });
    expect(response.data.history[0]?.downloadAvailable).toBe(true);
    expect(response.data.schedules[0]?.dataset).toBe("participants");
  });

  it("defaults create body to meetings csv download over 30 days", () => {
    const body = createZoomExportBodySchema.parse({});
    expect(body.dataset).toBe("meetings");
    expect(body.format).toBe("csv");
    expect(body.datePreset).toBe("30d");
    expect(body.delivery).toBe("download");
    expect(body.scheduleEnabled).toBe(false);
  });

  it("accepts schedule toggle updates", () => {
    const body = updateZoomExportScheduleBodySchema.parse({ isActive: false });
    expect(body.isActive).toBe(false);
  });
});
