import { describe, expect, it } from "vitest";
import {
  choiceToken,
  decodeChoiceAnswer,
  encodeChoiceAnswer,
  newChoiceSalt,
  presentChoices,
  readChoiceItems,
} from "../../../backend/apps/api/src/server/attempts/attempt-choices";
import { reviewItem } from "../../../backend/apps/api/src/server/attempts/attempt-review";
import { scoreAttempt } from "../../../backend/apps/api/src/server/assessments/scoring.service";

/**
 * QA review 1 N1 and M47: matching and ordering questions in a real attempt.
 * Learners get the items' labels but never the answer key's ids, which give
 * the answer away (`step-1`, `step-2`, … in order; `left-n` with `right-n`).
 */

const ORDERING = {
  order: ["step-1", "step-2", "step-3", "step-4"],
  items: { "step-1": "One", "step-2": "Two", "step-3": "Three", "step-4": "Four" },
};
const MATCHING = {
  pairs: { "left-1": "right-1", "left-2": "right-2" },
  leftItems: { "left-1": "Alpha", "left-2": "Beta" },
  rightItems: { "right-1": "First letter", "right-2": "Second letter", "right-3": "Distractor" },
};
const AI = "11111111-1111-4111-8111-111111111111";

describe("presentChoices", () => {
  it("never starts an ordering question in the correct order, for any salt", () => {
    for (let run = 0; run < 200; run += 1) {
      const choices = presentChoices({
        itemTypeKey: "ordering",
        answerKey: ORDERING,
        salt: newChoiceSalt(),
        assessmentItemId: AI,
      });
      if (choices?.kind !== "ordering") throw new Error("expected ordering");
      expect(choices.items.map((item) => item.label)).not.toEqual(["One", "Two", "Three", "Four"]);
      expect([...choices.items.map((item) => item.label)].sort()).toEqual([
        "Four",
        "One",
        "Three",
        "Two",
      ]);
    }
  });

  it("is stable for an attempt and different between attempts", () => {
    const salt = newChoiceSalt();
    const args = { itemTypeKey: "ordering", answerKey: ORDERING, salt, assessmentItemId: AI };
    expect(presentChoices(args)).toEqual(presentChoices(args));
    const other = presentChoices({ ...args, salt: newChoiceSalt() });
    if (other?.kind !== "ordering") throw new Error("expected ordering");
    const mine = presentChoices(args);
    if (mine?.kind !== "ordering") throw new Error("expected ordering");
    expect(other.items.map((item) => item.id)).not.toEqual(mine.items.map((item) => item.id));
  });

  it("shows matching labels with opaque ids, prompts in the author's order", () => {
    const choices = presentChoices({
      itemTypeKey: "matching",
      answerKey: MATCHING,
      salt: "salt",
      assessmentItemId: AI,
    });
    if (choices?.kind !== "matching") throw new Error("expected matching");
    expect(choices.left.map((item) => item.label)).toEqual(["Alpha", "Beta"]);
    expect(new Set(choices.right.map((item) => item.label))).toEqual(
      new Set(["First letter", "Second letter", "Distractor"]),
    );
    const json = JSON.stringify(choices);
    for (const id of ["left-1", "left-2", "right-1", "right-2", "right-3"]) {
      expect(json).not.toContain(id);
    }
  });

  it("returns nothing for other question types", () => {
    expect(
      presentChoices({ itemTypeKey: "mcq_single", answerKey: {}, salt: "s", assessmentItemId: AI }),
    ).toBeNull();
  });
});

describe("answers in tokens", () => {
  const salt = "attempt-salt";
  const token = (id: string) => choiceToken(salt, AI, id);

  it("turns tokens back into the real ids, and back again", () => {
    const answer = { order: ["step-2", "step-1", "step-3", "step-4"], latencyMs: 5 };
    const encoded = encodeChoiceAnswer({
      itemTypeKey: "ordering",
      salt,
      assessmentItemId: AI,
      answerJson: answer,
    });
    expect(encoded["order"]).toEqual(answer.order.map(token));
    expect(
      decodeChoiceAnswer({
        itemTypeKey: "ordering",
        answerKey: ORDERING,
        salt,
        assessmentItemId: AI,
        answerJson: encoded,
      }),
    ).toEqual(answer);

    const pairs = { pairs: { "left-1": "right-2", "left-2": "right-3" } };
    const encodedPairs = encodeChoiceAnswer({
      itemTypeKey: "matching",
      salt,
      assessmentItemId: AI,
      answerJson: pairs,
    });
    expect(
      decodeChoiceAnswer({
        itemTypeKey: "matching",
        answerKey: MATCHING,
        salt,
        assessmentItemId: AI,
        answerJson: encodedPairs,
      }),
    ).toEqual(pairs);
  });

  it("drops tokens that name no item, so a tampered answer is just wrong", () => {
    expect(
      decodeChoiceAnswer({
        itemTypeKey: "ordering",
        answerKey: ORDERING,
        salt,
        assessmentItemId: AI,
        answerJson: { order: ["step-1", token("step-2"), "bogus"] },
      }),
    ).toEqual({ order: ["step-2"] });
    expect(
      decodeChoiceAnswer({
        itemTypeKey: "matching",
        answerKey: MATCHING,
        salt,
        assessmentItemId: AI,
        answerJson: { pairs: { "left-1": "right-1", [token("left-2")]: token("right-2") } },
      }),
    ).toEqual({ pairs: { "left-2": "right-2" } });
  });

  it("passes other types, and attempts without a salt, through", () => {
    const answer = { selectedOptionId: "x" };
    expect(
      decodeChoiceAnswer({
        itemTypeKey: "mcq_single",
        answerKey: {},
        salt,
        assessmentItemId: AI,
        answerJson: answer,
      }),
    ).toBe(answer);
    const raw = { order: ["step-1"] };
    expect(
      decodeChoiceAnswer({
        itemTypeKey: "ordering",
        answerKey: ORDERING,
        salt: undefined,
        assessmentItemId: AI,
        answerJson: raw,
      }),
    ).toBe(raw);
  });

  it("falls back to ids as labels when an old item has no label maps", () => {
    expect(readChoiceItems("ordering", { order: ["a", "b"] })).toEqual({
      kind: "ordering",
      items: [
        { id: "a", label: "a" },
        { id: "b", label: "b" },
      ],
      order: ["a", "b"],
    });
  });
});

