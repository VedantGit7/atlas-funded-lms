import type { TenantTx } from "@atlas/db";
import { readCourseCategory, readCourseCoverKey } from "../courses/course-presentation";
import { pickResumeLesson } from "../lessons/lessons.repository";
import type { MyCourse, MyCoursesResponse } from "./my-courses.schemas";

type ServiceCtx = { tenantId: string; actorMembershipId: string };

/** A learner is enrolled in a handful of courses; this bounds a pathological account. */
const MY_COURSES_LIMIT = 100;

type LessonRow = {
  lessonId: string;
  title: string;
  status: string | null;
  lastSeenAt: string | null;
  updatedAt: string | null;
};

type MyCourseRow = {
  course_id: string;
  title: string;
  metadata_json: Record<string, unknown> | null;
  enrolled_at: Date;
  enrollment_completed_at: Date | null;
  lessons: LessonRow[] | null;
};

const STATUS_ORDER: Record<MyCourse["status"], number> = {
  in_progress: 0,
  not_started: 1,
  completed: 2,
};

function lessonStatus(value: string | null): MyCourse["lessons"][number]["status"] {
  return value === "completed" || value === "in_progress" ? value : "not_started";
}

function latest(values: Array<string | null>): string | null {
  let best: number | null = null;
  for (const value of values) {
    if (!value) continue;
    const time = Date.parse(value);
    if (!Number.isNaN(time) && (best === null || time > best)) best = time;
  }
  return best === null ? null : new Date(best).toISOString();
}

export function toMyCourse(row: MyCourseRow): MyCourse {
  const lessons = row.lessons ?? [];
  const totalLessons = lessons.length;
  const completedLessons = lessons.filter((lesson) => lesson.status === "completed").length;
  const started = lessons.some((lesson) => lessonStatus(lesson.status) !== "not_started");
  const finished = totalLessons > 0 && completedLessons >= totalLessons;
  const status: MyCourse["status"] = finished
    ? "completed"
    : started
      ? "in_progress"
      : "not_started";

  const resumeId = finished
    ? null
    : pickResumeLesson(
        lessons.map((lesson) => ({
          lesson_id: lesson.lessonId,
          status: lesson.status,
          last_seen_at: lesson.lastSeenAt ? new Date(lesson.lastSeenAt) : null,
        })),
      );
  const resume = lessons.find((lesson) => lesson.lessonId === resumeId) ?? null;
  const lastActivityAt = latest(lessons.map((lesson) => lesson.updatedAt ?? lesson.lastSeenAt));

  return {
    courseId: row.course_id,
    title: row.title,
    coverKey: readCourseCoverKey(row.metadata_json),
    category: readCourseCategory(row.metadata_json),
    enrolledAt: row.enrolled_at.toISOString(),
    completedAt: finished ? (row.enrollment_completed_at?.toISOString() ?? lastActivityAt) : null,
    lastActivityAt,
    totalLessons,
    completedLessons,
    progressPct: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    status,
    nextLesson: resume ? { id: resume.lessonId, title: resume.title } : null,
    lessons: lessons.map((lesson) => ({
      id: lesson.lessonId,
      status: lessonStatus(lesson.status),
    })),
  };
}

function compareMyCourses(left: MyCourse, right: MyCourse): number {
  const byStatus = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
  if (byStatus !== 0) return byStatus;
  const leftTime = Date.parse(left.lastActivityAt ?? left.enrolledAt);
  const rightTime = Date.parse(right.lastActivityAt ?? right.enrolledAt);
  return rightTime - leftTime;
}

/**
 * The signed-in learner's active enrollments in published courses, each with
 * its lessons and the learner's progress, in one statement.
 */
export async function listMyCourses(tx: TenantTx, ctx: ServiceCtx): Promise<MyCoursesResponse> {
  const rows = await tx.$queryRaw<MyCourseRow[]>`
    select
      e.course_id::text as course_id,
      c.title,
      c.metadata_json,
      e.enrolled_at,
      e.completed_at as enrollment_completed_at,
      (
        select json_agg(
          json_build_object(
            'lessonId', l.id::text,
            'title', l.title,
            'status', lp.status,
            'lastSeenAt', lp.last_seen_at,
            'updatedAt', lp.updated_at
          )
          order by cm.position asc, l.position asc
        )
        from lessons l
        inner join course_modules cm
          on cm.id = l.module_id
         and cm.tenant_id = l.tenant_id
        left join lesson_progress lp
          on lp.tenant_id = l.tenant_id
         and lp.lesson_id = l.id
         and lp.membership_id = e.membership_id
        where cm.course_id = e.course_id
          and cm.deleted_at is null
          and cm.status = 'PUBLISHED'
          and l.deleted_at is null
          and l.status = 'PUBLISHED'
      ) as lessons
    from enrollments e
    inner join courses c
      on c.id = e.course_id
     and c.tenant_id = e.tenant_id
    where e.tenant_id = app.current_tenant_id()
      and e.membership_id = ${ctx.actorMembershipId}::uuid
      and e.status = 'active'
      and c.status = 'PUBLISHED'
      and c.deleted_at is null
    order by e.enrolled_at desc
    limit ${MY_COURSES_LIMIT}
  `;

  const items = rows.map(toMyCourse).sort(compareMyCourses);
  return {
    data: {
      items,
      totals: {
        enrolled: items.length,
        inProgress: items.filter((item) => item.status === "in_progress").length,
        completed: items.filter((item) => item.status === "completed").length,
        lessonsCompleted: items.reduce((sum, item) => sum + item.completedLessons, 0),
      },
    },
  };
}
