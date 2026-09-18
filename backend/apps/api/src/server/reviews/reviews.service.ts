import type { TenantTx } from "@atlas/db";
import { courseNotFound } from "../courses/courses.errors";
import { loadCourseResourceRef } from "../courses/load-course-resource-ref";
import {
  findCourseAuthProjection,
  findEnrollmentForMembership,
} from "../courses/courses.repository";
import {
  findMyCourseReview,
  getCourseReviewAggregate,
  listCourseReviews,
  publishCourseReviewCreatedEvent,
  upsertCourseReview,
  type CourseReviewRecord,
} from "./reviews.repository";
import { reviewRequiresEnrollment } from "./reviews.errors";
import type { CourseReviewsQuery, SubmitReviewBody } from "./schemas";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function assertPublished(status: string): void {
  if (status !== "PUBLISHED") {
    throw courseNotFound();
  }
}

function serializeReview(review: CourseReviewRecord, viewerMembershipId: string) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    authorName: review.authorName,
    mine: review.membershipId === viewerMembershipId,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

export async function submitCourseReview(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  input: SubmitReviewBody,
) {
  const course = await findCourseAuthProjection({ tx, courseId });
  if (!course || course.tenantId !== ctx.tenantId) {
    throw courseNotFound();
  }
  assertPublished(course.status);

  const enrollment = await findEnrollmentForMembership({
    tx,
    courseId,
    membershipId: ctx.actorMembershipId,
  });
  if (!enrollment) {
    throw reviewRequiresEnrollment();
  }

  const comment = input.comment?.trim() ? input.comment.trim() : null;
  const result = await upsertCourseReview({
    tx,
    tenantId: ctx.tenantId,
    courseId,
    membershipId: ctx.actorMembershipId,
    rating: input.rating,
    comment,
  });

  if (result.created) {
    await publishCourseReviewCreatedEvent({
      tx,
      ctx,
      reviewId: result.id,
      courseId,
      membershipId: ctx.actorMembershipId,
      rating: input.rating,
    });
  }

  return {
    data: {
      id: result.id,
      rating: input.rating,
      comment,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      created: result.created,
    },
  };
}

export async function getCourseReviews(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  query: CourseReviewsQuery,
) {
  const course = await findCourseAuthProjection({ tx, courseId });
  if (!course || course.tenantId !== ctx.tenantId) {
    throw courseNotFound();
  }
  assertPublished(course.status);

  const [aggregate, mine, page] = await Promise.all([
    getCourseReviewAggregate({ tx, courseId }),
    findMyCourseReview({ tx, courseId, membershipId: ctx.actorMembershipId }),
    listCourseReviews({
      tx,
      courseId,
      viewerMembershipId: ctx.actorMembershipId,
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    }),
  ]);

  return {
    data: {
      items: page.items.map((review) => serializeReview(review, ctx.actorMembershipId)),
      aggregate,
      myReview: mine ? serializeReview(mine, ctx.actorMembershipId) : null,
      pageInfo: page.pageInfo,
    },
  };
}

export async function loadCourseReviewResourceRef(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  courseId: string;
}) {
  return loadCourseResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    courseId: args.courseId,
    requirePublished: true,
  });
}
