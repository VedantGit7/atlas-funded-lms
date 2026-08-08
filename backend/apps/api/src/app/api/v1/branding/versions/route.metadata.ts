import type { RouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "branding.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
} satisfies RouteMetadata;
