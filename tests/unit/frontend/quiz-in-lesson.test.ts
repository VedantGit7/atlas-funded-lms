import { describe, expect, it, vi } from "vitest";
import { createElement } from "../../../frontend/apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../frontend/apps/web/node_modules/react-dom/server.node.js";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { LessonQuizCard } =
  await import("../../../frontend/apps/web/src/features/lessons/lesson-quiz-card");
const { AttemptResultPanel } =
  await import("../../../frontend/apps/web/src/features/assessments/components/attempt-result");
const { ItemResponseRenderer, previewOrderingStart } =
  await import("../../../frontend/apps/web/src/features/item-registry/components/renderers/item-response-renderer");
const { scorePreviewAnswer } =
  await import("../../../frontend/packages/contracts/src/item-registry/answer-contracts");

/**
 * S1.3 on the learner's side (QA review 1 C6, M47, N1, m23; review 2 C5,
 * H23): the quiz card inside a lesson, the readable result, matching and
 * ordering from the server's choices, and plain preview feedback.
 */

const QUIZ = {
  title: "Risk basics",
  available: true,
  questionCount: 4,
  passMarkPercent: 75,
  timeLimitSeconds: 600,
  attemptsAllowed: 3,
  attemptsUsed: 0,
  attemptsRemaining: 3,
  proctoringLevel: 0,
  inProgressAttemptId: null,
  bestScorePercent: null,
  passed: false,
  lastAttempt: null,
};
const card = (quiz: Partial<typeof QUIZ> & Record<string, unknown> = {}, preview = false) =>
  renderToStaticMarkup(
    createElement(LessonQuizCard, { assessmentId: "a-1", quiz: { ...QUIZ, ...quiz }, preview }),
  );

describe("quiz card in a lesson", () => {
  it("shows the rules and a Start button", () => {
    const html = card();
    expect(html).toContain("Risk basics");
    expect(html).toContain("75%");
    expect(html).toContain("10 minutes");
    expect(html).toContain("3 of 3");
    expect(html).toContain("Start quiz");
    expect(html).not.toContain("Pass the quiz to complete this lesson.");
  });

  it("resumes an attempt in progress", () => {
    const html = card({ inProgressAttemptId: "att-1" });
    expect(html).toContain("Resume quiz");
    expect(html).toContain('href="/attempts/att-1"');
  });

  it("offers a retake after a fail, with the last result", () => {
    const html = card({
      attemptsUsed: 1,
      attemptsRemaining: 2,
      lastAttempt: { id: "att-2", status: "GRADED", scorePercent: 50, passed: false },
    });
    expect(html).toContain("Retake quiz");
    expect(html).toContain("Last attempt: 50%, not a pass.");
    expect(html).toContain('href="/attempts/att-2/result"');
  });

  it("shows a pass, and no attempts left", () => {
    expect(card({ passed: true, bestScorePercent: 90 })).toContain("Passed · best 90%");
    expect(card({ attemptsUsed: 3, attemptsRemaining: 0 })).toContain("used all your attempts");
  });

  it("is switched off in the Studio preview and before publishing", () => {
    expect(card({}, true)).toMatch(/<button[^>]*disabled[^>]*>Start quiz<\/button>/);
    expect(card({}, true)).toContain("Learners complete this lesson by passing the quiz.");
    expect(card({ available: false })).toContain("isn&#x27;t open yet");
  });
});

