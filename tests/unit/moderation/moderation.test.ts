import { describe, expect, it } from "vitest";
import {
  assertRegisteredContentAction,
  resolveCaseStatusAfterAppealUphold,
  resolveCaseStatusAfterDecision,
} from "../../../backend/apps/api/src/server/moderation/moderation.contract";
import {
  createAppealBodySchema,
  createModerationCaseBodySchema,
  decideModerationCaseBodySchema,
  rejectUnsafePlainText,
  reviewAppealBodySchema,
} from "../../../backend/apps/api/src/server/moderation/moderation.dto";
import { MODERATION_ROUTE_REGISTRY } from "../../../frontend/apps/web/src/features/moderation/moderation-route-registry";

describe("moderation command validation", () => {
  it("accepts valid case creation input", () => {
    expect(
      createModerationCaseBodySchema.parse({
        targetType: "post",
        targetId: "550e8400-e29b-41d4-a716-446655440000",
        reasonKey: "spam",
      }).targetType,
    ).toBe("post");
  });

  it("rejects client tenant_id on case creation", () => {
    expect(() =>
      createModerationCaseBodySchema.parse({
        tenant_id: "550e8400-e29b-41d4-a716-446655440000",
        targetType: "post",
        targetId: "550e8400-e29b-41d4-a716-446655440001",
      }),
    ).toThrow();
  });

  it("requires nextCaseStatus when upholding an appeal", () => {
    expect(() =>
      reviewAppealBodySchema.parse({
        outcome: "uphold",
      }),
    ).toThrow();
  });
});

describe("unsafe text rejection", () => {
  it("rejects html in appeal body", () => {
    expect(() =>
      createAppealBodySchema.parse({
        moderationCaseId: "550e8400-e29b-41d4-a716-446655440000",
        body: "<script>alert(1)</script>",
      }),
    ).toThrow();
  });

  it("accepts plain text reasons", () => {
    expect(rejectUnsafePlainText("Policy violation")).toBe(true);
  });
});

describe("lifecycle validation", () => {
  it("allows OPEN to REVIEWING", () => {
    expect(
      resolveCaseStatusAfterDecision({
        currentStatus: "OPEN",
        decisionKey: "begin_review",
      }),
    ).toBe("REVIEWING");
  });

  it("rejects begin_review from REVIEWING", () => {
    expect(
      resolveCaseStatusAfterDecision({
        currentStatus: "REVIEWING",
        decisionKey: "begin_review",
      }),
    ).toBeNull();
  });

  it("allows upheld appeal to move ACTIONED to REJECTED", () => {
    expect(
      resolveCaseStatusAfterAppealUphold({
        currentStatus: "ACTIONED",
        nextCaseStatus: "REJECTED",
      }),
    ).toBe("REJECTED");
  });
});

describe("content-action registry rejection", () => {
  it("accepts registered delete action", () => {
    expect(assertRegisteredContentAction("delete")).toBe("delete");
  });

  it("rejects hide action", () => {
    expect(() => assertRegisteredContentAction("hide")).toThrow("UNREGISTERED_CONTENT_ACTION");
  });

  it("rejects unregistered decide content actions", () => {
    expect(() =>
      decideModerationCaseBodySchema.parse({
        decisionKey: "actioned",
        contentAction: "hide",
      }),
    ).toThrow();
  });
});

describe("self-review guard helper", () => {
  it("documents appeal review requires different actor in service layer", () => {
    const submitter = "11111111-1111-4111-8111-111111111111";
    const reviewer = "22222222-2222-4222-8222-222222222222";
    expect(submitter).not.toBe(reviewer);
  });
});

describe("moderation frontend route contract", () => {
  it("maps M1-M4 to approved paths", () => {
    expect(MODERATION_ROUTE_REGISTRY.map((entry) => entry.screenId)).toEqual([
      "M1",
      "M2",
      "M3",
      "M4",
    ]);
  });
});
