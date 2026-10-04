import type { RouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "tenancy.domain.manage",
  mfa: "required",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
} satisfies RouteMetadata;
