import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadCourseResourceRef } from "../../../../../../server/courses/load-course-resource-ref";
import type {
  CourseReviewsQuery,
  SubmitReviewBody,
} from "../../../../../../server/reviews/schemas";

export const getReviewsRouteMetadata = {
  permission: "course_review.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await loadCourseResourceRef({ tx, ctx, courseId, requirePublished: true });
  },
} satisfies RouteMetadata<CourseReviewsQuery>;

export const postReviewRouteMetadata = {
  permission: "course_review.create",
  entitlement: null,
  audit: "none",
  auditExempt: "member_content",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await loadCourseResourceRef({ tx, ctx, courseId, requirePublished: true });
  },
} satisfies RouteMetadata<SubmitReviewBody>;

export const routeMetadata = getReviewsRouteMetadata;
