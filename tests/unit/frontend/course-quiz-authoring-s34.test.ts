import { describe, expect, it } from "vitest";
import {
  hasObjectiveAnswer,
  negativeMarks,
  scoreAttempt,
  type ScoringItem,
} from "../../../backend/apps/api/src/server/assessments/scoring.service";
import {
  itemsInAttempt,
  orderItems,
  planPresentationOrder,
  readPresentationOrder,
} from "../../../backend/apps/api/src/server/attempts/presentation-order";
import { preservedAssessmentConfig } from "../../../backend/apps/api/src/server/assessments/assessments.repository";
import {
  DEFAULT_QUIZ_SETTINGS,
  draftFingerprint,
  marksSummary,
  negativeMarkingSummary,
  quizDraftProblem,
  quizLiveState,
  saveBody,
  type DraftQuestion,
} from "../../../frontend/apps/web/src/features/studio/courses/inline-lesson-editor/lesson-quiz-model";
import { reviewQuizRules } from "../../../frontend/apps/web/src/features/workflows/components/review-quiz-content";

/** QA remediation S3.4a: quiz authoring in the course (review 1 M26, review 2 4.1). */

function mcq(id: string, points: number): ScoringItem {
  return {
    assessmentItemId: id,
    itemId: `item-${id}`,
    itemTypeKey: "mcq_single",
    points,
    answerKeyJson: { correctOptionId: `${id}-right` },
    options: [],
  };
}

describe("negative marking", () => {
  it("takes the share for a wrong answer, nothing for a blank, and floors the total at zero", () => {
    const items = [mcq("a", 2), mcq("b", 2), mcq("c", 2)];
    const answers = new Map<string, Record<string, unknown> | null>([
      ["a", { selectedOptionId: "a-right" }],
      ["b", { selectedOptionId: "b-wrong" }],
      ["c", null],
    ]);
    const scored = scoreAttempt({ items, answers, negativeMarkPercent: 25 });
    expect(scored.itemResults.map((result) => result.pointsAwarded)).toEqual([2, -0.5, 0]);
    expect(scored.earnedPoints).toBe(1.5);
    expect(scored.scorePercent).toBe(25);

    const allWrong = scoreAttempt({
      items: [mcq("a", 1)],
      answers: new Map([["a", { selectedOptionId: "nope" }]]),
      negativeMarkPercent: 100,
    });
    expect(allWrong.earnedPoints).toBe(0);
    expect(allWrong.scorePercent).toBe(0);
  });

  it("is off unless set, and knows a blank answer", () => {
    const off = scoreAttempt({
      items: [mcq("a", 1)],
      answers: new Map([["a", { selectedOptionId: "nope" }]]),
    });
    expect(off.itemResults[0]?.pointsAwarded).toBe(0);
    expect(negativeMarks(3, 33.33)).toBe(1);
    expect(hasObjectiveAnswer("mcq_multi", { selectedOptionIds: [] })).toBe(false);
    expect(hasObjectiveAnswer("fill_blank", { value: "  " })).toBe(false);
    expect(hasObjectiveAnswer("true_false", { value: false })).toBe(true);
  });
});

describe("random questions per attempt", () => {
  const items = ["q1", "q2", "q3", "q4", "q5"].map((id, index) => ({
    id,
    position: index + 1,
    options: [],
  }));

  it("draws the set size, keeps the quiz's order, and asks only those", () => {
    const order = planPresentationOrder({
      items,
      shuffleItems: false,
      shuffleOptions: false,
      drawCount: 3,
    });
    expect(order.drawn).toBe(true);
    expect(order.itemOrder).toHaveLength(3);
    const positions = order.itemOrder.map(
      (id) => items.find((item) => item.id === id)?.position ?? -1,
    );
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    // Stored and read back, only the drawn questions are shown, answered and marked.
    const stored = readPresentationOrder(JSON.parse(JSON.stringify(order)));
    expect(itemsInAttempt(items, stored).map((item) => item.id)).toEqual(order.itemOrder);
    expect(
      orderItems(items, { order: stored, attemptId: "a", shuffleItems: false }).map(
        (item) => item.id,
      ),
    ).toEqual(order.itemOrder);
  });

  it("asks everything when the draw covers the quiz, as before", () => {
    const order = planPresentationOrder({
      items,
      shuffleItems: false,
      shuffleOptions: false,
      drawCount: 9,
    });
    expect(order.drawn).toBeUndefined();
    expect(itemsInAttempt(items, order)).toHaveLength(5);
  });
});

