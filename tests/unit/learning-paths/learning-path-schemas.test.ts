import { describe, expect, it } from "vitest";
import {
  createLearningPathBodySchema,
  pathGateInputSchema,
  pathStepInputSchema,
  updateLearningPathBodySchema,
} from "../../../apps/web/src/server/learning-paths/learning-path.schemas";
import {
  compareBandKeys,
  evaluateGateState,
  readCompetencyBandConfig,
} from "../../../apps/web/src/server/learning-paths/path-gate.service";

describe("learning path schemas", () => {
  it("rejects tenant_id and membership identifiers", () => {
    expect(() =>
      createLearningPathBodySchema.parse({
        title: "Path",
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();

    expect(() =>
      updateLearningPathBodySchema.parse({
        title: "Updated",
        memberId: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("accepts valid path, step, and gate inputs", () => {
    expect(
      pathStepInputSchema.parse({
        stepType: "course",
        refId: "018f0000-0000-7000-8000-000000000001",
        title: "Stage 1",
        position: 1,
        gates: [{ gateType: "open", config: {} }],
      }),
    ).toBeTruthy();

    expect(
      pathGateInputSchema.parse({ gateType: "competency_band", config: { bandKey: "ready" } }),
    ).toBeTruthy();
  });
});

describe("path gate evaluator", () => {
  const base = {
    membershipId: "member-a",
    stepId: "step-a",
    stepPosition: 2,
    stepRefId: "018f0000-0000-7000-8000-000000000001",
    previousStepCompleted: false,
    assessmentPassed: false,
    competencyBandSatisfied: false,
    manualApproved: false,
  };

  it("evaluates open and previous_step_completed gates", () => {
    expect(evaluateGateState("open", base)).toBe("satisfied");
    expect(evaluateGateState("previous_step_completed", base)).toBe("locked");
    expect(
      evaluateGateState("previous_step_completed", { ...base, previousStepCompleted: true }),
    ).toBe("satisfied");
  });

  it("evaluates assessment_passed and competency_band gates", () => {
    expect(evaluateGateState("assessment_passed", base)).toBe("locked");
    expect(evaluateGateState("assessment_passed", { ...base, assessmentPassed: true })).toBe(
      "satisfied",
    );

    expect(evaluateGateState("competency_band", base)).toBe("locked");
    expect(evaluateGateState("competency_band", { ...base, competencyBandSatisfied: true })).toBe(
      "satisfied",
    );
  });

  it("compares band keys using rank when available", () => {
    expect(
      compareBandKeys({
        currentBandKey: "advanced",
        requiredBandKey: "starter",
        currentRank: 3,
        requiredRank: 2,
      }),
    ).toBe(true);

    expect(readCompetencyBandConfig({ minBandKey: "ready" }).bandKey).toBe("ready");
  });
});
