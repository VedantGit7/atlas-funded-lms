import { describe, expect, it } from "vitest";
import {
  assessmentGradedPayloadSchema,
  assessmentSubmittedPayloadSchema,
  competencyHistoryQuerySchema,
  competencySignalsQuerySchema,
  practiceSessionCompletedPayloadSchema,
} from "../../../backend/apps/api/src/server/competency/competency-projection.schemas";

describe("competency projection schemas", () => {
  it("rejects tenant_id in assessment submitted payload", () => {
    expect(() =>
      assessmentSubmittedPayloadSchema.parse({
        attemptId: "018f0000-0000-7000-8000-000000000001",
        assessmentId: "018f0000-0000-7000-8000-000000000002",
        membershipId: "018f0000-0000-7000-8000-000000000003",
        status: "GRADED",
        scorePercent: 100,
        requiresManualGrading: false,
        tenant_id: "018f0000-0000-7000-8000-000000000004",
      }),
    ).toThrow();
  });

  it("validates assessment graded payload", () => {
    const parsed = assessmentGradedPayloadSchema.parse({
      assessmentId: "018f0000-0000-7000-8000-000000000001",
      attemptId: "018f0000-0000-7000-8000-000000000002",
      gradingTaskId: "018f0000-0000-7000-8000-000000000003",
      itemId: "018f0000-0000-7000-8000-000000000004",
      learnerMembershipId: "018f0000-0000-7000-8000-000000000005",
      graderMembershipId: "018f0000-0000-7000-8000-000000000006",
      score: 1,
      possiblePoints: 1,
      attemptState: "GRADED",
      requestId: "req_test",
    });

    expect(parsed.attemptId).toBe("018f0000-0000-7000-8000-000000000002");
  });

  it("validates practice session completed payload", () => {
    const parsed = practiceSessionCompletedPayloadSchema.parse({
      practiceSessionId: "018f0000-0000-7000-8000-000000000001",
      membershipId: "018f0000-0000-7000-8000-000000000002",
      sessionType: "swipe",
    });

    expect(parsed.sessionType).toBe("swipe");
  });

  it("rejects tenant_id in competency history query", () => {
    expect(() =>
      competencyHistoryQuerySchema.parse({
        tenant_id: "018f0000-0000-7000-8000-000000000001",
      }),
    ).toThrow();
  });

  it("rejects tenant_id in competency signals query", () => {
    expect(() =>
      competencySignalsQuerySchema.parse({
        tenant_id: "018f0000-0000-7000-8000-000000000001",
      }),
    ).toThrow();
  });

  it("coerces string limit query params for competency signals", () => {
    const parsed = competencySignalsQuerySchema.parse({ limit: "25" });

    expect(parsed.limit).toBe(25);
  });

  it("coerces string limit query params for competency history", () => {
    const parsed = competencyHistoryQuerySchema.parse({ limit: "20" });

    expect(parsed.limit).toBe(20);
  });
});