describe("a save keeps what authors don't edit", () => {
  it("carries over granted attempts and the answer key version", () => {
    expect(
      preservedAssessmentConfig({
        createdByMembershipId: "m",
        passMarkPercent: 70,
        learnerAttemptGrants: { m2: 1 },
        answerKeyVersion: "v2",
      }),
    ).toEqual({ learnerAttemptGrants: { m2: 1 }, answerKeyVersion: "v2" });
  });
});

function question(itemId: string, points: string, answered = false): DraftQuestion {
  return {
    itemId,
    points,
    answered,
    itemTypeKey: "mcq_single",
    contentJson: { stem: itemId },
    itemStatus: "PUBLISHED",
  };
}

describe("the quiz editor in the lesson", () => {
  it("says what a learner faces", () => {
    expect(marksSummary(DEFAULT_QUIZ_SETTINGS, [])).toBe("No questions yet");
    expect(marksSummary(DEFAULT_QUIZ_SETTINGS, [question("a", "4"), question("b", "6")])).toBe(
      "2 questions · 10 marks · pass at 7 marks (70%)",
    );
    expect(
      marksSummary({ ...DEFAULT_QUIZ_SETTINGS, questionsPerAttempt: 2 }, [
        question("a", "1"),
        question("b", "1"),
        question("c", "1"),
      ]),
    ).toBe("Each attempt asks 2 of 3 questions, picked at random · pass at 70%");
    expect(negativeMarkingSummary(0)).toBe("Wrong answers lose nothing.");
    expect(negativeMarkingSummary(25)).toBe(
      "A wrong answer loses a quarter of the question's marks; a question left blank loses nothing.",
    );
  });

  it("says when learners see it", () => {
    expect(quizLiveState({ lessonLive: false, quizStatus: null, questionCount: 0 }).tone).toBe(
      "empty",
    );
    expect(quizLiveState({ lessonLive: false, quizStatus: "DRAFT", questionCount: 2 })).toEqual({
      tone: "waiting",
      text: "Goes live with this lesson. There's no separate approval for the quiz.",
    });
    expect(
      quizLiveState({ lessonLive: true, quizStatus: "PUBLISHED", questionCount: 2 }).tone,
    ).toBe("live");
  });

  it("names what to fix before saving, and sends the questions in order", () => {
    expect(quizDraftProblem(DEFAULT_QUIZ_SETTINGS, [question("a", "")])).toBe(
      "Question 1 needs marks: a number from 0 to 10,000.",
    );
    expect(
      quizDraftProblem({ ...DEFAULT_QUIZ_SETTINGS, questionsPerAttempt: 2 }, [
        question("a", "1"),
        question("b", "1"),
      ]),
    ).toMatch(/fewer than all 2/);
    expect(quizDraftProblem(DEFAULT_QUIZ_SETTINGS, [question("a", "1.5")])).toBeNull();
    expect(saveBody(DEFAULT_QUIZ_SETTINGS, [question("b", "2"), question("a", "0")])).toEqual({
      settings: DEFAULT_QUIZ_SETTINGS,
      questions: [
        { itemId: "b", points: 2 },
        { itemId: "a", points: 0 },
      ],
    });
    expect(draftFingerprint(DEFAULT_QUIZ_SETTINGS, [question("a", "1")])).toBe(
      draftFingerprint(DEFAULT_QUIZ_SETTINGS, [question("a", " 1 ")]),
    );
  });

  it("gives the reviewer the quiz's rules in one line", () => {
    expect(
      reviewQuizRules({
        assessmentId: "00000000-0000-4000-8000-000000000001",
        title: "Quiz",
        lessonTitle: "Quiz",
        sectionTitle: "Risk",
        passMarkPercent: 70,
        attemptsAllowed: 2,
        timeLimitSeconds: 600,
        questionsPerAttempt: 2,
        negativeMarkPercent: 25,
        totalMarks: 5,
        questions: [1, 2, 3].map((position) => ({
          position,
          itemTypeKey: "mcq_single",
          contentJson: {},
          points: 1,
          choices: [],
          correctAnswer: [],
          correctAnswerLabel: "Correct answer",
          explanation: null,
        })),
      }),
    ).toBe(
      "2 of 3 questions per attempt, at random · 5 marks · pass at 70% · 2 attempts · 10 min · wrong answers lose 25%",
    );
  });
});
