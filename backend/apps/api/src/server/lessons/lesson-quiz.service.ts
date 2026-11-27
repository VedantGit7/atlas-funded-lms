import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  assessmentsRepository,
  buildAssessmentConfigJson,
  extractAssessmentConfig,
  preservedAssessmentConfig,
  readCreatedByMembershipId,
  readDescription,
  type AssessmentRow,
} from "../assessments/assessments.repository";
import { saveAssessmentItems } from "../assessments/assessments.service";
import { AssessmentConfigSchema, type AssessmentConfig } from "../assessments/schemas";
import { canEditCourseContent } from "../courses/course-state-guards";
import { itemRegistryRepository } from "../item-registry/item-registry.repository";
import { lessonNotFound } from "./lessons.errors";
import {
  findLessonWithModuleAndCourse,
  resolveLessonType,
  type LessonRow,
} from "./lessons.repository";
import type { LessonQuiz, LessonQuizSettings, PutLessonQuizBody } from "./lesson-quiz.schemas";
import { quizAssessmentIdOf } from "./quiz-lessons";

/**
 * The quiz of a course's quiz lesson, edited inside the course (QA review 1
 * M26, review 2 4.1; S3.4).
 *
 * Who may: whoever may edit the course (the route's `course.read` /
 * `course.update` check on the lesson's course), not only whoever first made
 * the quiz. When: while the course is a draft or live, like its lessons.
 *
 * The quiz is named after the lesson (no " - Quiz" suffix) and has no review
 * of its own: it goes live with its lesson (course-quiz-publishing.ts), and in
 * a live lesson a save reaches learners at once, as lesson edits do.
 */

type PublishStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

const QUIZ_LESSON_TYPES = new Set(["section_quiz", "quiz"]);

function notAQuizLesson(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "This lesson isn't a quiz lesson.",
  });
}

function courseLocked(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "This course is in review or archived. Edit its quiz after the review.",
  });
}

async function requireQuizLesson(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
): Promise<LessonRow> {
  const lesson = await findLessonWithModuleAndCourse({ tx, lessonId });
  if (!lesson || lesson.tenantId !== ctx.tenantId) throw lessonNotFound();
  const type = resolveLessonType({
    contentJson: lesson.contentJson,
    videoUrl: lesson.videoUrl,
    videoProvider: lesson.videoProvider,
  });
  if (!type || !QUIZ_LESSON_TYPES.has(type)) throw notAQuizLesson();
  return lesson;
}

function lessonIsLive(lesson: LessonRow): boolean {
  return (
    lesson.status === "PUBLISHED" &&
    lesson.moduleStatus === "PUBLISHED" &&
    lesson.courseStatus === "PUBLISHED"
  );
}

/** The lesson's quiz, if it has one that still exists. */
async function findLessonAssessment(
  tx: TenantTx,
  ctx: ServiceCtx,
  lesson: LessonRow,
): Promise<AssessmentRow | null> {
  const assessmentId = quizAssessmentIdOf({
    contentJson: lesson.contentJson,
    videoUrl: lesson.videoUrl,
    videoProvider: lesson.videoProvider,
  });
  if (!assessmentId) return null;
  const assessment = await assessmentsRepository.findById(tx, assessmentId);
  return assessment && assessment.tenant_id === ctx.tenantId ? assessment : null;
}

function settingsOf(config: AssessmentConfig): LessonQuizSettings {
  return {
    attemptsAllowed: config.attemptsAllowed,
    timeLimitSeconds: config.timeLimitSeconds ?? null,
    passMarkPercent: config.passMarkPercent,
    shuffleItems: config.shuffleItems,
    shuffleOptions: config.shuffleOptions,
    showAnswersPolicy: config.showAnswersPolicy,
    questionsPerAttempt: config.questionsPerAttempt ?? null,
    negativeMarkPercent: config.negativeMarkPercent,
  };
}

async function describeQuiz(
  tx: TenantTx,
  lesson: LessonRow,
  assessment: AssessmentRow | null,
): Promise<LessonQuiz> {
  const base = {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    courseId: lesson.courseId,
    editable: canEditCourseContent(lesson.courseStatus),
    lessonLive: lessonIsLive(lesson),
  };
  if (!assessment) return { ...base, quiz: null };

  const rows = await assessmentsRepository.listAssessmentItems(tx, assessment.id);
  const loaded = await itemRegistryRepository.loadItemsWithOptions(
    tx,
    rows.map((row) => row.item_id),
  );
  const answered = new Set(
    (
      await tx.$queryRaw<Array<{ id: string }>>`
        select distinct aa.assessment_item_id::text as id
        from attempt_answers aa
        inner join assessment_items ai on ai.id = aa.assessment_item_id
        where ai.assessment_id = ${assessment.id}::uuid
      `
    ).map((row) => row.id),
  );
  const attemptCount = await tx.attempt.count({
    where: { assessment_id: assessment.id, status: { notIn: ["ABANDONED", "VOIDED"] } },
  });

  const questions = [];
  for (const row of rows) {
    const found = loaded.get(row.item_id);
    if (!found) continue;
    questions.push({
      itemId: row.item_id,
      position: row.position,
      points: Number(row.points),
      itemTypeKey: found.item.item_type_key,
      contentJson: (found.item.stem_json ?? {}) as Record<string, unknown>,
      itemStatus: found.item.status,
      answered: answered.has(row.id),
    });
  }

  return {
    ...base,
    quiz: {
      id: assessment.id,
      status: assessment.status as PublishStatus,
      settings: settingsOf(extractAssessmentConfig(assessment.config_json)),
      questions,
      totalMarks: questions.reduce((sum, question) => sum + question.points, 0),
      attemptCount,
    },
  };
}

