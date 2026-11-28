import { describe, expect, it } from "vitest";
import {
  countBlanks,
  countWords,
  fillBlankAnswerSets,
  isKeywordMarked,
  markFillBlank,
  matchedKeywords,
  shortAnswerKeywordRule,
} from "../../../backend/apps/api/src/server/item-registry/answer-rules.contract";
import { validateItemDefinition } from "../../../backend/apps/api/src/server/item-registry/item-definition.contract";
import {
  ITEM_IMPORT_MIXED,
  itemImportColumns,
  itemImportExamples,
  rowToItemDefinition,
} from "../../../backend/apps/api/src/server/item-registry/item-import.contract";
import {
  scoreAttempt,
  type ScoringItem,
} from "../../../backend/apps/api/src/server/assessments/scoring.service";
import { reviewItem } from "../../../backend/apps/api/src/server/attempts/attempt-review";
import {
  responseFromWire,
  responseToWire,
} from "../../../frontend/packages/contracts/src/item-registry/answer-ui";
import {
  answerKeyToUiState,
  scorePreviewAnswer,
  uiStateToAnswerKey,
} from "../../../frontend/packages/contracts/src/item-registry/answer-contracts";

/**
 * QA remediation S3.4b: question types (review 1 M48, m25; review 2 4.1):
 * several blanks, keyword-marked short answers, a long answer word limit, and
 * a spreadsheet template for any mix of types.
 */

describe("fill in the blank with several blanks (M48)", () => {
  it("counts the blanks in the question and reads older answer keys", () => {
    expect(countBlanks("A ____ forms after a double ___ at support.")).toBe(2);
    expect(countBlanks("No blank here __")).toBe(0);
    expect(fillBlankAnswerSets({ acceptedValues: ["Doji"] })).toEqual([["Doji"]]);
    expect(fillBlankAnswerSets({ value: "Doji" })).toEqual([["Doji"]]);
    expect(
      fillBlankAnswerSets({ blanks: [{ acceptedValues: ["a"] }, { acceptedValues: ["b", "c"] }] }),
    ).toEqual([["a"], ["b", "c"]]);
  });

  it("marks each blank, ignoring capitals and extra spaces", () => {
    const key = {
      blanks: [{ acceptedValues: ["support"] }, { acceptedValues: ["bottom", "low"] }],
    };
    expect(markFillBlank(key, { values: ["  Support ", "LOW"] })).toEqual({ right: 2, total: 2 });
    expect(markFillBlank(key, { values: ["support", "top"] })).toEqual({ right: 1, total: 2 });
    expect(markFillBlank({ acceptedValues: ["Doji"] }, { value: "doji" })).toEqual({
      right: 1,
      total: 1,
    });
  });

  it("needs answers for every blank the question shows", () => {
    const stem = "Price bounces off ____ twice: a double ____.";
    const ok = validateItemDefinition({
      itemTypeKey: "fill_blank",
      stem,
      answerKeyJson: {
        blanks: [{ acceptedValues: [" support ", "Support"] }, { acceptedValues: ["bottom"] }],
      },
      options: [],
    });
    expect(ok).toMatchObject({
      ok: true,
      answerKey: { blanks: [{ acceptedValues: ["support"] }, { acceptedValues: ["bottom"] }] },
    });

    const tooFew = validateItemDefinition({
      itemTypeKey: "fill_blank",
      stem,
      answerKeyJson: { acceptedValues: ["support"] },
      options: [],
    });
    expect(tooFew.ok).toBe(false);
    if (!tooFew.ok) {
      expect(tooFew.issues[0]?.message).toBe(
        "The question shows 2 blanks (____). Add the accepted answers for each blank.",
      );
    }

    const emptyBlank = validateItemDefinition({
      itemTypeKey: "fill_blank",
      stem,
      answerKeyJson: { blanks: [{ acceptedValues: ["support"] }, { acceptedValues: [""] }] },
      options: [],
    });
    expect(emptyBlank.ok).toBe(false);
    if (!emptyBlank.ok) {
      expect(emptyBlank.issues[0]?.message).toBe("Add at least one accepted answer for blank 2.");
    }
  });

  it("gives each right blank an equal share, and takes negative marks only for nothing right", () => {
    const item: ScoringItem = {
      assessmentItemId: "fb",
      itemId: "i",
      itemTypeKey: "fill_blank",
      points: 3,
      answerKeyJson: {
        blanks: [{ acceptedValues: ["a"] }, { acceptedValues: ["b"] }, { acceptedValues: ["c"] }],
      },
      options: [],
    };
    const partly = scoreAttempt({
      items: [item],
      answers: new Map([["fb", { values: ["a", "b", "x"] }]]),
      negativeMarkPercent: 50,
    });
    expect(partly.itemResults[0]).toMatchObject({ isCorrect: false, pointsAwarded: 2 });

    const none = scoreAttempt({
      items: [item],
      answers: new Map([["fb", { values: ["x", "y", "z"] }]]),
      negativeMarkPercent: 50,
    });
    expect(none.itemResults[0]?.pointsAwarded).toBe(-1.5);
  });

  it("shows the learner one box per blank and reviews each blank", () => {
    const state = responseFromWire("fill_blank", { values: ["support", ""] });
    expect(state).toEqual({ type: "fill_blank", values: ["support", ""] });
    expect(responseToWire(state)).toEqual({ values: ["support", ""] });
    expect(responseToWire({ type: "fill_blank", values: ["doji"] })).toEqual({ value: "doji" });
    expect(responseToWire({ type: "fill_blank", values: ["", " "] })).toBeNull();

    const review = reviewItem({
      itemTypeKey: "fill_blank",
      answerKeyJson: {
        blanks: [{ acceptedValues: ["support"] }, { acceptedValues: ["bottom", "low"] }],
      },
      options: [],
      answerJson: { values: ["support", ""] },
    });
    expect(review.yourAnswer).toEqual(["Blank 1: support", "Blank 2: (empty)"]);
    expect(review.correctAnswer).toEqual(["Blank 1: support", "Blank 2: bottom / low"]);
  });

  it("keeps the editor's empty rows until the question is saved", () => {
    const ui = answerKeyToUiState("fill_blank", {
      blanks: [{ acceptedValues: ["a"] }, { acceptedValues: [] }],
    });
    expect(ui).toEqual({ type: "fill_blank", blanks: [["a"], [""]] });
    expect(uiStateToAnswerKey({ type: "fill_blank", blanks: [["a", ""]] })).toEqual({
      acceptedValues: ["a", ""],
    });
  });
});

