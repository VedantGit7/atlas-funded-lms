import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadLessonParentCourseResourceRef } from "../../../../../../server/courses/load-course-resource-ref";

export const postRouteMetadata = {
  permission: "progress.read",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantMutation",
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

export const routeMetadata = postRouteMetadata;
