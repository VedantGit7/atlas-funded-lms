import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadLessonParentCourseResourceRef } from "../../../../../../server/courses/load-course-resource-ref";

export const listLessonCommentsMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");

    return await loadLessonParentCourseResourceRef({
      tx,
      ctx,
      lessonId,
      requirePublished: true,
    });
  },
} satisfies RouteMetadata;

export const createLessonCommentMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: listLessonCommentsMetadata.resourceLoader,
} satisfies RouteMetadata;
