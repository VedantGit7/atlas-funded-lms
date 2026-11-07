import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadModuleCourseResourceRef } from "../../../../../../server/courses/load-course-resource-ref";

/** Show or hide a module: the course's instructor, or an admin or owner. */
export const putRouteMetadata = {
  permission: "course.publish",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");
    return await loadModuleCourseResourceRef({ tx, ctx, moduleId });
  },
} satisfies RouteMetadata;

export const routeMetadata = putRouteMetadata;
