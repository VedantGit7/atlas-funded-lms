import type { RouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "branding.update",
  entitlement: null,
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
} satisfies RouteMetadata;
