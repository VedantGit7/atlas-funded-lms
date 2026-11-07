import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadLessonParentCourseResourceRef } from "../../../../../../server/courses/load-course-resource-ref";

/** Show or hide a lesson: the course's instructor, or an admin or owner. */
export const putRouteMetadata = {
  permission: "course.publish",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await loadLessonParentCourseResourceRef({
      tx,
      ctx,
      lessonId,
      requirePublished: false,
    });
  },
} satisfies RouteMetadata;

export const routeMetadata = putRouteMetadata;
