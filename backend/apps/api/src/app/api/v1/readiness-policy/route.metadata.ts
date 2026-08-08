import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadReadinessPolicyResourceRef } from "../../../../server/readiness/readiness.resource-loaders";

export const getRouteMetadata = {
  permission: "readiness_policy.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadReadinessPolicyResourceRef({ ctx }),
} satisfies RouteMetadata;

export const putRouteMetadata = {
  permission: "readiness_policy.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadReadinessPolicyResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
