import type { RouteMetadata } from "@atlas/api/route-metadata";

/**
 * Same permission as editing one tag: a bulk re-scope or delete is the
 * single-tag mutation repeated, not a wider capability.
 */
export const postRouteMetadata = {
  permission: "course.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
} satisfies RouteMetadata;

export const routeMetadata = postRouteMetadata;
