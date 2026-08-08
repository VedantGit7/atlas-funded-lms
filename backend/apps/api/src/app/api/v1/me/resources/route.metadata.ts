import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadCourseCatalogResourceRef } from "../../../../../server/courses/load-course-resource-ref";

export const routeMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadCourseCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;
