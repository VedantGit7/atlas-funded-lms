import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

const selfPreferencesResourceLoader: RouteMetadata["resourceLoader"] = ({ ctx }) =>
  Promise.resolve(
    createTenantResourceRef({
      type: "member_profile",
      id: ctx.actorMembershipId,
      tenantId: ctx.tenantId,
      ownerMembershipId: ctx.actorMembershipId,
    }),
  );

export const getRouteMetadata = {
  permission: "profile.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: selfPreferencesResourceLoader,
} satisfies RouteMetadata;

export const putRouteMetadata = {
  permission: "profile.update",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: selfPreferencesResourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
