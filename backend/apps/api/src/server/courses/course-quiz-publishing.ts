import type { TenantTx } from "@atlas/db";

/**
 * A course's quizzes go live with their lessons (QA review 2 4.1, S3.4): no
 * separate "submit the quiz for review, approve it" round. A quiz lesson's
 * quiz is published when its lesson is: when the course is approved, when a
 * section or lesson of a live course is published, or when its questions are
 * saved while the lesson is live. A quiz with no questions stays a draft, so
 * learners never get an empty quiz.
 *
 * Scope: one course, one section or one lesson (exactly one of them).
 * Returns how many quizzes were published.
 */
export async function publishLiveLessonQuizzes(
  tx: TenantTx,
  scope: { courseId?: string; moduleId?: string; lessonId?: string },
): Promise<number> {
  const courseId = scope.courseId ?? null;
  const moduleId = scope.moduleId ?? null;
  const lessonId = scope.lessonId ?? null;
  if (!courseId && !moduleId && !lessonId) return 0;

  return tx.$executeRaw`
    update assessments a
    set status = 'PUBLISHED'::"PublishStatus",
        updated_at = now()
    from lessons l
    inner join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
    inner join courses c on c.id = m.course_id and c.tenant_id = m.tenant_id
    where a.id::text = l.content_json->>'assessmentId'
      and a.tenant_id = l.tenant_id
      and a.deleted_at is null
      and a.status in ('DRAFT'::"PublishStatus", 'REVIEW'::"PublishStatus")
      and exists (select 1 from assessment_items ai where ai.assessment_id = a.id)
      and l.deleted_at is null
      and l.status = 'PUBLISHED'::"PublishStatus"
      and m.deleted_at is null
      and m.status = 'PUBLISHED'::"PublishStatus"
      and c.deleted_at is null
      and c.status = 'PUBLISHED'::"PublishStatus"
      and (${courseId}::uuid is null or m.course_id = ${courseId}::uuid)
      and (${moduleId}::uuid is null or m.id = ${moduleId}::uuid)
      and (${lessonId}::uuid is null or l.id = ${lessonId}::uuid)
  `;
}
