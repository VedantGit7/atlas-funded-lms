import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadLessonParentCourseResourceRef } from "../../../../../../../server/courses/load-course-resource-ref";

export const postUploadRouteMetadata = {
  permission: "course.update",
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

export const postBlobRouteMetadata = postUploadRouteMetadata;
export const postConfirmRouteMetadata = postUploadRouteMetadata;
