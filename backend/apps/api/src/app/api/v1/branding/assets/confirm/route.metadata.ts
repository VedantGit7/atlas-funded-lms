import type { RouteMetadata } from "@atlas/api/route-metadata";

/** Finalizing a branding upload makes it usable as the tenant's public brand (audit M8). */
export const routeMetadata = {
  permission: "branding.update",
  entitlement: null,
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
} satisfies RouteMetadata;
