import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

export const getRouteMetadata = {
  permission: "membership.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: ({ ctx }) =>
    Promise.resolve(
      createTenantResourceRef({
        type: "membership_collection",
        id: ctx.tenantId,
        tenantId: ctx.tenantId,
      }),
    ),
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;

export const postInviteRouteMetadata = {
  permission: "membership.invite",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: ({ ctx }) =>
    Promise.resolve(
      createTenantResourceRef({
        type: "membership_collection",
        id: ctx.tenantId,
        tenantId: ctx.tenantId,
      }),
    ),
} satisfies RouteMetadata;

export const inviteRouteMetadata = postInviteRouteMetadata;
