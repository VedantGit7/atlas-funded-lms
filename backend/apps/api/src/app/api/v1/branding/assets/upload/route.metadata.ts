import type { RouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "branding.update",
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
} satisfies RouteMetadata;
