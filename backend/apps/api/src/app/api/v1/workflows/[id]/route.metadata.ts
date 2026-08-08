import type { RouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "workflow.definition.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
} satisfies RouteMetadata;

export const putRouteMetadata = routeMetadata;