describe("short answers marked by keywords (m25)", () => {
  it("matches whole words and phrases, ignoring capitals", () => {
    expect(matchedKeywords("Set a Stop  Loss before risking money", ["stop loss", "risk"])).toEqual(
      ["stop loss"],
    );
    expect(matchedKeywords("I stopped trading", ["stop"])).toEqual([]);
    expect(shortAnswerKeywordRule({ keywords: ["a", "b", "c"], keywordsRequired: 2 })).toEqual({
      keywords: ["a", "b", "c"],
      required: 2,
    });
    expect(shortAnswerKeywordRule({ keywords: ["a", "b"] })?.required).toBe(2);
    expect(isKeywordMarked("short_answer", { keywords: [] })).toBe(false);
  });

  it("marks automatically with keywords and leaves the rest to a person", () => {
    const keyed: ScoringItem = {
      assessmentItemId: "sa",
      itemId: "i",
      itemTypeKey: "short_answer",
      points: 2,
      answerKeyJson: { keywords: ["size", "risk", "loss"], keywordsRequired: 2 },
      options: [],
    };
    const right = scoreAttempt({
      items: [keyed],
      answers: new Map([["sa", { value: "Pick the size so the loss stays small." }]]),
    });
    expect(right).toMatchObject({ requiresManualGrading: false, scorePercent: 100 });

    const wrong = scoreAttempt({
      items: [keyed],
      answers: new Map([["sa", { value: "Buy low, sell high." }]]),
    });
    expect(wrong).toMatchObject({ requiresManualGrading: false, scorePercent: 0 });

    const manual = scoreAttempt({
      items: [{ ...keyed, answerKeyJson: { rubric: "Mentions size." } }],
      answers: new Map([["sa", { value: "Anything" }]]),
    });
    expect(manual.requiresManualGrading).toBe(true);
  });

  it("validates keywords and how many are needed", () => {
    const base = { itemTypeKey: "short_answer", stem: "What is position sizing?", options: [] };
    expect(
      validateItemDefinition({
        ...base,
        answerKeyJson: { keywords: [" Risk ", "risk", "size", ""], keywordsRequired: 2 },
      }),
    ).toMatchObject({ ok: true, answerKey: { keywords: ["Risk", "size"], keywordsRequired: 2 } });
    const tooMany = validateItemDefinition({
      ...base,
      answerKeyJson: { keywords: ["risk"], keywordsRequired: 3 },
    });
    expect(tooMany.ok).toBe(false);
  });

  it("explains itself to the learner and in the author's preview", () => {
    const review = reviewItem({
      itemTypeKey: "short_answer",
      answerKeyJson: { keywords: ["size", "risk"], keywordsRequired: 1, modelAnswer: "Size it." },
      options: [],
      answerJson: { value: "risk" },
    });
    expect(review.correctAnswerLabel).toBe("Keywords");
    expect(review.correctAnswer).toEqual(["At least 1 of: size, risk", "Model answer: Size it."]);

    expect(
      scorePreviewAnswer({
        itemTypeKey: "short_answer",
        answerKey: { keywords: ["size", "risk"] },
        answerJson: { value: "only risk" },
        options: [],
      }),
    ).toMatchObject({
      kind: "incorrect",
      detail: "It needs 2 of the keywords and mentions 1 (risk).",
    });
  });
});

