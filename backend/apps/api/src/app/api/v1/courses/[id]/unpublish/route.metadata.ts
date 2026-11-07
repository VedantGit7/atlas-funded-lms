import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadCourseResourceRef } from "../../../../../../server/courses/load-course-resource-ref";

const loadCourse: RouteMetadata["resourceLoader"] = async ({ tx, ctx, params }) => {
  const courseId = params["id"];
  if (!courseId) throw new Error("Missing course id");
  return await loadCourseResourceRef({ tx, ctx, courseId, requirePublished: false });
};

/** What unpublishing would do (enrolled learners), for the confirmation. */
export const getRouteMetadata = {
  permission: "course.publish",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadCourse,
} satisfies RouteMetadata;

/** Take a live course offline: the course's instructor, or an admin or owner. */
export const postRouteMetadata = {
  permission: "course.publish",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: loadCourse,
} satisfies RouteMetadata;

export const routeMetadata = postRouteMetadata;
