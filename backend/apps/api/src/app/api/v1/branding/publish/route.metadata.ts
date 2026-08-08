import type { RouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "branding.publish",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
} satisfies RouteMetadata;
