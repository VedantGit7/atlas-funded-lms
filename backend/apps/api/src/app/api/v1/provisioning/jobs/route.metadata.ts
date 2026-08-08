import type { RouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "tenancy.provisioning.read",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
} satisfies RouteMetadata;
