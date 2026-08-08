import { describe, expect, it } from "vitest";
import {
  PROGRESS_EXPORT_COLUMNS,
  SCORE_EXPORT_COLUMNS,
  createProgressScoreExportBodySchema,
  progressScoreExportsResponseSchema,
  updateProgressScoreExportScheduleBodySchema,
} from "@atlas/domain/reports/progress-score-exports.dto";

describe("progress-score exports dto", () => {
  it("exposes progress and score column catalogs with email PII", () => {
    expect(
      PROGRESS_EXPORT_COLUMNS.some((column) => column.key === "email" && column.sensitive),
    ).toBe(true);
    expect(PROGRESS_EXPORT_COLUMNS.some((column) => column.key === "completion_pct")).toBe(true);
    expect(SCORE_EXPORT_COLUMNS.some((column) => column.key === "email" && column.sensitive)).toBe(
      true,
    );
    expect(SCORE_EXPORT_COLUMNS.some((column) => column.key === "score_pct")).toBe(true);
  });

  it("parses exports ledger response including expired history and dual column sets", () => {
    const response = progressScoreExportsResponseSchema.parse({
      data: {
        history: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            fileName: "progress_score_progress_2026-08-04.csv",
            format: "csv",
            dataset: "progress",
            datasetLabel: "Progress",
            scopeLabel: "All products · All time",
            rowCount: 1200,
            sizeLabel: "~75KB",
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
            columns: ["learner_name", "email", "completion_pct"],
          },
        ],
        schedules: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Weekly Scores export",
            datasetLabel: "Scores",
            cadenceLabel: "Every Monday, 06:00 Asia/Kolkata",
            cronExpression: "0 6 * * 1",
            timezone: "Asia/Kolkata",
            formats: ["csv"],
            isActive: true,
            nextRunAt: "2026-08-11T00:30:00.000Z",
            nextRunLabel: "Next run in 5 days",
            recipients: ["ops@example.com"],
            webhookLabel: null,
            delivery: { mode: "email_me", emails: ["ops@example.com"] },
          },
        ],
        progressColumns: PROGRESS_EXPORT_COLUMNS.map((column) => ({ ...column })),
        scoreColumns: SCORE_EXPORT_COLUMNS.map((column) => ({ ...column })),
        capabilities: {
          formats: ["csv", "xlsx", "json"],
          datasets: ["progress", "scores", "attempts", "item_analysis"],
          canSchedule: true,
          canEmailDelivery: true,
          canWebhookDelivery: true,
          note: "note",
        },
      },
    });
    expect(response.data.history[0]?.dataset).toBe("progress");
    expect(response.data.schedules).toHaveLength(1);
    expect(response.data.progressColumns.length).toBeGreaterThan(0);
    expect(response.data.scoreColumns.length).toBeGreaterThan(0);
  });

  it("parses create export body with schedule and attempts dataset", () => {
    const body = createProgressScoreExportBodySchema.parse({
      dataset: "attempts",
      columns: ["learner_name", "email", "score_pct", "submitted_at"],
      format: "xlsx",
      productType: "course",
      productId: "33333333-3333-4333-8333-333333333333",
      assessmentId: "44444444-4444-4444-8444-444444444444",
      dateFrom: "2026-07-01T00:00:00.000Z",
      dateTo: "2026-07-31T23:59:59.999Z",
      useCurrentFilters: true,
      delivery: "recipients",
      recipients: ["faculty@example.com"],
      webhookUrl: "https://example.com/hook",
      scheduleEnabled: true,
      cadence: "weekly",
      time: "06:00",
      timezone: "Asia/Kolkata",
    });
    expect(body.dataset).toBe("attempts");
    expect(body.format).toBe("xlsx");
    expect(body.delivery).toBe("recipients");
    expect(body.scheduleEnabled).toBe(true);
    expect(body.recipients).toEqual(["faculty@example.com"]);
  });

  it("defaults dataset/format/delivery and rejects empty columns", () => {
    const body = createProgressScoreExportBodySchema.parse({
      columns: ["learner_name", "completion_pct"],
    });
    expect(body.dataset).toBe("progress");
    expect(body.format).toBe("csv");
    expect(body.delivery).toBe("download");
    expect(body.scheduleEnabled).toBe(false);

    expect(() =>
      createProgressScoreExportBodySchema.parse({
        dataset: "progress",
        columns: [],
        format: "csv",
      }),
    ).toThrow();
  });

  it("parses schedule update body", () => {
    const body = updateProgressScoreExportScheduleBodySchema.parse({
      isActive: false,
      name: "Paused scores export",
    });
    expect(body.isActive).toBe(false);
    expect(body.name).toBe("Paused scores export");
  });
});
