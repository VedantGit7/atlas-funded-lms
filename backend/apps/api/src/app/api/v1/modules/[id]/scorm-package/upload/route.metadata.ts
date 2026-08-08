import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadModuleParentCourseResourceRef } from "../../../../../../../server/courses/load-course-resource-ref";

export const postRouteMetadata = {
  permission: "course.update",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");

    return await loadModuleParentCourseResourceRef({
      tx,
      ctx,
      moduleId,
    });
  },
} satisfies RouteMetadata;

export const routeMetadata = postRouteMetadata;
