import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadCourseResourceRef } from "../../../../../../server/courses/load-course-resource-ref";
import type { CourseManageEnrollmentBody } from "../../../../../../server/courses/course-authoring-schemas";

export const postRouteMetadata = {
  permission: "enrollment.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");

    return await loadCourseResourceRef({
      tx,
      ctx,
      courseId,
      requirePublished: false,
    });
  },
} satisfies RouteMetadata<CourseManageEnrollmentBody>;

export const routeMetadata = postRouteMetadata;
