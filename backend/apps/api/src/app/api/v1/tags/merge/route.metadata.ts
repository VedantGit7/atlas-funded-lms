import type { RouteMetadata } from "@atlas/api/route-metadata";

/**
 * A merge deletes one tag and rewrites the other's attachments, so it carries
 * the same permission and the same audit requirement as a delete.
 */
export const postRouteMetadata = {
  permission: "course.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
} satisfies RouteMetadata;

export const routeMetadata = postRouteMetadata;
