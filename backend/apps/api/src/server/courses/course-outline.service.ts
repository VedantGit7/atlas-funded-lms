import type { TenantTx } from "@atlas/db";
import type { ResourceRef } from "@atlas/authorization";
import { courseNotFound } from "./courses.errors";
import { findCourseAuthProjection, findEnrollmentForMembership } from "./courses.repository";
import { getLoadedCourseProjection } from "./load-course-resource-ref";
import { listLearnerOutlineRows, type LearnerOutlineRow } from "./course-outline.repository";
import type { LearnerCourseOutline, LearnerOutlineLessonStatus } from "./course-outline.schemas";
import { resolveLessonType } from "../lessons/lessons.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
};

function statusOf(value: string | null): LearnerOutlineLessonStatus {
  return value === "completed" || value === "in_progress" ? value : "not_started";
}

function lessonTypeOf(row: LearnerOutlineRow): string | null {
  const meta =
    row.content_meta && typeof row.content_meta === "object" && !Array.isArray(row.content_meta)
      ? (row.content_meta as Record<string, unknown>)
      : {};
  return resolveLessonType({
    contentJson: { ...meta, body: row.has_body ? "article" : "" },
    videoUrl: row.video_url,
    videoProvider: row.video_provider,
  });
}

/**
 * Same rule as the course page's "Continue": the lesson last seen while in
 * progress, else the first lesson not completed, else the first lesson.
 */
function resumeLessonOf(rows: LearnerOutlineRow[]): string | null {
  const lessons = rows.filter((row) => row.lesson_id);
  const inProgress = lessons
    .filter((row) => row.progress_status === "in_progress")
    .sort((a, b) => (b.last_seen_at?.getTime() ?? 0) - (a.last_seen_at?.getTime() ?? 0));
  if (inProgress[0]?.lesson_id) return inProgress[0].lesson_id;
  const next = lessons.find((row) => row.progress_status !== "completed");
  return next?.lesson_id ?? lessons[0]?.lesson_id ?? null;
}

export function buildLearnerCourseOutline(
  courseId: string,
  rows: LearnerOutlineRow[],
  enrolled = true,
): LearnerCourseOutline {
  const modules: LearnerCourseOutline["modules"] = [];
  const byId = new Map<string, LearnerCourseOutline["modules"][number]>();
  let totalLessons = 0;
  let completedLessons = 0;

  for (const row of rows) {
    let module = byId.get(row.module_id);
    if (!module) {
      module = {
        id: row.module_id,
        title: row.module_title,
        position: row.module_position,
        contentKind: row.module_content_kind === "SCORM" ? "scorm" : "standard",
        lessons: [],
      };
      byId.set(row.module_id, module);
      modules.push(module);
    }
    if (!row.lesson_id || row.lesson_title == null || row.lesson_position == null) continue;

    // Every published lesson counts towards completion, as it does when the
    // enrollment is marked complete; lessons hidden from the syllabus just
    // aren't listed.
    const status = statusOf(row.progress_status);
    totalLessons += 1;
    if (status === "completed") completedLessons += 1;
    if (row.in_syllabus === false) continue;

    module.lessons.push({
      id: row.lesson_id,
      title: row.lesson_title,
      position: row.lesson_position,
      durationSeconds: row.duration_seconds,
      lessonType: lessonTypeOf(row),
      status,
    });
  }

  return {
    courseId,
    enrolled,
    modules,
    completedLessons,
    totalLessons,
    progressPct: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    resumeLessonId: resumeLessonOf(rows),
  };
}

export async function getLearnerCourseOutline(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  resource?: ResourceRef,
): Promise<{ data: LearnerCourseOutline }> {
  const loaded = getLoadedCourseProjection(tx, ctx, courseId, resource);
  const course = loaded?.course ?? (await findCourseAuthProjection({ tx, courseId }));

  if (!course || course.tenantId !== ctx.tenantId || course.status !== "PUBLISHED") {
    throw courseNotFound();
  }

  const enrollment = loaded
    ? loaded.enrollment
    : await findEnrollmentForMembership({
        tx,
        courseId,
        membershipId: ctx.actorMembershipId,
      });
  const rows = await listLearnerOutlineRows({
    tx,
    courseId,
    membershipId: ctx.actorMembershipId,
  });

  // Before enrolling, the course page still lists every chapter and lesson so
  // a learner can see what the course covers (QA review 1 M38). Progress from
  // an earlier enrollment isn't shown until they enrol again.
  if (!enrollment) {
    const preview = rows.map((row) => ({ ...row, progress_status: null, last_seen_at: null }));
    return { data: buildLearnerCourseOutline(courseId, preview, false) };
  }

  return { data: buildLearnerCourseOutline(courseId, rows) };
}
