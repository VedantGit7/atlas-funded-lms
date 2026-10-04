import type { RouteMetadata } from "@atlas/api/route-metadata";

export const getRouteMetadata = {
  permission: "tenancy.domain.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;

export const postRouteMetadata = {
  permission: "tenancy.domain.manage",
  mfa: "required",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
} satisfies RouteMetadata;
