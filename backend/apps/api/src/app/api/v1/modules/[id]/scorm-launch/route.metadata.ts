import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadModuleLessonsResourceRef } from "../../../../../../server/courses/load-course-resource-ref";

export const getRouteMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");

    return await loadModuleLessonsResourceRef({
      tx,
      ctx,
      moduleId,
      requirePublished: true,
    });
  },
} satisfies RouteMetadata;

export const postRouteMetadata = {
  permission: "progress.read",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantMutation",
  idempotency: "none",
  resourceLoader: getRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
