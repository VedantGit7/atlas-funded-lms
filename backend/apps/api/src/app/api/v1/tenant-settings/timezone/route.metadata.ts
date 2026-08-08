import type { RouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  GET: {
    permission: "config.read",
    entitlement: null,
    audit: "none",
    rateLimit: "authenticatedTenantRead",
    idempotency: "none",
  } satisfies RouteMetadata,
  PUT: {
    permission: "config.update",
    entitlement: null,
    audit: "required",
    rateLimit: "tenantMutation",
    idempotency: "required",
  } satisfies RouteMetadata,
};
