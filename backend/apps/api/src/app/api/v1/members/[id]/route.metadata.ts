import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";
import { requireMembershipById } from "@atlas/membership/member-admin.repository";

export const getRouteMetadata = {
  permission: "membership.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const membershipId = params["id"];
    if (!membershipId) throw new Error("Missing membership id");

    const membership = await requireMembershipById({
      tx,
      tenantId: ctx.tenantId,
      membershipId,
    });

    return createTenantResourceRef({
      type: "membership",
      id: membership.id,
      tenantId: ctx.tenantId,
      ownerMembershipId: membership.id,
    });
  },
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;

export const deleteRouteMetadata = {
  permission: "membership.remove",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: getRouteMetadata.resourceLoader,
} satisfies RouteMetadata;
