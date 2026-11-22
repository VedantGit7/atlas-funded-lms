import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import {
  getAttempt,
  saveAttemptAnswer,
  startAttempt,
  submitAttempt,
} from "../../../backend/apps/api/src/server/attempts/attempts.service";
import { publishAssessmentForTests } from "../../../backend/apps/api/src/server/assessments/assessments.service";
import { gradeGradingTask } from "../../../backend/apps/api/src/server/grading/grading.service";
import { recordLessonProgress } from "../../../backend/apps/api/src/server/lessons/lesson-progress.service";
import { getLessonForPlayer } from "../../../backend/apps/api/src/server/lessons/lessons.service";
import { attemptRunnerResponseSchema } from "../../../backend/apps/api/src/server/assessments/assessment-response-schemas";
import { learnerLessonDetailResponseSchema } from "../../../backend/apps/api/src/server/lessons/lesson-schemas";
import {
  authoringTenantTx,
  createAssessmentFixture,
  instructorCtx,
  learnerCtx,
  publishAssessmentFixture,
  type AssessmentFixture,
} from "../../fixtures/assessment-fixture";

/**
 * S1.3 against Postgres (QA review 1 C6, C7, M47, N1; review 2 C5, H23):
 * - a quiz lesson shows the quiz's rules and the learner's standing;
 * - matching and ordering questions can be answered in a real attempt, with
 *   their items shown but none of the answer key's ids;
 * - answers given in the attempt's tokens are graded correctly;
 * - the result reviews each answer in words;
 * - passing completes the lesson (automatic or instructor grade), failing
 *   doesn't, and "Mark complete" can't skip the quiz.
 */
const suite =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const MATCHING_KEY = {
  pairs: { "left-1": "right-1", "left-2": "right-2", "left-3": "right-3" },
  leftItems: { "left-1": "Stop loss", "left-2": "Take profit", "left-3": "Leverage" },
  rightItems: {
    "right-1": "Exit that caps a loss",
    "right-2": "Exit that locks a gain",
    "right-3": "Borrowed exposure",
  },
  explanation: "Each order type has one job.",
};
const ORDERING_KEY = {
  order: ["step-1", "step-2", "step-3", "step-4"],
  items: {
    "step-1": "Mark the level",
    "step-2": "Wait for the close",
    "step-3": "Size the position",
    "step-4": "Place the order",
  },
};

type Quiz = {
  assessmentId: string;
  mcqItemId: string;
  correctOptionId: string;
  wrongOptionId: string;
  matchingItemId: string;
  orderingItemId: string;
  swipeItemId: string;
};

async function insertItem(
  tx: TenantTx,
  fixture: AssessmentFixture,
  type: string,
  stem: string,
  answerKey: Record<string, unknown>,
) {
  const id = randomUUID();
  await tx.$executeRaw`
    insert into items (id, tenant_id, item_type_key, stem_json, explanation_json, status, tags,
                       created_by_membership_id, created_at, updated_at)
    values (${id}::uuid, ${fixture.tenantId}::uuid, ${type}, ${JSON.stringify({ stem })}::jsonb,
            ${JSON.stringify({ answerKey })}::jsonb, 'PUBLISHED', '{}'::text[],
            ${fixture.instructorMembershipId}::uuid, now(), now())
  `;
  return id;
}

