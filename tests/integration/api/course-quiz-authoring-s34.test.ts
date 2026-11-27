import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import {
  getAttempt,
  saveAttemptAnswer,
  startAttempt,
  submitAttempt,
} from "../../../backend/apps/api/src/server/attempts/attempts.service";
import {
  createCourseModule,
  submitCourseForReview,
} from "../../../backend/apps/api/src/server/courses/course-authoring.service";
import { createLesson } from "../../../backend/apps/api/src/server/lessons/lessons.service";
import { createLessonBodySchema } from "../../../backend/apps/api/src/server/lessons/lesson-schemas";
import {
  getLessonQuiz,
  putLessonQuiz,
} from "../../../backend/apps/api/src/server/lessons/lesson-quiz.service";
import {
  lessonQuizResponseSchema,
  type LessonQuizSettings,
} from "../../../backend/apps/api/src/server/lessons/lesson-quiz.schemas";
import { actOnWorkflowTransition } from "../../../backend/apps/api/src/server/workflows/workflows.service";
import { getWorkflowContent } from "../../../backend/apps/api/src/server/workflows/workflow-content.service";
import { workflowContentResponseSchema } from "../../../backend/apps/api/src/server/workflows/workflow-content.schemas";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  instructorCtx,
  learnerCtx,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

/**
 * QA remediation S3.4a (review 1 M26, review 2 4.1): a course's quiz is
 * written inside its lesson, named after it, has no review of its own and goes
 * live with the lesson; it can ask a random selection of its questions, take
 * marks for wrong answers, and the reviewer sees its questions.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const SETTINGS: LessonQuizSettings = {
  attemptsAllowed: 3,
  timeLimitSeconds: null,
  passMarkPercent: 50,
  shuffleItems: false,
  shuffleOptions: false,
  showAnswersPolicy: "after_submit",
  questionsPerAttempt: null,
  negativeMarkPercent: 0,
};

type Mcq = { itemId: string; correctId: string; wrongId: string };

async function insertMcq(
  tx: TenantTx,
  fixture: CourseAuthoringFixture,
  stem: string,
): Promise<Mcq> {
  const itemId = randomUUID();
  const correctId = randomUUID();
  const wrongId = randomUUID();
  await tx.$executeRaw`
    insert into items (id, tenant_id, item_type_key, stem_json, explanation_json, status, tags,
                       created_by_membership_id, created_at, updated_at)
    values (${itemId}::uuid, ${fixture.tenantId}::uuid, 'mcq_single', ${JSON.stringify({ stem })}::jsonb,
            ${JSON.stringify({ answerKey: { correctOptionId: correctId, explanation: "Because." } })}::jsonb,
            'DRAFT', '{}'::text[], ${fixture.instructorMembershipId}::uuid, now(), now())
  `;
  await tx.$executeRaw`
    insert into item_options (id, tenant_id, item_id, option_json, is_correct, position, created_at, updated_at)
    values
      (${correctId}::uuid, ${fixture.tenantId}::uuid, ${itemId}::uuid, ${JSON.stringify({ label: "Right" })}::jsonb, true, 1, now(), now()),
      (${wrongId}::uuid, ${fixture.tenantId}::uuid, ${itemId}::uuid, ${JSON.stringify({ label: "Wrong" })}::jsonb, false, 2, now(), now())
  `;
  return { itemId, correctId, wrongId };
}

/** A draft course with one section holding two quiz lessons both called "Quiz", and four questions. */
async function setUp() {
  const fixture = await createCourseAuthoringFixture();
  const instructor = instructorCtx(fixture);
  const built = await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    const section = await createCourseModule(tx, instructor, fixture.draftCourseId, {
      title: "Risk",
    });
    const lesson = (title: string, slug: string) =>
      createLesson(
        tx,
        instructor,
        section.data.id,
        createLessonBodySchema.parse({ title, slug, lessonType: "section_quiz" }),
      );
    const first = await lesson("Quiz", "quiz-1");
    const second = await lesson("Quiz", "quiz-2");
    const questions = [];
    for (const stem of ["Q one", "Q two", "Q three", "Q four"]) {
      questions.push(await insertMcq(tx, fixture, stem));
    }
    return { firstLessonId: first.data.id, secondLessonId: second.data.id, questions };
  });
  const [q1, q2, q3] = built.questions;
  if (!q1 || !q2 || !q3) throw new Error("setUp made too few questions");
  return { fixture, ...built, q1, q2, q3 };
}

