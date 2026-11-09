import type { CourseLifecycleStatus } from "../courses/course-state-guards";
import type { CourseAuthProjection } from "../courses/courses.repository";
import type { LessonRow } from "./lessons.repository";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

type LessonAccessRow = {
  id: string;
  tenant_id: string;
  module_id: string;
  course_id: string;
  slug: string;
  title: string;
  content_json: Record<string, unknown> | null;
  video_provider: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  position: number;
  status: string;
  course_tenant_id: string;
  course_slug: string;
  course_title: string;
  course_description: string | null;
  course_status: string;
  course_metadata_json: Record<string, unknown> | null;
  course_created_by_membership_id: string | null;
  course_created_at: Date;
  course_updated_at: Date;
  enrollment_id: string | null;
  enrollment_status: string | null;
  enrollment_enrolled_at: Date | null;
};

/**
 * What a lesson route's resource loader reads, in one statement: the lesson
 * (as findLessonWithModuleAndCourse), its course (as findCourseAuthProjection)
 * and the member's active enrollment in that course (as
 * findEnrollmentForMembership). Three statements on every lesson request
 * before, in the staging load test's hottest routes.
 */
export async function findLessonWithCourseAndEnrollment(args: {
  tx: Tx;
  lessonId: string;
  membershipId: string;
}): Promise<{
  lesson: LessonRow;
  course: CourseAuthProjection;
  enrollment: { id: string; status: string; enrolledAt: Date } | null;
} | null> {
  const rows = await args.tx.$queryRaw<LessonAccessRow[]>`
    select
      l.id::text,
      l.tenant_id::text,
      l.module_id::text,
      m.course_id::text,
      l.slug,
      l.title,
      l.content_json,
      l.video_provider,
      l.video_url,
      l.duration_seconds,
      l.position,
      l.status::text,
      c.tenant_id::text as course_tenant_id,
      c.slug as course_slug,
      c.title as course_title,
      c.description as course_description,
      c.status::text as course_status,
      c.metadata_json as course_metadata_json,
      c.created_by_membership_id::text as course_created_by_membership_id,
      c.created_at as course_created_at,
      c.updated_at as course_updated_at,
      e.id::text as enrollment_id,
      e.status as enrollment_status,
      e.enrolled_at as enrollment_enrolled_at
    from lessons l
    inner join course_modules m
      on m.id = l.module_id
     and m.tenant_id = l.tenant_id
    inner join courses c
      on c.id = m.course_id
     and c.tenant_id = m.tenant_id
    left join lateral (
      select e.id, e.status, e.enrolled_at
      from enrollments e
      where e.course_id = c.id
        and e.membership_id = ${args.membershipId}::uuid
        and e.status = 'active'
      limit 1
    ) e on true
    where l.id = ${args.lessonId}::uuid
      and l.deleted_at is null
      and m.deleted_at is null
      and c.deleted_at is null
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    lesson: {
      id: row.id,
      tenantId: row.tenant_id,
      moduleId: row.module_id,
      courseId: row.course_id,
      slug: row.slug,
      title: row.title,
      contentJson: row.content_json,
      videoProvider: row.video_provider,
      videoUrl: row.video_url,
      durationSeconds: row.duration_seconds,
      position: row.position,
      status: row.status as CourseLifecycleStatus,
      courseStatus: row.course_status as CourseLifecycleStatus,
      createdByMembershipId: row.course_created_by_membership_id,
    },
    course: {
      id: row.course_id,
      tenantId: row.course_tenant_id,
      slug: row.course_slug,
      title: row.course_title,
      description: row.course_description,
      status: row.course_status,
      metadataJson: row.course_metadata_json,
      createdByMembershipId: row.course_created_by_membership_id,
      createdAt: row.course_created_at,
      updatedAt: row.course_updated_at,
    },
    enrollment:
      row.enrollment_id && row.enrollment_status && row.enrollment_enrolled_at
        ? {
            id: row.enrollment_id,
            status: row.enrollment_status,
            enrolledAt: row.enrollment_enrolled_at,
          }
        : null,
  };
}