export async function getLessonQuiz(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
): Promise<{ data: LessonQuiz }> {
  const lesson = await requireQuizLesson(tx, ctx, lessonId);
  const assessment = await findLessonAssessment(tx, ctx, lesson);
  return { data: await describeQuiz(tx, lesson, assessment) };
}

/** A slug no other quiz in the academy has (deleted ones keep theirs). */
async function lessonQuizSlug(tx: TenantTx, lessonId: string): Promise<string> {
  const base = `lesson-quiz-${lessonId}`;
  const taken = await tx.$queryRaw<Array<{ slug: string }>>`
    select slug from assessments where slug like ${`${base}%`}
  `;
  const used = new Set(taken.map((row) => row.slug));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${String(n)}`)) n += 1;
  return `${base}-${String(n)}`;
}

function snapshot(
  assessment: Pick<AssessmentRow, "title" | "status" | "config_json">,
  items: Array<{ itemId: string; position: number; points: number }>,
) {
  return {
    title: assessment.title,
    status: assessment.status,
    config: extractAssessmentConfig(assessment.config_json),
    items,
  };
}

export async function putLessonQuiz(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  input: PutLessonQuizBody,
): Promise<{ data: LessonQuiz }> {
  const lesson = await requireQuizLesson(tx, ctx, lessonId);
  if (!canEditCourseContent(lesson.courseStatus)) throw courseLocked();

  const settings = input.settings;
  const config = AssessmentConfigSchema.parse({
    attemptsAllowed: settings.attemptsAllowed,
    ...(settings.timeLimitSeconds != null ? { timeLimitSeconds: settings.timeLimitSeconds } : {}),
    passMarkPercent: settings.passMarkPercent,
    shuffleItems: settings.shuffleItems,
    shuffleOptions: settings.shuffleOptions,
    showAnswersPolicy: settings.showAnswersPolicy,
    ...(settings.questionsPerAttempt != null
      ? { questionsPerAttempt: settings.questionsPerAttempt }
      : {}),
    negativeMarkPercent: settings.negativeMarkPercent,
  });

  let assessment = await findLessonAssessment(tx, ctx, lesson);
  const created = !assessment;
  let before: ReturnType<typeof snapshot> | null = null;

  if (assessment) {
    // Proctoring and secure mode are set on the quiz's own page; keep them.
    const current = extractAssessmentConfig(assessment.config_json);
    config.secureMode = current.secureMode;
    config.proctoringLevel = current.proctoringLevel;
    config.l1ProctoringEnabled = current.l1ProctoringEnabled;
    const rows = await assessmentsRepository.listAssessmentItems(tx, assessment.id);
    before = snapshot(
      assessment,
      rows.map((row) => ({
        itemId: row.item_id,
        position: row.position,
        points: Number(row.points),
      })),
    );
  } else {
    assessment = await assessmentsRepository.insertAssessment(tx, {
      tenantId: ctx.tenantId,
      title: lesson.title,
      assessmentType: "section_quiz",
      slug: await lessonQuizSlug(tx, lesson.id),
      configJson: buildAssessmentConfigJson({
        createdByMembershipId: ctx.actorMembershipId,
        config,
      }),
    });
    // The lesson points at its quiz; the rest of its content is kept.
    await tx.$executeRaw`
      update lessons
      set content_json = coalesce(content_json, '{}'::jsonb)
            || jsonb_build_object('assessmentId', ${assessment.id}::text),
          updated_at = now()
      where id = ${lesson.id}::uuid
    `;
  }

  const items = input.questions.map((question, index) => ({
    itemId: question.itemId,
    position: index + 1,
    points: question.points,
    required: true,
  }));
  await saveAssessmentItems(tx, {
    tenantId: ctx.tenantId,
    assessmentId: assessment.id,
    items,
  });

  // Named after its lesson; whoever first made it stays its owner (grading
  // tasks go to them).
  const updated = await assessmentsRepository.updateAssessment(tx, {
    assessmentId: assessment.id,
    title: lesson.title,
    configJson: buildAssessmentConfigJson({
      createdByMembershipId:
        readCreatedByMembershipId(assessment.config_json) ?? ctx.actorMembershipId,
      description: readDescription(assessment.config_json),
      config,
      preserved: preservedAssessmentConfig(assessment.config_json),
    }),
  });
  if (!updated) throw lessonNotFound();

  // Live with its lesson, as soon as it has questions; a quiz that was never
  // live waits as a draft (it used to wait in a review of its own).
  const live = lessonIsLive(lesson) && items.length > 0;
  const nextStatus = live || updated.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  if (updated.status !== nextStatus) {
    await assessmentsRepository.updateStatus(tx, assessment.id, nextStatus);
  }
  const saved = (await assessmentsRepository.findById(tx, assessment.id)) ?? updated;

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: created ? "assessment.created" : "assessment.updated",
      target: { type: "assessment", id: assessment.id },
      before,
      after: snapshot(
        saved,
        items.map(({ itemId, position, points }) => ({ itemId, position, points })),
      ),
      reason: null,
      metadata: { lessonId: lesson.id, courseId: lesson.courseId, source: "course_quiz_lesson" },
    },
  );

  const refreshed = (await findLessonWithModuleAndCourse({ tx, lessonId })) ?? lesson;
  return { data: await describeQuiz(tx, refreshed, saved) };
}
