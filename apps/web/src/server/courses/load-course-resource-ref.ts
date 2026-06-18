import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { findModuleWithCourse } from "./course-authoring.repository";
import { courseNotFound, moduleNotFound } from "./courses.errors";
import { findCourseAuthProjection, findEnrollmentForMembership } from "./courses.repository";
import { findLessonWithModuleAndCourse } from "../lessons/lessons.repository";
import { lessonNotFound } from "../lessons/lessons.errors";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

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
  }

  if (course.createdByMembershipId === args.ctx.actorMembershipId) {
    relationships["instructorOfCourse"] = args.ctx.actorMembershipId;
  }

  return createTenantResourceRef({
    type: "course",
    id: course.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: course.createdByMembershipId,
    relationships,
  });
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

  return loadCourseResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    courseId: lesson.courseId,
    requirePublished: args.requirePublished ?? lesson.courseStatus === "PUBLISHED",
  });
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
