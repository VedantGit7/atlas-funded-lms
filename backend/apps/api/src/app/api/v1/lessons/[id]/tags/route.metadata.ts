import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadLessonParentCourseResourceRef } from "../../../../../../server/courses/load-course-resource-ref";

export const getRouteMetadata = {
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
      requirePublished: false,
    });
  },
} satisfies RouteMetadata;

export const putRouteMetadata = {
  permission: "course.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: getRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const postRouteMetadata = {
  permission: "course.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: getRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const deleteRouteMetadata = {
  permission: "course.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: getRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
