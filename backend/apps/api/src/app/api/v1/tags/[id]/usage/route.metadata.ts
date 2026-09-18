import type { RouteMetadata } from "@atlas/api/route-metadata";

/** Reading where a tag is attached is a read of courses and lessons. */
export const getRouteMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
