import type { TenantTx } from "@atlas/db";
import { findCourseAuthProjection } from "../courses/courses.repository";
import { courseEnrollmentDenied, courseNotFound } from "../courses/courses.errors";
import {
  findActiveEnrollment,
  insertEnrollment,
  publishEnrollmentCreatedEvent,
} from "./enrollments.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export type EnrollmentCreateBody = {
  courseId: string;
};

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
