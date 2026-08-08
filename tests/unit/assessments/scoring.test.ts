import { describe, expect, it } from "vitest";
import { scoreAttempt } from "../../../backend/apps/api/src/server/assessments/scoring.service";

function buildRunnerItems() {
  return {
    id: "attempt-1",
    assessmentId: "assessment-1",
    status: "STARTED",
    items: [
      {
        id: "item-1",
        assessmentItemId: "ai-1",
        itemId: "item-1",
        itemTypeKey: "mcq_single",
        position: 1,
        points: 1,
        required: true,
        contentJson: { stem: "Sample" },
        options: [
          { id: "opt-1", optionJson: { label: "A" }, position: 1 },
          { id: "opt-2", optionJson: { label: "B" }, position: 2 },
        ],
        savedAnswer: null,
      },
    ],
  };
}

describe("scoring service", () => {
  const baseItem = {
    assessmentItemId: "ai-1",
    itemId: "item-1",
    itemTypeKey: "mcq_single",
    points: 5,
    answerKeyJson: { correctOptionId: "opt-1" },
    options: [
      { id: "opt-1", isCorrect: true, position: 1 },
      { id: "opt-2", isCorrect: false, position: 2 },
    ],
  };

  it("awards full points for correct objective answers", () => {
    const result = scoreAttempt({
      items: [baseItem],
      answers: new Map([["ai-1", { selectedOptionId: "opt-1" }]]),
    });

    expect(result.earnedPoints).toBe(5);
    expect(result.scorePercent).toBe(100);
    expect(result.requiresManualGrading).toBe(false);
  });

  it("awards zero for incorrect objective answers", () => {
    const result = scoreAttempt({
      items: [baseItem],
      answers: new Map([["ai-1", { selectedOptionId: "opt-2" }]]),
    });

    expect(result.earnedPoints).toBe(0);
    expect(result.scorePercent).toBe(0);
  });

  it("awards zero for missing answers", () => {
    const result = scoreAttempt({
      items: [baseItem],
      answers: new Map([["ai-1", null]]),
    });

    expect(result.earnedPoints).toBe(0);
  });

  it("flags manual grading for subjective items", () => {
    const result = scoreAttempt({
      items: [
        {
          ...baseItem,
          itemTypeKey: "short_answer",
          answerKeyJson: { rubric: "manual" },
        },
      ],
      answers: new Map([["ai-1", { value: "My answer" }]]),
    });

    expect(result.requiresManualGrading).toBe(true);
    expect(result.scorePercent).toBeNull();
  });

  it("computes scorePercent server-side for objective-only attempts", () => {
    const result = scoreAttempt({
      items: [
        baseItem,
        {
          ...baseItem,
          assessmentItemId: "ai-2",
          points: 5,
        },
      ],
      answers: new Map([
        ["ai-1", { selectedOptionId: "opt-1" }],
        ["ai-2", { selectedOptionId: "opt-2" }],
      ]),
    });

    expect(result.scorePercent).toBe(50);
  });
});

describe("runner dto secrecy", () => {
  it("omits answer_key_json, is_correct, and correct flags from runner shape", () => {
    const runner = buildRunnerItems();
    const serialized = JSON.stringify(runner);

    expect(serialized).not.toContain("answer_key_json");
    expect(serialized).not.toContain("answerKeyJson");
    expect(serialized).not.toContain("is_correct");
    expect(serialized).not.toContain("isCorrect");
    expect(serialized).not.toContain("correctOptionId");
  });
});
