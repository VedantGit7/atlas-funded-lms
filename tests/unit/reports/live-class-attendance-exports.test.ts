import { describe, expect, it } from "vitest";
import {
  createLiveClassAttendanceExportBodySchema,
  LCA_EXPORT_COLUMNS,
  LCA_EXPORT_DATASETS,
  liveClassAttendanceExportsResponseSchema,
  updateLiveClassAttendanceExportScheduleBodySchema,
} from "@atlas/domain/reports/live-class-attendance-exports.dto";

describe("live class attendance exports dto", () => {
  it("defaults create body to an attendees csv download for the last 30 days", () => {
    const parsed = createLiveClassAttendanceExportBodySchema.parse({});
    expect(parsed.dataset).toBe("attendees");
    expect(parsed.format).toBe("csv");
    expect(parsed.scopeMode).toBe("date_range");
    expect(parsed.datePreset).toBe("30d");
    expect(parsed.registrationMode).toBe("include_never_joined");
    expect(parsed.delivery).toBe("download");
    expect(parsed.scheduleEnabled).toBe(false);
  });

  it("accepts every dataset with a schedule", () => {
    for (const dataset of LCA_EXPORT_DATASETS) {
      const parsed = createLiveClassAttendanceExportBodySchema.parse({
        dataset,
        format: "xlsx",
        scheduleEnabled: true,
        cadence: "weekly",
        time: "07:00",
        timezone: "Asia/Kolkata",
      });
      expect(parsed.dataset).toBe(dataset);
      expect(parsed.scheduleEnabled).toBe(true);
    }
  });

  it("refuses tenant fields, unknown columns and unknown keys", () => {
    expect(() => createLiveClassAttendanceExportBodySchema.parse({ tenantId: "x" })).toThrow();
    expect(() =>
      createLiveClassAttendanceExportBodySchema.parse({ columns: ["not_a_column"] }),
    ).toThrow();
    expect(() => createLiveClassAttendanceExportBodySchema.parse({ surprise: true })).toThrow();
    expect(() =>
      updateLiveClassAttendanceExportScheduleBodySchema.parse({ cronExpression: "* * * * *" }),
    ).toThrow();
  });

  it("parses the exports ledger with schedules and row estimates", () => {
    const response = liveClassAttendanceExportsResponseSchema.parse({
      data: {
        history: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            fileName: "live-class-attendance-attendees-2026-10-01.csv",
            format: "csv",
            dataset: "attendees",
            datasetLabel: "Attendees",
            scopeLabel: "Last 30 days",
            rowCount: 412,
            sizeLabel: "~26KB",
            requestedByLabel: "You",
            status: "SUCCEEDED",
            expired: false,
            expiresAt: "2026-10-08T12:00:00.000Z",
            createdAt: "2026-10-01T12:00:00.000Z",
            completedAt: "2026-10-01T12:00:03.000Z",
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
            name: "Weekly attendance",
            dataset: "sessions",
            datasetLabel: "Sessions",
            cadenceLabel: "Every Monday at 07:00 Asia/Kolkata",
            cronExpression: "0 7 * * 1",
            timezone: "Asia/Kolkata",
            formats: ["xlsx"],
            isActive: true,
            nextRunAt: "2026-10-12T01:30:00.000Z",
            nextRunLabel: "Next run in 3 days",
            recipients: [],
            delivery: { mode: "email_me" },
          },
        ],
        capabilities: {
          formats: ["csv", "xlsx", "json"],
          datasets: [...LCA_EXPORT_DATASETS],
          columns: [...LCA_EXPORT_COLUMNS],
          canSchedule: true,
          canEmailDelivery: true,
          note: "Ready files are deleted after 7 days.",
        },
        estimates: { includeNeverJoinedRows: 480, attendeesOnlyRows: 412 },
      },
    });
    expect(response.data.schedules[0]?.dataset).toBe("sessions");
    expect(response.data.estimates.attendeesOnlyRows).toBe(412);
  });
});
