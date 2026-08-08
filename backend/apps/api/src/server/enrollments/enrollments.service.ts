import type { TenantTx } from "@atlas/db";
import { createTenantResourceRef } from "@atlas/authorization";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { findMembershipById } from "@atlas/membership/member-admin.repository";
import { findCourseAuthProjection, readCoursePricing } from "../courses/courses.repository";
import {
  courseEnrollmentDenied,
  courseNotFound,
  coursePurchaseRequired,
} from "../courses/courses.errors";
import { loadCourseResourceRef } from "../courses/load-course-resource-ref";
import {
  cancelEnrollment,
  findActiveEnrollment,
  findEnrollmentById,
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

export type CourseManageEnrollmentBody = {
  membershipId: string;
  purchasedCertificate?: boolean;
  paymentMethod?: "manual" | "complimentary" | "offline";
};

function resolveEnrollmentExpiry(metadata: Record<string, unknown> | null): Date | null {
  const plans = metadata?.["pricingPlans"];
  if (!Array.isArray(plans) || plans.length === 0) {
    return null;
  }

  const preferred =
    plans.find(
      (plan) =>
        plan &&
        typeof plan === "object" &&
        !Array.isArray(plan) &&
        (plan as Record<string, unknown>)["isDefault"] === true,
    ) ?? plans[0];

  if (!preferred || typeof preferred !== "object" || Array.isArray(preferred)) {
    return null;
  }

  const plan = preferred as Record<string, unknown>;
  const rawExpiry = typeof plan["expiryDate"] === "string" ? plan["expiryDate"].trim() : "";
  if (rawExpiry) {
    const parsed = Date.parse(rawExpiry);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }

  const validityDays =
    typeof plan["validityDays"] === "number" && Number.isFinite(plan["validityDays"])
      ? Math.max(1, Math.round(plan["validityDays"]))
      : null;
  if (validityDays == null) {
    return null;
  }

  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + validityDays);
  return expires;
}

function resolveSelfEnrollmentType(metadata: Record<string, unknown> | null): string {
  return readCoursePricing(metadata).accessTier === "PAID" ? "paid" : "free";
}

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

  // Freemium gate: paid courses must be purchased before a new enrollment is
  // created. Already-enrolled learners (handled above) keep their access.
  const pricing = readCoursePricing(course.metadataJson);
  if (pricing.accessTier === "PAID") {
    throw coursePurchaseRequired();
  }

  const created = await insertEnrollment({
    tx,
    tenantId: ctx.tenantId,
    courseId: input.courseId,
    membershipId: ctx.actorMembershipId,
    enrolledType: resolveSelfEnrollmentType(course.metadataJson),
    expiresAt: resolveEnrollmentExpiry(course.metadataJson),
  });

  if (created.created) {
    await publishEnrollmentCreatedEvent({
      tx,
      ctx,
      enrollmentId: created.id,
      courseId: input.courseId,
      membershipId: ctx.actorMembershipId,
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

export async function enrollMemberInCourseByInstructor(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  input: CourseManageEnrollmentBody,
) {
  const course = await findCourseAuthProjection({ tx, courseId });

  if (!course || course.tenantId !== ctx.tenantId) {
    throw courseNotFound();
  }

  if (course.status === "ARCHIVED") {
    throw courseEnrollmentDenied();
  }

  const membership = await findMembershipById({
    tx,
    tenantId: ctx.tenantId,
    membershipId: input.membershipId,
  });

  if (
    !membership ||
    membership.status === "SUSPENDED" ||
    membership.status === "REMOVED"
  ) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Selected member cannot be enrolled.",
    });
  }

  if (input.purchasedCertificate && !input.paymentMethod) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Payment method is required when purchasing a certificate.",
    });
  }

  const existing = await findActiveEnrollment({
    tx,
    courseId,
    membershipId: input.membershipId,
  });

  if (existing) {
    return {
      data: {
        id: existing.id,
        courseId,
        membershipId: input.membershipId,
        status: "active" as const,
        enrolledAt: existing.enrolledAt.toISOString(),
        created: false,
      },
    };
  }

  const created = await insertEnrollment({
    tx,
    tenantId: ctx.tenantId,
    courseId,
    membershipId: input.membershipId,
    enrolledType: input.paymentMethod ?? "complimentary",
    expiresAt: resolveEnrollmentExpiry(course.metadataJson),
  });

  if (created.created) {
    await publishEnrollmentCreatedEvent({
      tx,
      ctx,
      enrollmentId: created.id,
      courseId,
      membershipId: input.membershipId,
    });
  }

  return {
    data: {
      id: created.id,
      courseId,
      membershipId: input.membershipId,
      status: "active" as const,
      enrolledAt: created.enrolledAt.toISOString(),
      created: created.created,
    },
  };
}

export async function loadEnrollmentManageResourceRef(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  enrollmentId: string;
}) {
  const enrollment = await findEnrollmentById({
    tx: args.tx,
    enrollmentId: args.enrollmentId,
  });

  if (!enrollment || enrollment.tenantId !== args.ctx.tenantId) {
    throw courseNotFound();
  }

  return loadCourseResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    courseId: enrollment.courseId,
    requirePublished: false,
  });
}

export async function cancelEnrollmentById(
  tx: TenantTx,
  ctx: ServiceCtx,
  enrollmentId: string,
) {
  const enrollment = await findEnrollmentById({ tx, enrollmentId });

  if (!enrollment || enrollment.tenantId !== ctx.tenantId) {
    throw courseNotFound();
  }

  if (enrollment.status !== "active") {
    throw courseEnrollmentDenied();
  }

  const cancelled = await cancelEnrollment({ tx, enrollmentId });

  if (!cancelled) {
    throw courseNotFound();
  }

  return {
    data: {
      id: enrollmentId,
      courseId: enrollment.courseId,
      membershipId: enrollment.membershipId,
      status: "cancelled" as const,
      cancelledAt: new Date().toISOString(),
    },
  };
}