function must<T>(value: T | null | undefined, what: string): T {
  if (value == null) throw new Error(`Expected ${what}`);
  return value;
}

function asInstructor<T>(fixture: CourseAuthoringFixture, run: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(authoringTenantTx(fixture), run);
}

function asAdmin<T>(fixture: CourseAuthoringFixture, run: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), run);
}

function asLearner<T>(fixture: CourseAuthoringFixture, run: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), run);
}

async function approveCourse(fixture: CourseAuthoringFixture) {
  const submitted = await asInstructor(fixture, (tx) =>
    submitCourseForReview(tx, instructorCtx(fixture), fixture.draftCourseId, {}),
  );
  const transitionId = submitted.data.workflowTransitionId;
  const content = await asAdmin(fixture, (tx) => getWorkflowContent(tx, transitionId));
  await asAdmin(fixture, (tx) =>
    actOnWorkflowTransition(tx, adminCtx(fixture), transitionId, { action: "approve" }),
  );
  return workflowContentResponseSchema.parse(content).data;
}

async function quizRow(fixture: CourseAuthoringFixture, assessmentId: string) {
  const rows = await asAdmin(
    fixture,
    (tx) => tx.$queryRaw<
      Array<{ title: string; slug: string; status: string; config_json: unknown }>
    >`
      select title, slug, status::text, config_json from assessments where id = ${assessmentId}::uuid
    `,
  );
  return rows[0];
}