describe("long answer word limit (m25)", () => {
  it("counts words and validates the limit", () => {
    expect(countWords("  one two\nthree  ")).toBe(3);
    expect(countWords("")).toBe(0);
    const base = { itemTypeKey: "long_answer", stem: "Describe your plan.", options: [] };
    expect(validateItemDefinition({ ...base, answerKeyJson: { maxWords: 200 } })).toMatchObject({
      ok: true,
      answerKey: { maxWords: 200 },
    });
    expect(validateItemDefinition({ ...base, answerKeyJson: { maxWords: 0 } }).ok).toBe(false);
  });
});

describe("spreadsheet import of any mix of types (4.1)", () => {
  it("has a Question type column first and each type's columns once", () => {
    const keys = itemImportColumns(ITEM_IMPORT_MIXED, []).map((column) => column.key);
    expect(keys[0]).toBe("question_type");
    expect(keys[1]).toBe("question");
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining(["blank_1", "keywords", "max_words", "step_1"]));
  });

  it("reads each row as its own type, and every example is a valid question", () => {
    for (const example of itemImportExamples(ITEM_IMPORT_MIXED)) {
      expect(rowToItemDefinition(ITEM_IMPORT_MIXED, example, [])).toMatchObject({ ok: true });
    }
    expect(
      rowToItemDefinition(
        ITEM_IMPORT_MIXED,
        { question_type: "True / False", question: "Stops cap losses.", correct_answer: "TRUE" },
        [],
      ),
    ).toMatchObject({ ok: true, item: { itemTypeKey: "true_false" } });
    expect(
      rowToItemDefinition(ITEM_IMPORT_MIXED, { question_type: "Essay", question: "Q" }, []),
    ).toEqual({
      ok: false,
      issues: [
        {
          columns: ["question_type"],
          message: '"Essay" is not a question type. Choose one from the list.',
        },
      ],
    });
  });

  it("reads several blanks, keywords and a word limit", () => {
    expect(
      rowToItemDefinition(
        "fill_blank",
        { question: "A ____ then a ____.", blank_1: "hammer; Hammer candle", blank_2: "1,000" },
        [],
      ),
    ).toMatchObject({
      ok: true,
      item: {
        answerKeyJson: {
          blanks: [{ acceptedValues: ["hammer", "Hammer candle"] }, { acceptedValues: ["1,000"] }],
        },
      },
    });
    expect(
      rowToItemDefinition(
        "short_answer",
        { question: "Q", keywords: "size; risk", keywords_needed: 1 },
        [],
      ),
    ).toMatchObject({
      ok: true,
      item: { answerKeyJson: { keywords: ["size", "risk"], keywordsRequired: 1 } },
    });
    expect(rowToItemDefinition("long_answer", { question: "Q", max_words: 150 }, [])).toMatchObject(
      { ok: true, item: { answerKeyJson: { maxWords: 150 } } },
    );
  });
});
