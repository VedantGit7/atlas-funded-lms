import type { RouteMetadata } from "@atlas/api/route-metadata";
import { getRouteMetadata as memberRouteMetadata } from "../route.metadata";

/** Lifting a suspension takes the same permission (and MFA) as suspending. */
export const routeMetadata = {
  permission: "membership.suspend",
  entitlement: null,
  audit: "required",
  mfa: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: memberRouteMetadata.resourceLoader,
} satisfies RouteMetadata;
