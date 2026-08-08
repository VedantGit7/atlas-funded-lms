import { describe, expect, it } from "vitest";
import {
  answerJsonForChoice,
  choiceOptionsForItem,
  itemTypeKeysForEngine,
} from "../../../backend/apps/api/src/server/practice/practice.service";
import { scoreAttempt } from "../../../backend/apps/api/src/server/assessments/scoring.service";
import {
  StartPracticeSessionBodySchema,
  safePracticeCardSchema,
} from "../../../backend/apps/api/src/server/practice/practice.schemas";

describe("learn engine item selection", () => {
  it("draws from the choice item types", () => {
    expect(itemTypeKeysForEngine("learn")).toEqual(["mcq_single", "true_false"]);
  });

  it("keeps the other engines on their own pools", () => {
    expect(itemTypeKeysForEngine("match")).toEqual(["matching"]);
    expect(itemTypeKeysForEngine("swipe")).toEqual(["swipe"]);
    expect(itemTypeKeysForEngine("flashcards")).toEqual(["swipe"]);
  });

  it("accepts learn on session start", () => {
    expect(StartPracticeSessionBodySchema.parse({ mode: "due", engine: "learn" }).engine).toBe(
      "learn",
    );
  });
});

describe("choiceOptionsForItem", () => {
  it("synthesises a fixed pair for true_false (which stores no option rows)", () => {
    const options = choiceOptionsForItem("true_false", undefined);
    expect(options.map((o) => o.id)).toEqual(["true", "false"]);
    expect(options.map((o) => o.label)).toEqual(["True", "False"]);
  });

  it("uses stored options for mcq_single", () => {
    const stored = [{ id: "o1", label: "Alpha", isCorrect: true, position: 0 }];
    expect(choiceOptionsForItem("mcq_single", stored)).toEqual(stored);
  });

  it("degrades to an empty list when an mcq has no options", () => {
    expect(choiceOptionsForItem("mcq_single", undefined)).toEqual([]);
  });
});

describe("answerJsonForChoice", () => {
  it("maps true_false option ids onto a boolean value", () => {
    expect(answerJsonForChoice("true_false", "true")).toEqual({ value: true });
    expect(answerJsonForChoice("true_false", "false")).toEqual({ value: false });
  });

  it("passes mcq selections through as an option id", () => {
    expect(answerJsonForChoice("mcq_single", "o2")).toEqual({ selectedOptionId: "o2" });
  });
});

describe("learn grading reuses the assessment grader", () => {
  function gradeChoice(args: {
    itemTypeKey: string;
    answerKeyJson: unknown;
    options: Array<{ id: string; isCorrect: boolean | null; position: number }>;
    selectedOptionId: string;
  }): boolean {
    const scored = scoreAttempt({
      items: [
        {
          assessmentItemId: "i1",
          itemId: "i1",
          itemTypeKey: args.itemTypeKey,
          points: 1,
          answerKeyJson: args.answerKeyJson,
          options: args.options,
        },
      ],
      answers: new Map([["i1", answerJsonForChoice(args.itemTypeKey, args.selectedOptionId)]]),
    });
    return scored.itemResults[0]?.isCorrect === true;
  }

  it("grades a correct mcq_single answer via the answer key", () => {
    expect(
      gradeChoice({
        itemTypeKey: "mcq_single",
        answerKeyJson: { correctOptionId: "o2" },
        options: [],
        selectedOptionId: "o2",
      }),
    ).toBe(true);
  });

  it("grades a wrong mcq_single answer", () => {
    expect(
      gradeChoice({
        itemTypeKey: "mcq_single",
        answerKeyJson: { correctOptionId: "o2" },
        options: [],
        selectedOptionId: "o1",
      }),
    ).toBe(false);
  });

  it("falls back to option isCorrect when the key omits the id", () => {
    expect(
      gradeChoice({
        itemTypeKey: "mcq_single",
        answerKeyJson: {},
        options: [
          { id: "o1", isCorrect: false, position: 0 },
          { id: "o2", isCorrect: true, position: 1 },
        ],
        selectedOptionId: "o2",
      }),
    ).toBe(true);
  });

  it("grades true_false against the boolean key", () => {
    expect(
      gradeChoice({
        itemTypeKey: "true_false",
        answerKeyJson: { value: true },
        options: [],
        selectedOptionId: "true",
      }),
    ).toBe(true);
    expect(
      gradeChoice({
        itemTypeKey: "true_false",
        answerKeyJson: { value: true },
        options: [],
        selectedOptionId: "false",
      }),
    ).toBe(false);
  });
});

describe("choice card safety", () => {
  it("accepts a choice card and never carries correctness", () => {
    const card = safePracticeCardSchema.parse({
      itemId: "018f0000-0000-7000-8000-000000000001",
      itemTypeKey: "mcq_single",
      rendererKey: "choice",
      contentJson: { stem: "What is alpha?" },
      options: [
        { id: "o1", label: "Excess return" },
        { id: "o2", label: "Volatility" },
      ],
    });
    expect(card.rendererKey).toBe("choice");
    expect(JSON.stringify(card)).not.toContain("isCorrect");
  });

  it("accepts a true_false choice card", () => {
    const card = safePracticeCardSchema.parse({
      itemId: "018f0000-0000-7000-8000-000000000002",
      itemTypeKey: "true_false",
      rendererKey: "choice",
      contentJson: { stem: "Beta measures volatility." },
      options: [
        { id: "true", label: "True" },
        { id: "false", label: "False" },
      ],
    });
    expect(card.itemTypeKey).toBe("true_false");
  });
});
