import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadCourseForEnrollmentResourceRef } from "../../../../server/courses/load-course-resource-ref";
import type { EnrollmentCreateBody } from "../../../../server/enrollments/enrollments.service";
import { loadEnrollmentListResourceRef } from "../../../../server/enrollments/enrollments.service";
import type { EnrollmentListQuery } from "../../../../server/enrollments/schemas";

export const getEnrollmentsRouteMetadata = {
  permission: "enrollment.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, input }) =>
    await loadEnrollmentListResourceRef({
      tx,
      ctx,
      query: input,
    }),
} satisfies RouteMetadata<EnrollmentListQuery>;

export const postRouteMetadata = {
  permission: "enrollment.create",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, input }) => {
    return await loadCourseForEnrollmentResourceRef({
      tx,
      ctx,
      courseId: input.courseId,
    });
  },
} satisfies RouteMetadata<EnrollmentCreateBody>;

export const routeMetadata = postRouteMetadata;
