import { describe, expect, it } from "vitest";
import {
  BATCH_LEARNER_COLUMNS,
  batchContentLearnersQuerySchema,
  batchContentQuerySchema,
  batchExamsMatrixQuerySchema,
  batchExamsQuerySchema,
  batchLearnersQuerySchema,
  batchLiveSessionAttendeesQuerySchema,
  batchLiveSessionParamsSchema,
  batchLiveSessionsAbsenteesQuerySchema,
  batchLiveSessionsMatrixQuerySchema,
  batchLiveSessionsQuerySchema,
  batchMessagesQuerySchema,
  batchesListQuerySchema,
  exportBatchRosterBodySchema,
  removeBatchLearnerBodySchema,
  sendBatchMessageBodySchema,
  updateBatchMessagesNudgesBodySchema,
  batchesCompareQuerySchema,
} from "@atlas/domain/reports/batches-roster.dto";

describe("batches roster dto", () => {
  it("parses batch list query defaults", () => {
    const parsed = batchesListQuerySchema.parse({ page: "2", status: "ACTIVE" });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
    expect(parsed.status).toBe("ACTIVE");
    expect(parsed.window).toBe("any");
    expect(parsed.health).toBe("any");
    expect(parsed.sortBy).toBe("member_count");
    expect(parsed.sortDir).toBe("desc");
  });

  it("parses batch list window health and sort", () => {
    const parsed = batchesListQuerySchema.parse({
      window: "running",
      health: "at_risk",
      sortBy: "avg_content_completion_pct",
      sortDir: "asc",
    });
    expect(parsed.window).toBe("running");
    expect(parsed.health).toBe("at_risk");
    expect(parsed.sortBy).toBe("avg_content_completion_pct");
    expect(parsed.sortDir).toBe("asc");
  });

  it("parses learner columns and sort", () => {
    const parsed = batchLearnersQuerySchema.parse({
      columns: "learner_name,content_completion_pct",
      sortBy: "content_completion_pct",
      sortDir: "asc",
    });
    expect(parsed.columns).toEqual(["learner_name", "content_completion_pct"]);
    expect(parsed.sortBy).toBe("content_completion_pct");
    expect(parsed.health).toBe("any");
  });

  it("parses learner health filter", () => {
    const parsed = batchLearnersQuerySchema.parse({ health: "needs_attention" });
    expect(parsed.health).toBe("needs_attention");
  });

  it("parses remove learner body", () => {
    const parsed = removeBatchLearnerBodySchema.parse({ reason: "withdrawn" });
    expect(parsed.reason).toBe("withdrawn");
  });

  it("falls back to all learner columns when invalid", () => {
    const parsed = batchLearnersQuerySchema.parse({ columns: "nope" });
    expect(parsed.columns).toEqual([...BATCH_LEARNER_COLUMNS]);
  });

  it("accepts message and export bodies and rejects tenant fields", () => {
    const message = sendBatchMessageBodySchema.parse({
      batchId: "11111111-1111-4111-8111-111111111111",
      subject: "Catch up",
      message: "Please join tonight's live class.",
    });
    expect(message.subject).toBe("Catch up");

    const exported = exportBatchRosterBodySchema.parse({
      batchId: "11111111-1111-4111-8111-111111111111",
    });
    expect(exported.emailDownloadLink).toBe(true);

    expect(() =>
      sendBatchMessageBodySchema.parse({
        batchId: "11111111-1111-4111-8111-111111111111",
        subject: "x",
        message: "y",
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });

  it("parses live sessions query defaults", () => {
    const parsed = batchLiveSessionsQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(25);
    expect(parsed.status).toBe("any");
    expect(parsed.sortBy).toBe("scheduled_at");
    expect(parsed.sortDir).toBe("desc");
  });

  it("parses live sessions matrix and absentees queries", () => {
    const matrix = batchLiveSessionsMatrixQuerySchema.parse({ limitSessions: "20" });
    expect(matrix.limitSessions).toBe(20);
    expect(matrix.limitLearners).toBe(100);

    const absentees = batchLiveSessionsAbsenteesQuerySchema.parse({ minMissed: "3" });
    expect(absentees.minMissed).toBe(3);
  });

  it("parses session attendees query defaults", () => {
    const parsed = batchLiveSessionAttendeesQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(25);
    expect(parsed.attendanceKind).toBe("any");
    expect(parsed.sortBy).toBe("status");
  });

  it("parses session params", () => {
    const parsed = batchLiveSessionParamsSchema.parse({
      batchId: "11111111-1111-4111-8111-111111111111",
      sessionId: "22222222-2222-4222-8222-222222222222",
    });
    expect(parsed.batchId).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed.sessionId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("parses batch exams query defaults", () => {
    const parsed = batchExamsQuerySchema.parse({});
    expect(parsed.sortBy).toBe("released_at");
    expect(parsed.sortDir).toBe("asc");
  });

  it("parses batch exams sort and search", () => {
    const parsed = batchExamsQuerySchema.parse({
      q: "Module 1",
      sortBy: "pass_rate",
      sortDir: "desc",
    });
    expect(parsed.q).toBe("Module 1");
    expect(parsed.sortBy).toBe("pass_rate");
    expect(parsed.sortDir).toBe("desc");
  });

  it("parses batch exams matrix query defaults", () => {
    const parsed = batchExamsMatrixQuerySchema.parse({});
    expect(parsed.limitLearners).toBe(100);
  });

  it("parses batch exams matrix limit and search", () => {
    const parsed = batchExamsMatrixQuerySchema.parse({
      q: "Sarah",
      limitLearners: "50",
    });
    expect(parsed.q).toBe("Sarah");
    expect(parsed.limitLearners).toBe(50);
  });

  it("parses batch content query", () => {
    const parsed = batchContentQuerySchema.parse({});
    expect(parsed).toEqual({});
  });

  it("parses batch content learners query defaults", () => {
    const parsed = batchContentLearnersQuerySchema.parse({});
    expect(parsed.view).toBe("any");
    expect(parsed.sortBy).toBe("completion_pct");
    expect(parsed.sortDir).toBe("asc");
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(25);
  });

  it("parses batch content learners filters", () => {
    const parsed = batchContentLearnersQuerySchema.parse({
      q: "Alex",
      view: "stalled",
      sortBy: "days_since",
      sortDir: "desc",
      page: "2",
      limit: "10",
    });
    expect(parsed.q).toBe("Alex");
    expect(parsed.view).toBe("stalled");
    expect(parsed.sortBy).toBe("days_since");
    expect(parsed.sortDir).toBe("desc");
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
  });

  it("parses batch messages query defaults", () => {
    const parsed = batchMessagesQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });

  it("parses compare query with comma-separated batch ids", () => {
    const parsed = batchesCompareQuerySchema.parse({
      batchIds: "11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222",
    });
    expect(parsed.batchIds).toHaveLength(2);
    expect(parsed.normalize).toBe("week_of_batch");
  });

  it("rejects compare with fewer than two batch ids", () => {
    expect(() =>
      batchesCompareQuerySchema.parse({
        batchIds: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });

  it("dedupes compare batch ids and accepts absolute dates", () => {
    const idA = "11111111-1111-4111-8111-111111111111";
    const idB = "22222222-2222-4222-8222-222222222222";
    const parsed = batchesCompareQuerySchema.parse({
      batchIds: `${idA},${idA},${idB}`,
      normalize: "absolute_dates",
    });
    expect(parsed.batchIds).toEqual([idA, idB]);
    expect(parsed.normalize).toBe("absolute_dates");
  });

  it("parses send batch message with channels and audience label", () => {
    const parsed = sendBatchMessageBodySchema.parse({
      batchId: "11111111-1111-4111-8111-111111111111",
      subject: "Reminder",
      message: "Please complete module 2.",
      channels: ["email", "in_app"],
      audienceLabel: "At risk (6)",
      excludeMessagedWithinDays: 7,
    });
    expect(parsed.channels).toEqual(["email", "in_app"]);
    expect(parsed.audienceLabel).toBe("At risk (6)");
    expect(parsed.excludeMessagedWithinDays).toBe(7);
  });

  it("parses nudge update body", () => {
    const parsed = updateBatchMessagesNudgesBodySchema.parse({
      nudges: [
        {
          id: "missed_two_sessions",
          title: "Missed two sessions",
          triggerKey: "missed_two_sessions",
          triggerLabel: "2 missed in 7 days",
          enabled: true,
        },
      ],
    });
    expect(parsed.nudges).toHaveLength(1);
    expect(parsed.nudges[0]?.enabled).toBe(true);
  });
});