describe("attempt result", () => {
  const attempt = {
    id: "33333333-3333-4333-8333-333333333333",
    assessmentId: "44444444-4444-4444-8444-444444444444",
    status: "GRADED" as const,
    startedAt: "2026-11-22T10:00:00.000Z",
    submittedAt: "2026-11-22T10:05:00.000Z",
    dueAt: null,
    serverNow: "2026-11-22T10:05:00.000Z",
    secureMode: false,
    proctoringLevel: 0 as const,
    l1ProctoringEnabled: false,
    canReviewAnswers: true,
    scorePercent: 50,
    passed: false,
    requiresManualGrading: false,
    passMarkPercent: 75,
    title: "Risk basics",
    lesson: {
      courseId: "55555555-5555-4555-8555-555555555555",
      lessonId: "66666666-6666-4666-8666-666666666666",
      title: "Quiz lesson",
    },
    items: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        assessmentItemId: "88888888-8888-4888-8888-888888888888",
        itemId: "77777777-7777-4777-8777-777777777777",
        itemTypeKey: "ordering",
        position: 1,
        points: 1,
        required: true,
        contentJson: { stem: "Order the steps" },
        options: [],
        savedAnswer: { order: ["step-2", "step-1"] },
        review: {
          isCorrect: false,
          pointsAwarded: 0,
          points: 1,
          markedByInstructor: false,
          yourAnswer: ["1. Two", "2. One"],
          correctAnswer: ["1. One", "2. Two"],
          correctAnswerLabel: "Correct order",
          explanation: "One comes first.",
        },
      },
    ],
  };

  it("shows the score, the answers in words and the way back, never JSON", () => {
    const html = renderToStaticMarkup(createElement(AttemptResultPanel, { attempt }));
    expect(html).toContain("50%");
    expect(html).toContain("Not passed");
    expect(html).toContain("1. Two");
    expect(html).toContain("Correct order");
    expect(html).toContain("One comes first.");
    expect(html).toContain("Back to lesson to try again");
    expect(html).toContain(
      `/courses/${attempt.lesson.courseId}/lessons/${attempt.lesson.lessonId}`,
    );
    expect(html).not.toContain("step-2");
    expect(html).not.toContain("{");
  });

  it("waits for marking when an instructor still has to grade", () => {
    const html = renderToStaticMarkup(
      createElement(AttemptResultPanel, {
        attempt: {
          ...attempt,
          status: "SUBMITTED",
          scorePercent: null,
          passed: null,
          requiresManualGrading: true,
        },
      }),
    );
    expect(html).toContain("Waiting for marking");
    expect(html).not.toContain("Not passed");
  });
});

describe("matching and ordering questions", () => {
  it("uses the server's choices in an attempt", () => {
    const html = renderToStaticMarkup(
      createElement(ItemResponseRenderer, {
        itemTypeKey: "ordering",
        stem: "Order",
        mode: "attempt",
        choices: {
          kind: "ordering",
          items: [
            { id: "c1", label: "Second" },
            { id: "c2", label: "First" },
          ],
        },
      }),
    );
    expect(html.indexOf("Second")).toBeLessThan(html.indexOf("First"));
    expect(html).not.toContain("First step");

    const matching = renderToStaticMarkup(
      createElement(ItemResponseRenderer, {
        itemTypeKey: "matching",
        stem: "Match",
        mode: "attempt",
        choices: {
          kind: "matching",
          left: [{ id: "l", label: "Stop loss" }],
          right: [{ id: "r", label: "Caps a loss" }],
        },
      }),
    );
    expect(matching).toContain("Stop loss");
    expect(matching).toContain("Caps a loss");
  });

  it("never previews ordering steps in the correct order", () => {
    for (let size = 2; size <= 8; size += 1) {
      const items = Array.from({ length: size }, (_, index) => ({
        id: `step-${String(index + 1)}`,
        label: `Step ${String(index + 1)}`,
      }));
      const start = previewOrderingStart(items);
      expect(start.map((item) => item.id)).not.toEqual(items.map((item) => item.id));
      expect(start).toHaveLength(size);
    }
  });
});

describe("preview feedback in plain words", () => {
  it("says what is right or wrong without technical terms", () => {
    const check = (
      itemTypeKey: string,
      answerKey: Record<string, unknown>,
      answerJson: Record<string, unknown> | null,
    ) => scorePreviewAnswer({ itemTypeKey, answerKey, answerJson, options: [] });
    const messages = [
      check("true_false", { value: true }, { value: false }),
      check("fill_blank", { acceptedValues: ["stop"] }, { value: "go" }),
      check("ordering", { order: ["a", "b"] }, { order: ["b", "a"] }),
      check("matching", { pairs: { a: "1" } }, { pairs: { a: "2" } }),
      check("mcq_single", { correctOptionId: "x" }, null),
    ];
    for (const message of messages) {
      expect(`${message.title} ${message.detail}`).not.toMatch(/answer key|response|structured/i);
    }
    expect(messages[0]?.detail).toBe("That's not right. The answer is True.");
  });

  it("checks matching pair by pair, in any order", () => {
    expect(
      scorePreviewAnswer({
        itemTypeKey: "matching",
        answerKey: { pairs: { a: "1", b: "2" } },
        answerJson: { pairs: { b: "2", a: "1" } },
        options: [],
      }).kind,
    ).toBe("correct");
  });
});
