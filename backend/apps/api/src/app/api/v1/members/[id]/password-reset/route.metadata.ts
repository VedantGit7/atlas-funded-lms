import type { RouteMetadata } from "@atlas/api/route-metadata";
import { getRouteMetadata as memberRouteMetadata } from "../route.metadata";

/**
 * Sends the member the "choose a new password" email. Like an invitation, it
 * emails the member a sign-in link, so it takes the invite permission.
 */
export const routeMetadata = {
  permission: "membership.invite",
  entitlement: null,
  audit: "required",
  mfa: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: memberRouteMetadata.resourceLoader,
} satisfies RouteMetadata;