describe("swipe cards are graded automatically", () => {
  const item = (direction: "left" | "right") => ({
    assessmentItemId: AI,
    itemId: AI,
    itemTypeKey: "swipe",
    points: 2,
    answerKeyJson: { direction },
    options: [],
  });

  it("scores a card instead of sending the whole quiz to manual marking", () => {
    const result = scoreAttempt({
      items: [item("right"), item("left")],
      answers: new Map([[AI, { action: "known" }]]),
    });
    expect(result.requiresManualGrading).toBe(false);
    expect(result.itemResults.map((r) => r.isCorrect)).toEqual([true, false]);
  });
});

describe("reviewItem: answers in words", () => {
  const options = [
    { id: "o1", label: "Paris", isCorrect: true, position: 1 },
    { id: "o2", label: "London", isCorrect: false, position: 2 },
    { id: "o3", label: "Rome", isCorrect: true, position: 3 },
  ];

  it("names the chosen and correct options", () => {
    expect(
      reviewItem({
        itemTypeKey: "mcq_single",
        answerKeyJson: { correctOptionId: "o1", explanation: "It's the capital." },
        options,
        answerJson: { selectedOptionId: "o2" },
      }),
    ).toEqual({
      yourAnswer: ["London"],
      correctAnswer: ["Paris"],
      correctAnswerLabel: "Correct answer",
      explanation: "It's the capital.",
    });
    expect(
      reviewItem({
        itemTypeKey: "mcq_multi",
        answerKeyJson: {},
        options,
        answerJson: { selectedOptionIds: ["o3", "o1"] },
      }),
    ).toMatchObject({ yourAnswer: ["Paris", "Rome"], correctAnswer: ["Paris", "Rome"] });
  });

  it("writes true/false, blanks, text and swipes", () => {
    expect(
      reviewItem({
        itemTypeKey: "true_false",
        answerKeyJson: { value: false },
        options: [],
        answerJson: { value: true },
      }),
    ).toMatchObject({ yourAnswer: ["True"], correctAnswer: ["False"] });
    expect(
      reviewItem({
        itemTypeKey: "fill_blank",
        answerKeyJson: { acceptedValues: ["stop", "stop loss"] },
        options: [],
        answerJson: { value: "limit" },
      }),
    ).toMatchObject({
      yourAnswer: ["limit"],
      correctAnswer: ["stop", "stop loss"],
      correctAnswerLabel: "Accepted answers",
    });
    expect(
      reviewItem({
        itemTypeKey: "short_answer",
        answerKeyJson: { modelAnswer: "Cap the loss." },
        options: [],
        answerJson: { value: "Limit risk" },
      }),
    ).toMatchObject({
      yourAnswer: ["Limit risk"],
      correctAnswer: ["Cap the loss."],
      correctAnswerLabel: "Model answer",
    });
    expect(
      reviewItem({
        itemTypeKey: "swipe",
        answerKeyJson: { direction: "left" },
        options: [],
        answerJson: { action: "known" },
      }),
    ).toMatchObject({ yourAnswer: ["Known"], correctAnswer: ["Unknown"] });
  });

  it("writes matching pairs and numbered steps, and says nothing when unanswered", () => {
    expect(
      reviewItem({
        itemTypeKey: "matching",
        answerKeyJson: MATCHING,
        options: [],
        answerJson: { pairs: { "left-1": "right-3" } },
      }),
    ).toMatchObject({
      yourAnswer: ["Alpha → Distractor"],
      correctAnswer: ["Alpha → First letter", "Beta → Second letter"],
    });
    expect(
      reviewItem({
        itemTypeKey: "ordering",
        answerKeyJson: ORDERING,
        options: [],
        answerJson: null,
      }),
    ).toMatchObject({
      yourAnswer: [],
      correctAnswer: ["1. One", "2. Two", "3. Three", "4. Four"],
      correctAnswerLabel: "Correct order",
    });
  });
});
