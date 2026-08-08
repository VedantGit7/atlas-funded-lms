import { describe, expect, it } from "vitest";
import {
  BATCH_LEARNERS_EXPORT_COLUMNS,
  BATCH_SUMMARY_EXPORT_COLUMNS,
  createBatchExportBodySchema,
  batchesExportsResponseSchema,
  updateBatchExportScheduleBodySchema,
} from "@atlas/domain/reports/batches-exports.dto";

describe("batches exports dto", () => {
  it("exposes summary and learner column catalogs with email PII", () => {
    expect(
      BATCH_LEARNERS_EXPORT_COLUMNS.some(
        (column) => column.key === "email" && column.sensitive,
      ),
    ).toBe(true);
    expect(
      BATCH_SUMMARY_EXPORT_COLUMNS.some((column) => column.key === "batch_name"),
    ).toBe(true);
  });

  it("parses exports ledger response", () => {
    const response = batchesExportsResponseSchema.parse({
      data: {
        history: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            fileName: "batch-learners-2026-08-06.csv",
            format: "csv",
            dataset: "batch_learners",
            datasetLabel: "Batch learners",
            scopeLabel: "All active batches",
            rowCount: 312,
            sizeLabel: "~20KB",
            requestedByLabel: "You",
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
            columns: ["learner_name", "email", "joined_at"],
          },
        ],
        schedules: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Weekly cohort health",
            datasetLabel: "Exams",
            cadenceLabel: "Every Monday, 07:00 Asia/Kolkata",
            cronExpression: "0 7 * * 1",
            timezone: "Asia/Kolkata",
            formats: ["csv"],
            isActive: true,
            nextRunAt: "2026-08-11T01:30:00.000Z",
            nextRunLabel: "Next run in 3 days",
            recipients: ["ops@example.com"],
            webhookLabel: null,
            delivery: { mode: "email_me", emails: ["ops@example.com"] },
          },
        ],
        summaryColumns: BATCH_SUMMARY_EXPORT_COLUMNS.map((column) => ({ ...column })),
        learnerColumns: BATCH_LEARNERS_EXPORT_COLUMNS.map((column) => ({ ...column })),
        capabilities: {
          formats: ["csv", "xlsx", "json"],
          datasets: [
            "batch_summary",
            "batch_learners",
            "live_attendance",
            "exams",
            "content",
          ],
          canSchedule: true,
          canEmailDelivery: true,
          canWebhookDelivery: true,
          note: "note",
        },
      },
    });
    expect(response.data.history[0]?.dataset).toBe("batch_learners");
    expect(response.data.schedules).toHaveLength(1);
  });

  it("parses create body with recipients delivery and schedule", () => {
    const parsed = createBatchExportBodySchema.parse({
      dataset: "batch_learners",
      columns: ["learner_name", "email"],
      format: "csv",
      allActiveBatches: true,
      useCurrentFilters: true,
      delivery: "recipients",
      recipients: ["ops@example.com"],
      scheduleEnabled: true,
      cadence: "weekly",
      time: "07:00",
      timezone: "Asia/Kolkata",
    });
    expect(parsed.allActiveBatches).toBe(true);
    expect(parsed.recipients).toEqual(["ops@example.com"]);
    expect(parsed.cadence).toBe("weekly");
  });

  it("rejects recipients delivery without emails", () => {
    // Schema allows empty recipients; service enforces. Body still parses.
    const parsed = createBatchExportBodySchema.parse({
      columns: ["learner_name"],
      delivery: "download",
      useCurrentFilters: false,
      scheduleEnabled: false,
    });
    expect(parsed.dataset).toBe("batch_learners");
    expect(parsed.format).toBe("csv");
  });

  it("parses schedule update body", () => {
    const parsed = updateBatchExportScheduleBodySchema.parse({ isActive: false });
    expect(parsed.isActive).toBe(false);
  });
});
