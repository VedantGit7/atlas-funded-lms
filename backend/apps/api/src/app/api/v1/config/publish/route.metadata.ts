import type { RouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "config.publish",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
} satisfies RouteMetadata;
