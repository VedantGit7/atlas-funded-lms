import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { resolveLessonType } from "./lessons.repository";

/**
 * Quiz lessons: a lesson whose content is a quiz (QA review 1 C6, review 2 C5
 * and H23).
 *
 * A quiz lesson is completed by passing its quiz, not by "Mark complete",
 * which used to let a learner skip the quiz. Passing (when the attempt is
 * graded, automatically or by an instructor) completes every quiz lesson that
 * uses the quiz in courses the learner is enrolled in.
 */

const QUIZ_TYPES = new Set(["section_quiz", "quiz"]);

/** The quiz a lesson asks for, or null when it is not a quiz lesson with one. */
export function quizAssessmentIdOf(lesson: {
  contentJson: unknown;
  videoUrl?: string | null;
  videoProvider?: string | null;
}): string | null {
  const type = resolveLessonType({
    contentJson: lesson.contentJson,
    videoUrl: lesson.videoUrl,
    videoProvider: lesson.videoProvider,
  });
  if (!type || !QUIZ_TYPES.has(type)) return null;
  const content =
    lesson.contentJson &&
    typeof lesson.contentJson === "object" &&
    !Array.isArray(lesson.contentJson)
      ? (lesson.contentJson as Record<string, unknown>)
      : {};
  const id = content["assessmentId"];
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function quizLessonNeedsPass(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Pass the quiz to complete this lesson.",
  });
}

export type QuizLesson = { lessonId: string; courseId: string; title: string };

/**
 * Published quiz lessons that use this quiz, in published courses the member
 * is actively enrolled in, in course order.
 */
export async function findQuizLessonsForMember(
  tx: TenantTx,
  args: { assessmentId: string; membershipId: string },
): Promise<QuizLesson[]> {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      course_id: string;
      title: string;
      content_json: unknown;
      video_url: string | null;
      video_provider: string | null;
    }>
  >`
    select l.id::text, c.id::text as course_id, l.title, l.content_json, l.video_url, l.video_provider
      from lessons l
      join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
      join courses c on c.id = m.course_id and c.tenant_id = m.tenant_id
      join enrollments e
        on e.course_id = c.id
       and e.tenant_id = c.tenant_id
       and e.membership_id = ${args.membershipId}::uuid
       and e.status = 'active'
     where l.content_json ->> 'assessmentId' = ${args.assessmentId}
       and l.deleted_at is null
       and m.deleted_at is null
       and c.deleted_at is null
       and l.status = 'PUBLISHED'
       and c.status = 'PUBLISHED'
     order by c.created_at, m.position, l.position
  `;

  return rows
    .filter(
      (row) =>
        quizAssessmentIdOf({
          contentJson: row.content_json,
          videoUrl: row.video_url,
          videoProvider: row.video_provider,
        }) === args.assessmentId,
    )
    .map((row) => ({ lessonId: row.id, courseId: row.course_id, title: row.title }));
}