/** A published quiz with one question of each auto-graded kind that S1.3 touched. */
async function createQuiz(fixture: AssessmentFixture): Promise<Quiz> {
  return withTenantTx(authoringTenantTx(fixture), async (tx) => {
    const options = await tx.$queryRaw<Array<{ id: string; is_correct: boolean | null }>>`
      select id::text, is_correct from item_options where item_id = ${fixture.mcqItemId}::uuid
    `;
    const matchingItemId = await insertItem(
      tx,
      fixture,
      "matching",
      "Match each term",
      MATCHING_KEY,
    );
    const orderingItemId = await insertItem(
      tx,
      fixture,
      "ordering",
      "Put the steps in order",
      ORDERING_KEY,
    );
    const swipeItemId = await insertItem(tx, fixture, "swipe", "A stop loss limits risk", {
      direction: "right",
    });
    const assessmentId = randomUUID();
    await tx.$executeRaw`
      insert into assessments (id, tenant_id, slug, title, assessment_type, status, config_json, created_at, updated_at)
      values (${assessmentId}::uuid, ${fixture.tenantId}::uuid, ${`s13-${assessmentId.slice(0, 8)}`},
              'Risk basics quiz', 'quiz', 'DRAFT', ${JSON.stringify({
                createdByMembershipId: fixture.instructorMembershipId,
                attemptsAllowed: 3,
                timeLimitSeconds: null,
                passMarkPercent: 75,
                shuffleItems: false,
                shuffleOptions: false,
                secureMode: false,
                proctoringLevel: 0,
                l1ProctoringEnabled: false,
                showAnswersPolicy: "after_submit",
              })}::jsonb, now(), now())
    `;
    const items = [fixture.mcqItemId, matchingItemId, orderingItemId, swipeItemId];
    for (const [index, itemId] of items.entries()) {
      await tx.$executeRaw`
        insert into assessment_items (id, tenant_id, assessment_id, item_id, position, points, config_json, created_at)
        values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${assessmentId}::uuid, ${itemId}::uuid,
                ${index + 1}, 1, '{"required":true}'::jsonb, now())
      `;
    }
    await publishAssessmentForTests(tx, assessmentId);
    return {
      assessmentId,
      mcqItemId: fixture.mcqItemId,
      correctOptionId: options.find((option) => option.is_correct)?.id ?? "",
      wrongOptionId: options.find((option) => !option.is_correct)?.id ?? "",
      matchingItemId,
      orderingItemId,
      swipeItemId,
    };
  });
}

/** A published course the learner is enrolled in, with one quiz lesson per quiz. */
async function createCourse(fixture: AssessmentFixture, assessmentIds: string[]) {
  return withTenantTx(authoringTenantTx(fixture), async (tx) => {
    const courseId = randomUUID();
    const moduleId = randomUUID();
    await tx.$executeRaw`
      insert into courses (id, tenant_id, slug, title, status, created_by_membership_id, created_at, updated_at)
      values (${courseId}::uuid, ${fixture.tenantId}::uuid, ${`s13-course-${courseId.slice(0, 8)}`},
              'Quiz course', 'PUBLISHED', ${fixture.instructorMembershipId}::uuid, now(), now())
    `;
    await tx.$executeRaw`
      insert into course_modules (id, tenant_id, course_id, title, position, status, created_at, updated_at)
      values (${moduleId}::uuid, ${fixture.tenantId}::uuid, ${courseId}::uuid, 'Quizzes', 1, 'PUBLISHED', now(), now())
    `;
    const lessonIds: string[] = [];
    for (const [index, assessmentId] of assessmentIds.entries()) {
      const lessonId = randomUUID();
      lessonIds.push(lessonId);
      await tx.$executeRaw`
        insert into lessons (id, tenant_id, module_id, slug, title, position, status, content_json, created_at, updated_at)
        values (${lessonId}::uuid, ${fixture.tenantId}::uuid, ${moduleId}::uuid, ${`quiz-${String(index)}`},
                ${`Quiz lesson ${String(index + 1)}`}, ${index + 1}, 'PUBLISHED',
                ${JSON.stringify({ type: "section_quiz", assessmentId, discussionPostId: randomUUID() })}::jsonb,
                now(), now())
      `;
    }
    await tx.$executeRaw`
      insert into enrollments (id, tenant_id, course_id, membership_id, status, enrolled_at)
      values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${courseId}::uuid,
              ${fixture.learnerMembershipId}::uuid, 'active', now())
    `;
    return { courseId, lessonIds };
  });
}

