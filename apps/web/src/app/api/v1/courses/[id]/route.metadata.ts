import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadCourseResourceRef } from "../../../../../server/courses/load-course-resource-ref";

export const getRouteMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");

    return await loadCourseResourceRef({
      tx,
      ctx,
      courseId,
      requirePublished: true,
    });
  },
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
