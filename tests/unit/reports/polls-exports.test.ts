import { describe, expect, it } from "vitest";
import {
  POLL_RESPONDENTS_EXPORT_COLUMNS,
  POLL_SUMMARY_EXPORT_COLUMNS,
  createPollExportBodySchema,
  pollsExportsResponseSchema,
} from "@atlas/domain/reports/polls-exports.dto";
import { updateReportExportScheduleBodySchema } from "@atlas/domain/reports/report-exports.dto";

describe("polls exports dto", () => {
  it("marks email as sensitive on respondents columns", () => {
    expect(
      POLL_RESPONDENTS_EXPORT_COLUMNS.some((column) => column.key === "email" && column.sensitive),
    ).toBe(true);
    expect(POLL_SUMMARY_EXPORT_COLUMNS.some((column) => column.key === "poll_title")).toBe(true);
  });

  it("parses exports ledger response", () => {
    const response = pollsExportsResponseSchema.parse({
      data: {
        history: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            fileName: "poll-respondents-2026-08-06.csv",
            format: "csv",
            dataset: "respondents",
            datasetLabel: "Respondents",
            scopeLabel: "Week 6 · 4 polls",
            rowCount: 4120,
            sizeLabel: "~2MB",
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
            columns: ["learner_name", "email", "option_label"],
            anonymousExcludedCount: 1,
          },
        ],
        schedules: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Weekly digest",
            datasetLabel: "Poll summary",
            cadenceLabel: "Every Friday, 17:00 Asia/Kolkata",
            cronExpression: "0 17 * * 5",
            timezone: "Asia/Kolkata",
            formats: ["csv"],
            isActive: true,
            nextRunAt: "2026-08-08T11:30:00.000Z",
            nextRunLabel: "Next run in 2 days",
            recipients: ["admin@lms.org"],
            webhookLabel: null,
            delivery: { mode: "email_me", emails: ["admin@lms.org"] },
          },
        ],
        summaryColumns: POLL_SUMMARY_EXPORT_COLUMNS.map((column) => ({ ...column })),
        optionTalliesColumns: [],
        respondentsColumns: POLL_RESPONDENTS_EXPORT_COLUMNS.map((column) => ({
          ...column,
        })),
        nonRespondentsColumns: [],
        capabilities: {
          formats: ["csv", "xlsx", "json"],
          datasets: ["poll_summary", "option_tallies", "respondents", "non_respondents"],
          canSchedule: true,
          canEmailDelivery: true,
          canWebhookDelivery: true,
          note: "note",
        },
      },
    });
    expect(response.data.history[0]?.anonymousExcludedCount).toBe(1);
    expect(response.data.schedules).toHaveLength(1);
  });

  it("parses create body with schedule and recipients", () => {
    const parsed = createPollExportBodySchema.parse({
      dataset: "respondents",
      columns: ["learner_name", "email"],
      format: "csv",
      useCurrentFilters: true,
      delivery: "recipients",
      recipients: ["ops@example.com"],
      scheduleEnabled: true,
      cadence: "weekly",
      time: "17:00",
      timezone: "Asia/Kolkata",
    });
    expect(parsed.scheduleEnabled).toBe(true);
    expect(parsed.delivery).toBe("recipients");
  });

  it("requires live session when allPollsInSession is validated at service layer", () => {
    const parsed = createPollExportBodySchema.parse({
      dataset: "poll_summary",
      columns: ["poll_title"],
      allPollsInSession: true,
      useCurrentFilters: false,
      delivery: "download",
      scheduleEnabled: false,
    });
    expect(parsed.allPollsInSession).toBe(true);
  });

  it("parses schedule patch body", () => {
    const parsed = updateReportExportScheduleBodySchema.parse({ isActive: false });
    expect(parsed.isActive).toBe(false);
  });
});
