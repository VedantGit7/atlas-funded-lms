// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import { createTenantResourceRef } from "@atlas/authorization";
import { findCourseAuthProjection } from "../courses/courses.repository";
import { courseEnrollmentDenied, courseNotFound } from "../courses/courses.errors";
import { loadCourseResourceRef } from "../courses/load-course-resource-ref";
import {
  findActiveEnrollment,
  insertEnrollment,
  listEnrollmentsForCourse,
  listEnrollmentsForMember,
  publishEnrollmentCreatedEvent,
} from "./enrollments.repository";
import type { EnrollmentListQuery } from "./schemas";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export type EnrollmentCreateBody = {
  courseId: string;
};

export async function listEnrollments(tx: TenantTx, ctx: ServiceCtx, query: EnrollmentListQuery) {
  if (query.courseId) {
    const course = await findCourseAuthProjection({ tx, courseId: query.courseId });
    if (!course || course.tenantId !== ctx.tenantId) {
      throw courseNotFound();
    }

    const page = await listEnrollmentsForCourse({
      tx,
      courseId: query.courseId,
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });

    return {
      data: {
        items: page.items.map((item) => ({
          id: item.id,
          courseId: item.courseId,
          membershipId: item.membershipId,
          displayName: item.displayName,
          status: item.status,
          enrolledAt: item.enrolledAt.toISOString(),
        })),
        pageInfo: page.pageInfo,
      },
    };
  }

  const page = await listEnrollmentsForMember({
    tx,
    membershipId: ctx.actorMembershipId,
    limit: query.limit,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });

  return {
    data: {
      items: page.items.map((item) => ({
        id: item.id,
        courseId: item.courseId,
        membershipId: item.membershipId,
        displayName: item.displayName,
        status: item.status,
        enrolledAt: item.enrolledAt.toISOString(),
      })),
      pageInfo: page.pageInfo,
    },
  };
}

export async function loadEnrollmentListResourceRef(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  query: EnrollmentListQuery;
}) {
  if (args.query.courseId) {
    return loadCourseResourceRef({
      tx: args.tx,
      ctx: args.ctx,
      courseId: args.query.courseId,
      requirePublished: false,
    });
  }

  return createTenantResourceRef({
    type: "member_enrollments",
    id: args.ctx.actorMembershipId,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: args.ctx.actorMembershipId,
    relationships: {
      selfEnrollmentList: args.ctx.actorMembershipId,
    },
  });
}

export async function enrollCurrentMemberInCourse(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: EnrollmentCreateBody,
) {
  const course = await findCourseAuthProjection({ tx, courseId: input.courseId });

  if (!course || course.tenantId !== ctx.tenantId) {
    throw courseNotFound();
  }

  if (course.status !== "PUBLISHED") {
    throw courseEnrollmentDenied();
  }

  const existing = await findActiveEnrollment({
    tx,
    courseId: input.courseId,
    membershipId: ctx.actorMembershipId,
  });

  if (existing) {
    return {
      data: {
        id: existing.id,
        courseId: input.courseId,
        status: "active" as const,
        enrolledAt: existing.enrolledAt.toISOString(),
        created: false,
      },
    };
  }

  const created = await insertEnrollment({
    tx,
    tenantId: ctx.tenantId,
    courseId: input.courseId,
    membershipId: ctx.actorMembershipId,
  });

  if (created.created) {
    await publishEnrollmentCreatedEvent({
      tx,
      ctx,
      enrollmentId: created.id,
      courseId: input.courseId,
    });
  }

  return {
    data: {
      id: created.id,
      courseId: input.courseId,
      status: "active" as const,
      enrolledAt: created.enrolledAt.toISOString(),
      created: created.created,
    },
  };
}
