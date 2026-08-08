import type { RouteMetadata } from "@atlas/api/route-metadata";
import type { LessonDetailQuery } from "../../../../../../server/lessons/lesson-schemas";
import { loadModuleLessonsResourceRef } from "../../../../../../server/courses/load-course-resource-ref";

export const getRouteMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params, input }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");

    return await loadModuleLessonsResourceRef({
      tx,
      ctx,
      moduleId,
      requirePublished: input.view !== "studio",
    });
  },
} satisfies RouteMetadata<LessonDetailQuery>;

export const postRouteMetadata = {
  permission: "course.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");

    return await loadModuleLessonsResourceRef({
      tx,
      ctx,
      moduleId,
      requirePublished: false,
    });
  },
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
