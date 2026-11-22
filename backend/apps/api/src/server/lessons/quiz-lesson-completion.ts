import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { recordLessonProgress } from "./lesson-progress.service";
import { findQuizLessonsForMember } from "./quiz-lessons";

/**
 * Completes the quiz lessons that use a quiz the learner just passed (QA
 * review 2 H23: passing never completed the lesson). Called when an attempt is
 * graded with a pass, by the learner's submit, the deadline, or an instructor.
 *
 * Progress is recorded as the learner, so the course completes and
 * `lesson.completed` is published exactly as for any other lesson. A lesson
 * the learner can no longer progress in (enrollment ended) is skipped.
 */
export async function completeQuizLessonsForPass(
  tx: TenantTx,
  ctx: { tenantId: string; requestId: string },
  args: { assessmentId: string; membershipId: string },
): Promise<string[]> {
  const lessons = await findQuizLessonsForMember(tx, args);
  const completed: string[] = [];

  for (const lesson of lessons) {
    try {
      await recordLessonProgress(
        tx,
        { tenantId: ctx.tenantId, actorMembershipId: args.membershipId, requestId: ctx.requestId },
        lesson.lessonId,
        { completed: true },
        undefined,
        { completedByQuiz: true },
      );
      completed.push(lesson.lessonId);
    } catch (error) {
      // Only "not found" and "enrollment required" are expected here.
      if (error instanceof AtlasHttpError && error.code === "PERMISSION_DENIED") continue;
      throw error;
    }
  }

  return completed;
}
