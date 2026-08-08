import type { RouteMetadata } from "@atlas/api/route-metadata";
import type { TagListQuery } from "../../../../server/tags/tag-schemas";

export const getRouteMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
} satisfies RouteMetadata<TagListQuery>;

export const postRouteMetadata = {
  permission: "course.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
