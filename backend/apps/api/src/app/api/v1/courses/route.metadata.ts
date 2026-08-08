import type { RouteMetadata } from "@atlas/api/route-metadata";
import type { CourseListQuery } from "../../../../server/courses/schemas";
import {
  loadCourseCatalogResourceRef,
  loadCourseStudioCatalogResourceRef,
} from "../../../../server/courses/load-course-resource-ref";

export const getRouteMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx, input }) => {
    if (input.view === "studio") {
      return loadCourseStudioCatalogResourceRef({ ctx });
    }
    return loadCourseCatalogResourceRef({ ctx });
  },
} satisfies RouteMetadata<CourseListQuery>;

export const postRouteMetadata = {
  permission: "course.create",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
