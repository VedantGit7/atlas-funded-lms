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

describe("scoring matching and multi-select answers", () => {
  const matchingItem = {
    assessmentItemId: "ai-m",
    itemId: "item-m",
    itemTypeKey: "matching",
    points: 2,
    answerKeyJson: { pairs: { "left-1": "right-2", "left-2": "right-1" } },
    options: [],
  };

  const scoreMatching = (pairs: Record<string, string>) =>
    scoreAttempt({ items: [matchingItem], answers: new Map([["ai-m", { pairs }]]) }).itemResults[0]
      ?.isCorrect;

  it("marks a correct matching answer correct whatever order it was made in", () => {
    // The answer object is built in the order the learner matched the pairs,
    // and the grader used to compare JSON text, so this was marked wrong.
    expect(scoreMatching({ "left-2": "right-1", "left-1": "right-2" })).toBe(true);
    expect(scoreMatching({ "left-1": "right-2", "left-2": "right-1" })).toBe(true);
  });

  it("still marks wrong, incomplete and padded matching answers wrong", () => {
    expect(scoreMatching({ "left-1": "right-1", "left-2": "right-2" })).toBe(false);
    expect(scoreMatching({ "left-1": "right-2" })).toBe(false);
    expect(scoreMatching({ "left-1": "right-2", "left-2": "right-1", "left-3": "right-3" })).toBe(
      false,
    );
  });

  const multiItem = (correctOptionIds: string[]) => ({
    assessmentItemId: "ai-x",
    itemId: "item-x",
    itemTypeKey: "mcq_multi",
    points: 1,
    answerKeyJson: { correctOptionIds },
    options: [
      { id: "opt-a", isCorrect: true, position: 1 },
      { id: "opt-b", isCorrect: true, position: 2 },
      { id: "opt-c", isCorrect: false, position: 3 },
    ],
  });

  const scoreMulti = (correctOptionIds: string[], selected: string[]) =>
    scoreAttempt({
      items: [multiItem(correctOptionIds)],
      answers: new Map([["ai-x", { selectedOptionIds: selected }]]),
    }).itemResults[0]?.isCorrect;

  it("uses the options' own flags when the key names options that no longer exist", () => {
    // Saving a question used to give its options new ids while the key kept
    // the editor's old ones; every correct answer was then marked wrong.
    expect(scoreMulti(["stale-1", "stale-2"], ["opt-a", "opt-b"])).toBe(true);
    expect(scoreMulti(["stale-1", "stale-2"], ["opt-a"])).toBe(false);
  });

  it("still follows a key that names this question's options", () => {
    expect(scoreMulti(["opt-a", "opt-b"], ["opt-b", "opt-a"])).toBe(true);
    expect(scoreMulti(["opt-a"], ["opt-a"])).toBe(true);
    expect(scoreMulti(["opt-a"], ["opt-a", "opt-b"])).toBe(false);
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
