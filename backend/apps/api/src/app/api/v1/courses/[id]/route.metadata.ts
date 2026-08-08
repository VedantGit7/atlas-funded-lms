import type { RouteMetadata } from "@atlas/api/route-metadata";
import type { CourseDetailQuery } from "../../../../../server/courses/course-authoring-schemas";
import { loadCourseResourceRef } from "../../../../../server/courses/load-course-resource-ref";

export const getRouteMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");

    return await loadCourseResourceRef({
      tx,
      ctx,
      courseId,
      requirePublished: input.view !== "studio",
    });
  },
} satisfies RouteMetadata<CourseDetailQuery>;

export const putRouteMetadata = {
  permission: "course.update",
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
} satisfies RouteMetadata;

export const deleteRouteMetadata = {
  permission: "course.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: putRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
