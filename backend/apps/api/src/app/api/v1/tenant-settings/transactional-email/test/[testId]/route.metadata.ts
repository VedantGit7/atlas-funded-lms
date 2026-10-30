import type { RouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  GET: {
    permission: "config.update",
    entitlement: null,
    audit: "none",
    rateLimit: "authenticatedTenantRead",
    idempotency: "none",
  } satisfies RouteMetadata,
};