suite("quizzes inside lessons and the attempt (S1.3)", () => {
  let fixture: AssessmentFixture;
  let quiz: Quiz;
  let course: { courseId: string; lessonIds: string[] };

  const asLearner = <T>(fn: (tx: TenantTx) => Promise<T>) =>
    withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), fn);
  const runner = async (attemptId: string) =>
    attemptRunnerResponseSchema.parse(
      await asLearner((tx) => getAttempt(tx, learnerCtx(fixture), attemptId)),
    ).data;
  const start = () =>
    asLearner(
      async (tx) =>
        (await startAttempt(tx, learnerCtx(fixture), quiz.assessmentId, randomUUID())).data.id,
    );
  const save = (attemptId: string, itemId: string, answerJson: Record<string, unknown>) =>
    asLearner((tx) =>
      saveAttemptAnswer(tx, learnerCtx(fixture), attemptId, { itemId, answerJson }, randomUUID()),
    );
  const submit = (attemptId: string) =>
    asLearner((tx) => submitAttempt(tx, learnerCtx(fixture), attemptId, randomUUID()));
  const lessonStatus = (lessonId: string) =>
    asLearner(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: string }>>`
        select status::text from lesson_progress
         where lesson_id = ${lessonId}::uuid and membership_id = ${fixture.learnerMembershipId}::uuid
      `;
      return rows[0]?.status ?? "not_started";
    });
  const player = async (lessonId: string) =>
    learnerLessonDetailResponseSchema.parse(
      await asLearner((tx) => getLessonForPlayer(tx, learnerCtx(fixture), lessonId)),
    ).data;

  /** The correct answers, written in the attempt's tokens, read from the runner. */
  async function answerAll(attemptId: string, correct: boolean) {
    const data = await runner(attemptId);
    for (const item of data.items) {
      if (item.itemId === quiz.mcqItemId) {
        await save(attemptId, item.itemId, {
          selectedOptionId: correct ? quiz.correctOptionId : quiz.wrongOptionId,
        });
      } else if (item.choices?.kind === "matching") {
        const right = new Map(item.choices.right.map((choice) => [choice.label, choice.id]));
        const pairs: Record<string, string> = {};
        for (const left of item.choices.left) {
          const leftId =
            Object.entries(MATCHING_KEY.leftItems).find(([, l]) => l === left.label)?.[0] ?? "";
          const rightLabel =
            MATCHING_KEY.rightItems[
              MATCHING_KEY.pairs[
                leftId as keyof typeof MATCHING_KEY.pairs
              ] as keyof typeof MATCHING_KEY.rightItems
            ];
          pairs[left.id] = right.get(rightLabel) ?? "";
        }
        await save(attemptId, item.itemId, { pairs });
      } else if (item.choices?.kind === "ordering") {
        const byLabel = new Map(item.choices.items.map((choice) => [choice.label, choice.id]));
        const order = ORDERING_KEY.order.map(
          (id) => byLabel.get(ORDERING_KEY.items[id as keyof typeof ORDERING_KEY.items]) ?? "",
        );
        await save(attemptId, item.itemId, { order: correct ? order : [...order].reverse() });
      } else if (item.itemId === quiz.swipeItemId) {
        await save(attemptId, item.itemId, { action: correct ? "known" : "unknown" });
      }
    }
  }

  beforeAll(async () => {
    fixture = await publishAssessmentFixture(await createAssessmentFixture());
    quiz = await createQuiz(fixture);
    // Lesson 1: the auto-graded quiz. Lesson 2: the fixture's quiz with a
    // short answer, graded by an instructor.
    course = await createCourse(fixture, [quiz.assessmentId, fixture.assessmentId]);
  });

  it("shows the quiz's rules and the learner's standing in the lesson", async () => {
    const lesson = await player(course.lessonIds[0] ?? "");
    expect(lesson.content).toMatchObject({
      kind: "quiz",
      assessmentId: quiz.assessmentId,
      quiz: {
        title: "Risk basics quiz",
        available: true,
        questionCount: 4,
        passMarkPercent: 75,
        attemptsAllowed: 3,
        attemptsUsed: 0,
        attemptsRemaining: 3,
        inProgressAttemptId: null,
        passed: false,
        lastAttempt: null,
      },
    });
    expect(JSON.stringify(lesson)).not.toContain("discussionPostId");
  });

  it("refuses Mark complete on a quiz lesson", async () => {
    await expect(
      asLearner((tx) =>
        recordLessonProgress(tx, learnerCtx(fixture), course.lessonIds[0] ?? "", {
          completed: true,
        }),
      ),
    ).rejects.toMatchObject({ status: 409, message: "Pass the quiz to complete this lesson." });
    // Opening the lesson still records progress.
    await asLearner((tx) =>
      recordLessonProgress(tx, learnerCtx(fixture), course.lessonIds[0] ?? "", {}),
    );
    expect(await lessonStatus(course.lessonIds[0] ?? "")).toBe("in_progress");
  });

  it("shows matching and ordering items without the answer key's ids", async () => {
    const attemptId = await start();
    const data = await runner(attemptId);
    expect(data.title).toBe("Risk basics quiz");
    expect(data.lesson).toEqual({
      courseId: course.courseId,
      lessonId: course.lessonIds[0],
      title: "Quiz lesson 1",
    });

    const matching = data.items.find((item) => item.itemId === quiz.matchingItemId);
    const ordering = data.items.find((item) => item.itemId === quiz.orderingItemId);
    expect(matching?.choices?.kind).toBe("matching");
    expect(ordering?.choices?.kind).toBe("ordering");
    if (matching?.choices?.kind !== "matching" || ordering?.choices?.kind !== "ordering") return;

    expect(matching.choices.left.map((c) => c.label)).toEqual(
      Object.values(MATCHING_KEY.leftItems),
    );
    expect(new Set(matching.choices.right.map((c) => c.label))).toEqual(
      new Set(Object.values(MATCHING_KEY.rightItems)),
    );
    expect(ordering.choices.items.map((c) => c.label)).not.toEqual(
      ORDERING_KEY.order.map((id) => ORDERING_KEY.items[id as keyof typeof ORDERING_KEY.items]),
    );

    const json = JSON.stringify(data);
    for (const leaked of ["left-1", "right-1", "step-1", "pairs", "explanation", "isCorrect"]) {
      expect(json).not.toContain(leaked);
    }

    // The same tokens and order on every fetch.
    const again = await runner(attemptId);
    expect(again.items.map((item) => item.choices)).toEqual(data.items.map((item) => item.choices));

    // A wrong attempt: graded, not a pass, and the lesson stays open.
    await answerAll(attemptId, false);
    const result = await submit(attemptId);
    expect(result.data).toMatchObject({ status: "GRADED", passed: false });
    expect(await lessonStatus(course.lessonIds[0] ?? "")).toBe("in_progress");
    const lesson = await player(course.lessonIds[0] ?? "");
    expect(lesson.content).toMatchObject({
      quiz: {
        attemptsUsed: 1,
        attemptsRemaining: 2,
        passed: false,
        lastAttempt: { passed: false },
      },
    });
  });

  it("grades answers given in tokens, reviews them in words, and completes the lesson on a pass", async () => {
    const attemptId = await start();
    await answerAll(attemptId, true);

    // A reload shows the saved answers in the same tokens.
    const reloaded = await runner(attemptId);
    const ordering = reloaded.items.find((item) => item.itemId === quiz.orderingItemId);
    if (ordering?.choices?.kind !== "ordering") throw new Error("no ordering choices");
    const tokens = new Set(ordering.choices.items.map((choice) => choice.id));
    expect((ordering.savedAnswer?.["order"] as string[]).every((id) => tokens.has(id))).toBe(true);

    const result = await submit(attemptId);
    expect(result.data).toMatchObject({ status: "GRADED", scorePercent: 100, passed: true });

    const review = await runner(attemptId);
    const byItem = new Map(review.items.map((item) => [item.itemId, item.review]));
    expect(byItem.get(quiz.mcqItemId)).toMatchObject({ isCorrect: true, yourAnswer: ["Paris"] });
    expect(byItem.get(quiz.matchingItemId)).toMatchObject({
      isCorrect: true,
      yourAnswer: [
        "Stop loss → Exit that caps a loss",
        "Take profit → Exit that locks a gain",
        "Leverage → Borrowed exposure",
      ],
      explanation: "Each order type has one job.",
    });
    expect(byItem.get(quiz.orderingItemId)).toMatchObject({
      isCorrect: true,
      yourAnswer: [
        "1. Mark the level",
        "2. Wait for the close",
        "3. Size the position",
        "4. Place the order",
      ],
    });
    expect(byItem.get(quiz.swipeItemId)).toMatchObject({ isCorrect: true, yourAnswer: ["Known"] });

    expect(await lessonStatus(course.lessonIds[0] ?? "")).toBe("completed");
    // Passing one quiz doesn't complete another quiz's lesson.
    expect(await lessonStatus(course.lessonIds[1] ?? "")).toBe("not_started");
    const lesson = await player(course.lessonIds[0] ?? "");
    expect(lesson.content).toMatchObject({ quiz: { passed: true, bestScorePercent: 100 } });
    expect(lesson.progress.status).toBe("completed");
  });

  it("completes the lesson when an instructor's grade makes it a pass", async () => {
    const learner = learnerCtx(fixture);
    const attemptId = await asLearner(
      async (tx) => (await startAttempt(tx, learner, fixture.assessmentId, randomUUID())).data.id,
    );
    await asLearner(async (tx) => {
      await saveAttemptAnswer(
        tx,
        learner,
        attemptId,
        { itemId: fixture.mcqItemId, answerJson: { selectedOptionId: quiz.correctOptionId } },
        randomUUID(),
      );
      await saveAttemptAnswer(
        tx,
        learner,
        attemptId,
        { itemId: fixture.shortAnswerItemId, answerJson: { value: "Cap each loss." } },
        randomUUID(),
      );
      await submitAttempt(tx, learner, attemptId, randomUUID());
    });
    expect(await lessonStatus(course.lessonIds[1] ?? "")).toBe("not_started");

    const [task] = await withTenantTx(
      authoringTenantTx(fixture),
      (tx) =>
        tx.$queryRaw<Array<{ id: string }>>`
        select id::text from grading_tasks where attempt_id = ${attemptId}::uuid limit 1
      `,
    );
    await withTenantTx(authoringTenantTx(fixture), (tx) =>
      gradeGradingTask(
        tx,
        { ...instructorCtx(fixture), idempotencyKey: `grade-${randomUUID()}` },
        task?.id ?? "",
        { score: 1, feedback: "Good." },
      ),
    );
    expect(await lessonStatus(course.lessonIds[1] ?? "")).toBe("completed");
  });

  it("completes a quiz lesson on the next visit when the quiz was passed earlier", async () => {
    // The learner passed this quiz above, before enrolling in this course (and
    // learners on staging passed quizzes before passing completed lessons).
    const later = await createCourse(fixture, [quiz.assessmentId]);
    const lessonId = later.lessonIds[0] ?? "";
    expect(await lessonStatus(lessonId)).toBe("not_started");

    // Opening the lesson records progress, which completes it.
    const saved = await asLearner((tx) =>
      recordLessonProgress(tx, learnerCtx(fixture), lessonId, {}),
    );
    expect(saved.data.status).toBe("completed");
    expect(await lessonStatus(lessonId)).toBe("completed");
  });
});
