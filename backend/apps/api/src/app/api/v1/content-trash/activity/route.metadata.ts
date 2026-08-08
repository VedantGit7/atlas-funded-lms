import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadCourseStudioCatalogResourceRef } from "../../../../../server/courses/load-course-resource-ref";

export const getRouteMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadCourseStudioCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