describeWithDb("a course's quiz, written in its lesson (S3.4a)", () => {
  it("is named after the lesson, waits as a draft and goes live with the course, without a review of its own", async () => {
    const { fixture, firstLessonId, secondLessonId, q1, q2 } = await setUp();

    const saved = await asInstructor(fixture, (tx) =>
      putLessonQuiz(tx, instructorCtx(fixture), firstLessonId, {
        settings: SETTINGS,
        questions: [
          { itemId: q1.itemId, points: 1 },
          { itemId: q2.itemId, points: 2 },
        ],
      }),
    );
    const quiz = lessonQuizResponseSchema.parse(saved).data;
    expect(quiz).toMatchObject({ lessonTitle: "Quiz", editable: true, lessonLive: false });
    expect(quiz.quiz).toMatchObject({ status: "DRAFT", totalMarks: 3, settings: SETTINGS });
    expect(quiz.quiz?.questions.map((question) => question.itemId)).toEqual([q1.itemId, q2.itemId]);
    // Draft questions from the bank are fine in a quiz.
    expect(quiz.quiz?.questions[0]?.itemStatus).toBe("DRAFT");

    const row = await quizRow(fixture, must(quiz.quiz, "a quiz").id);
    expect(row?.title).toBe("Quiz"); // no " - Quiz" suffix

    // A second lesson with the same title gets its own quiz (no slug clash); it has no questions.
    const second = await asInstructor(fixture, (tx) =>
      putLessonQuiz(tx, instructorCtx(fixture), secondLessonId, {
        settings: SETTINGS,
        questions: [],
      }),
    );
    expect(second.data.quiz?.id).not.toBe(quiz.quiz?.id);

    // Reading it back keeps the lesson's own content (its type) and the link.
    const again = await asInstructor(fixture, (tx) =>
      getLessonQuiz(tx, instructorCtx(fixture), firstLessonId),
    );
    expect(again.data.quiz?.id).toBe(quiz.quiz?.id);

    // The reviewer sees both quizzes and their questions with the right answers.
    const content = await approveCourse(fixture);
    expect(content.quizzes.map((entry) => entry.lessonTitle)).toEqual(["Quiz", "Quiz"]);
    expect(content.quizzes[0]).toMatchObject({ sectionTitle: "Risk", totalMarks: 3 });
    expect(content.quizzes[0]?.questions[0]).toMatchObject({
      points: 1,
      choices: [
        { label: "Right", correct: true },
        { label: "Wrong", correct: false },
      ],
      explanation: "Because.",
    });
    expect(content.quizzes[1]?.questions).toEqual([]);

    // Approving the course published the quiz with questions; the empty one waits.
    expect((await quizRow(fixture, must(quiz.quiz, "a quiz").id))?.status).toBe("PUBLISHED");
    expect((await quizRow(fixture, must(second.data.quiz, "a quiz").id))?.status).toBe("DRAFT");

    // In the live course, saving questions puts the empty quiz live at once.
    const live = await asInstructor(fixture, (tx) =>
      putLessonQuiz(tx, instructorCtx(fixture), secondLessonId, {
        settings: SETTINGS,
        questions: [{ itemId: q1.itemId, points: 1 }],
      }),
    );
    expect(live.data).toMatchObject({ lessonLive: true, quiz: { status: "PUBLISHED" } });
  });

  it("keeps questions learners have answered, and keeps their answers through edits", async () => {
    const { fixture, firstLessonId, q1, q2, q3 } = await setUp();
    const saved = await asInstructor(fixture, (tx) =>
      putLessonQuiz(tx, instructorCtx(fixture), firstLessonId, {
        settings: SETTINGS,
        questions: [
          { itemId: q1.itemId, points: 1 },
          { itemId: q2.itemId, points: 1 },
        ],
      }),
    );
    const assessmentId = must(saved.data.quiz, "a quiz").id;
    await approveCourse(fixture);

    const learner = learnerCtx(fixture);
    await asLearner(fixture, async (tx) => {
      const attempt = await startAttempt(tx, learner, assessmentId, randomUUID());
      await saveAttemptAnswer(
        tx,
        learner,
        attempt.data.id,
        { itemId: q1.itemId, answerJson: { selectedOptionId: q1.correctId } },
        randomUUID(),
      );
      await submitAttempt(tx, learner, attempt.data.id, randomUUID());
    });

    const read = await asInstructor(fixture, (tx) =>
      getLessonQuiz(tx, instructorCtx(fixture), firstLessonId),
    );
    expect(read.data.quiz?.attemptCount).toBe(1);
    // Only the question the learner answered is locked; the one left blank isn't.
    expect(read.data.quiz?.questions.map((question) => question.answered)).toEqual([true, false]);

    // Removing an answered question is refused, in words.
    await expect(
      asInstructor(fixture, (tx) =>
        putLessonQuiz(tx, instructorCtx(fixture), firstLessonId, {
          settings: SETTINGS,
          questions: [{ itemId: q2.itemId, points: 1 }],
        }),
      ),
    ).rejects.toThrow(/already answered/);

    // Reordering, new marks and a new question are fine, and the answers stay.
    const edited = await asInstructor(fixture, (tx) =>
      putLessonQuiz(tx, instructorCtx(fixture), firstLessonId, {
        settings: { ...SETTINGS, passMarkPercent: 80 },
        questions: [
          { itemId: q2.itemId, points: 3 },
          { itemId: q1.itemId, points: 0 },
          { itemId: q3.itemId, points: 1 },
        ],
      }),
    );
    expect(edited.data.quiz).toMatchObject({ status: "PUBLISHED", totalMarks: 4 });
    const answers = await asAdmin(
      fixture,
      (tx) => tx.$queryRaw<Array<{ count: number }>>`
        select count(*)::int as count from attempt_answers aa
        inner join assessment_items ai on ai.id = aa.assessment_item_id
        where ai.assessment_id = ${assessmentId}::uuid
      `,
    );
    expect(answers[0]?.count).toBe(1);
  });

  it("asks a random selection per attempt and takes marks for wrong answers, never below zero", async () => {
    const { fixture, firstLessonId, questions } = await setUp();
    const saved = await asInstructor(fixture, (tx) =>
      putLessonQuiz(tx, instructorCtx(fixture), firstLessonId, {
        settings: { ...SETTINGS, questionsPerAttempt: 2, negativeMarkPercent: 50 },
        questions: questions.map((question) => ({ itemId: question.itemId, points: 2 })),
      }),
    );
    const assessmentId = must(saved.data.quiz, "a quiz").id;
    await approveCourse(fixture);

    const learner = learnerCtx(fixture);
    const result = await asLearner(fixture, async (tx) => {
      const attempt = await startAttempt(tx, learner, assessmentId, randomUUID());
      const runner = await getAttempt(tx, learner, attempt.data.id);
      const asked = runner.data.items.map((item) => item.itemId);
      expect(asked).toHaveLength(2);

      // A question outside this attempt's draw can't be answered.
      const notAsked = must(
        questions.find((question) => !asked.includes(question.itemId)),
        "a question outside the draw",
      );
      await expect(
        saveAttemptAnswer(
          tx,
          learner,
          attempt.data.id,
          { itemId: notAsked.itemId, answerJson: { selectedOptionId: notAsked.correctId } },
          randomUUID(),
        ),
      ).rejects.toThrow();

      // One wrong answer, one left blank.
      const first = must(
        questions.find((question) => question.itemId === asked[0]),
        "the first drawn question",
      );
      await saveAttemptAnswer(
        tx,
        learner,
        attempt.data.id,
        { itemId: first.itemId, answerJson: { selectedOptionId: first.wrongId } },
        randomUUID(),
      );
      const submitted = await submitAttempt(tx, learner, attempt.data.id, randomUUID());
      const marks = await tx.$queryRaw<Array<{ points: number }>>`
        select points_awarded::float as points from attempt_answers
        where attempt_id = ${attempt.data.id}::uuid
      `;
      return { submitted: submitted.data, marks: marks.map((row) => row.points) };
    });

    // The wrong answer lost half its 2 marks; the blank lost nothing; the total floors at 0.
    expect(result.marks).toEqual([-1]);
    expect(result.submitted).toMatchObject({ status: "GRADED", scorePercent: 0, passed: false });
  });

  it("keeps extra attempts granted to learners when the quiz is saved", async () => {
    const { fixture, firstLessonId, q1 } = await setUp();
    const saved = await asInstructor(fixture, (tx) =>
      putLessonQuiz(tx, instructorCtx(fixture), firstLessonId, {
        settings: SETTINGS,
        questions: [{ itemId: q1.itemId, points: 1 }],
      }),
    );
    const assessmentId = must(saved.data.quiz, "a quiz").id;
    await asAdmin(
      fixture,
      (tx) => tx.$executeRaw`
        update assessments
        set config_json = config_json || ${JSON.stringify({
          learnerAttemptGrants: { [fixture.learnerMembershipId]: 2 },
        })}::jsonb
        where id = ${assessmentId}::uuid
      `,
    );
    await asInstructor(fixture, (tx) =>
      putLessonQuiz(tx, instructorCtx(fixture), firstLessonId, {
        settings: { ...SETTINGS, attemptsAllowed: 5 },
        questions: [{ itemId: q1.itemId, points: 1 }],
      }),
    );
    const config = (await quizRow(fixture, assessmentId))?.config_json as Record<string, unknown>;
    expect(config["learnerAttemptGrants"]).toEqual({ [fixture.learnerMembershipId]: 2 });
    expect(config["attemptsAllowed"]).toBe(5);
  });
});
