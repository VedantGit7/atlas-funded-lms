import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  countActiveEnrollments,
  findModuleWithCourse,
  setCourseModuleStatus,
  updateCourseStatus,
} from "./course-authoring.repository";
import { courseNotFound, moduleNotFound } from "./courses.errors";
import { findCourseAuthProjection } from "./courses.repository";
import type { CourseLifecycleStatus } from "./course-state-guards";
import { findLessonWithModuleAndCourse, setLessonStatus } from "../lessons/lessons.repository";
import { lessonNotFound } from "../lessons/lessons.errors";

/**
 * Publishing and hiding course content (decided 6 November 2026, after launch
 * plan 5.1):
 *
 * - A module or lesson can be hidden or shown at any time except while its
 *   course is in review (the reviewer is looking at a fixed course) or
 *   archived. It takes effect at once, without a review: editing content needs
 *   the course back in draft, so "Show" can only bring back content a reviewer
 *   has already approved.
 * - Hidden is ARCHIVED. Learners see only PUBLISHED modules and lessons, and
 *   approving a course publishes only DRAFT and REVIEW ones, so a hidden item
 *   stays hidden through approval.
 * - Shown is PUBLISHED in a live course, and DRAFT in a draft course, where the
 *   next approval publishes it.
 * - A live course can be unpublished: it goes back to draft (editable, and
 *   submitted for review again to go live), and its enrolled learners lose
 *   access until then. Enrollments and progress are kept.
 *
 * Who may do this is the route's `course.publish` check: the course's own
 * instructor, or a role that bypasses resource checks (admins, owners).
 */

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export type ContentVisibility = { visible: boolean };

function visibilityLocked(courseStatus: CourseLifecycleStatus): AtlasHttpError | null {
  if (courseStatus === "REVIEW") {
    return new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "This course is in review. Show or hide content after the review.",
    });
  }
  if (courseStatus === "ARCHIVED") {
    return new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "This course is archived.",
    });
  }
  return null;
}

function statusFor(
  courseStatus: CourseLifecycleStatus,
  visible: boolean,
): "PUBLISHED" | "DRAFT" | "ARCHIVED" {
  if (!visible) return "ARCHIVED";
  return courseStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
}

function auditCtx(ctx: ServiceCtx) {
  return {
    tenantId: ctx.tenantId,
    actorMembershipId: ctx.actorMembershipId,
    platformPrincipalId: null,
    requestId: ctx.requestId,
  };
}

export async function setModuleVisibility(
  tx: TenantTx,
  ctx: ServiceCtx,
  moduleId: string,
  input: ContentVisibility,
) {
  const module = await findModuleWithCourse({ tx, moduleId });
  if (!module || module.tenantId !== ctx.tenantId) throw moduleNotFound();

  const locked = visibilityLocked(module.courseStatus);
  if (locked) throw locked;

  const status = statusFor(module.courseStatus, input.visible);
  if (module.status !== status) {
    await setCourseModuleStatus({ tx, moduleId, status });
    await auditWriter.write(tx, auditCtx(ctx), {
      action: input.visible ? "course_module.shown" : "course_module.hidden",
      target: { type: "course_module", id: moduleId },
      before: { status: module.status },
      after: { status },
      reason: null,
      metadata: { courseId: module.courseId, courseStatus: module.courseStatus },
    });
  }

  return { data: { id: moduleId, status, visible: input.visible } };
}

export async function setLessonVisibility(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  input: ContentVisibility,
) {
  const lesson = await findLessonWithModuleAndCourse({ tx, lessonId });
  if (!lesson || lesson.tenantId !== ctx.tenantId) throw lessonNotFound();

  const locked = visibilityLocked(lesson.courseStatus);
  if (locked) throw locked;

  const status = statusFor(lesson.courseStatus, input.visible);
  if (lesson.status !== status) {
    await setLessonStatus({ tx, lessonId, status });
    await auditWriter.write(tx, auditCtx(ctx), {
      action: input.visible ? "lesson.shown" : "lesson.hidden",
      target: { type: "lesson", id: lessonId },
      before: { status: lesson.status },
      after: { status },
      reason: null,
      metadata: {
        courseId: lesson.courseId,
        moduleId: lesson.moduleId,
        courseStatus: lesson.courseStatus,
      },
    });
  }

  return { data: { id: lessonId, status, visible: input.visible } };
}

async function requireCourse(tx: TenantTx, ctx: ServiceCtx, courseId: string) {
  const course = await findCourseAuthProjection({ tx, courseId });
  if (!course || course.tenantId !== ctx.tenantId) throw courseNotFound();
  return course;
}

/** What unpublishing would do, for the studio's confirmation. */
export async function previewCourseUnpublish(tx: TenantTx, ctx: ServiceCtx, courseId: string) {
  const course = await requireCourse(tx, ctx, courseId);
  const activeEnrollments = await countActiveEnrollments({ tx, courseId });
  return {
    data: {
      id: courseId,
      status: course.status as CourseLifecycleStatus,
      canUnpublish: course.status === "PUBLISHED",
      activeEnrollments,
    },
  };
}

export async function unpublishCourse(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  input: { reason?: string | null | undefined },
) {
  const course = await requireCourse(tx, ctx, courseId);
  if (course.status !== "PUBLISHED") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Only a published course can be unpublished.",
    });
  }

  const activeEnrollments = await countActiveEnrollments({ tx, courseId });
  await updateCourseStatus({ tx, courseId, status: "DRAFT" });
  const unpublishedAt = new Date().toISOString();

  await auditWriter.write(tx, auditCtx(ctx), {
    action: "course.unpublished",
    target: { type: "course", id: courseId },
    before: { status: course.status },
    after: { status: "DRAFT" },
    reason: input.reason ?? null,
    metadata: { activeEnrollments },
  });

  // Search drops the course: its index projection is empty once it isn't PUBLISHED.
  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "course.unpublished",
    aggregateType: "course",
    aggregateId: courseId,
    payload: { courseId, unpublishedAt },
    idempotencyKey: `${ctx.requestId}:course.unpublished:${courseId}`,
  });

  return { data: { id: courseId, status: "DRAFT" as const, activeEnrollments, unpublishedAt } };
}
