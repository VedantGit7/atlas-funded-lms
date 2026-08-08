import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadSelfAttributionResourceRef } from "../../../../../server/readiness/readiness.resource-loaders";

export const postRouteMetadata = {
  permission: "readiness_policy.read",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadSelfAttributionResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = postRouteMetadata;
