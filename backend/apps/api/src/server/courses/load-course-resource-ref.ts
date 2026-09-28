import { createTenantResourceRef, type ResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { findModuleWithCourse } from "./course-authoring.repository";
import { courseNotFound, moduleNotFound } from "./courses.errors";
import { findCourseAuthProjection, findEnrollmentForMembership } from "./courses.repository";
import { findLessonWithModuleAndCourse } from "../lessons/lessons.repository";
import { lessonNotFound } from "../lessons/lessons.errors";
import { createResourceProjection } from "../resource-projection";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

const courseProjections = createResourceProjection<{
  course: NonNullable<Awaited<ReturnType<typeof findCourseAuthProjection>>>;
  enrollment: Awaited<ReturnType<typeof findEnrollmentForMembership>>;
}>();
const lessonProjections = createResourceProjection<{
  lesson: NonNullable<Awaited<ReturnType<typeof findLessonWithModuleAndCourse>>>;
  enrollment: Awaited<ReturnType<typeof findEnrollmentForMembership>>;
}>();

export function getLoadedCourseProjection(
  tx: TenantTx,
  ctx: LoaderCtx,
  courseId: string,
  resource?: ResourceRef,
) {
  const loaded = courseProjections.get(resource, tx, ctx);
  return loaded?.course.id === courseId && resource?.id === courseId ? loaded : undefined;
}

export function getLoadedLessonProjection(
  tx: TenantTx,
  ctx: LoaderCtx,
  lessonId: string,
  resource?: ResourceRef,
) {
  const loaded = lessonProjections.get(resource, tx, ctx);
  return loaded?.lesson.id === lessonId && resource?.id === loaded.lesson.courseId
    ? loaded
    : undefined;
}

export async function loadCourseResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  courseId: string;
  requirePublished?: boolean;
}) {
  const course = await findCourseAuthProjection({
    tx: args.tx,
    courseId: args.courseId,
  });

  if (!course || course.tenantId !== args.ctx.tenantId) {
    throw courseNotFound();
  }

  if (args.requirePublished !== false && course.status !== "PUBLISHED") {
    throw courseNotFound();
  }

  const enrollment = await findEnrollmentForMembership({
    tx: args.tx,
    courseId: args.courseId,
    membershipId: args.ctx.actorMembershipId,
  });

  const relationships: Record<string, boolean | string> = {};

  if (course.status === "PUBLISHED") {
    relationships["publishedLearnerVisible"] = true;
  }

  if (enrollment) {
    relationships["enrolledInCourse"] = args.ctx.actorMembershipId;
    relationships["selfProgress"] = args.ctx.actorMembershipId;
  }

  if (course.createdByMembershipId === args.ctx.actorMembershipId) {
    relationships["instructorOfCourse"] = args.ctx.actorMembershipId;
  }

  const resource = createTenantResourceRef({
    type: "course",
    id: course.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: course.createdByMembershipId,
    relationships,
  });
  courseProjections.set(resource, args.tx, args.ctx, { course, enrollment });
  return resource;
}

export async function loadCourseCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "course_catalog",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
      relationships: {
        publishedLearnerVisible: true,
      },
    }),
  );
}

export async function loadCourseStudioCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "course_studio_catalog",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
      relationships: {
        instructorOfCourse: args.ctx.actorMembershipId,
      },
    }),
  );
}

export async function loadModuleParentCourseResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  moduleId: string;
}) {
  const module = await findModuleWithCourse({ tx: args.tx, moduleId: args.moduleId });

  if (!module || module.tenantId !== args.ctx.tenantId) {
    throw moduleNotFound();
  }

  if (module.createdByMembershipId !== args.ctx.actorMembershipId) {
    throw moduleNotFound();
  }

  return loadCourseResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    courseId: module.courseId,
    requirePublished: false,
  });
}

export async function loadCourseForEnrollmentResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  courseId: string;
}) {
  return loadCourseResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    courseId: args.courseId,
    requirePublished: true,
  });
}

export async function loadLessonParentCourseResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  lessonId: string;
  requirePublished?: boolean;
}) {
  const lesson = await findLessonWithModuleAndCourse({ tx: args.tx, lessonId: args.lessonId });

  if (!lesson || lesson.tenantId !== args.ctx.tenantId) {
    throw lessonNotFound();
  }

  if (args.requirePublished !== false && lesson.courseStatus !== "PUBLISHED") {
    throw lessonNotFound();
  }

  const resource = await loadCourseResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    courseId: lesson.courseId,
    requirePublished: args.requirePublished ?? lesson.courseStatus === "PUBLISHED",
  });
  const course = getLoadedCourseProjection(args.tx, args.ctx, lesson.courseId, resource);
  if (course) {
    lessonProjections.set(resource, args.tx, args.ctx, { lesson, enrollment: course.enrollment });
  }
  return resource;
}

export async function loadModuleLessonsResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  moduleId: string;
  requirePublished?: boolean;
}) {
  const module = await findModuleWithCourse({ tx: args.tx, moduleId: args.moduleId });

  if (!module || module.tenantId !== args.ctx.tenantId) {
    throw moduleNotFound();
  }

  if (args.requirePublished === false) {
    if (module.createdByMembershipId !== args.ctx.actorMembershipId) {
      throw moduleNotFound();
    }
  }

  return loadCourseResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    courseId: module.courseId,
    requirePublished: args.requirePublished ?? module.courseStatus === "PUBLISHED",
  });
}
