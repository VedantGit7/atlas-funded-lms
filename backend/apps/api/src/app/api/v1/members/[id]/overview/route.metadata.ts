import type { RouteMetadata } from "@atlas/api/route-metadata";
import { getRouteMetadata as memberGetRouteMetadata } from "../route.metadata";

/** The member page's learner profile: same access as reading the member. */
export const getRouteMetadata = {
  permission: "membership.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: memberGetRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
