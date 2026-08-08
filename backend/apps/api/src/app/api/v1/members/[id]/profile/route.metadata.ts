import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";
import { requireMembershipById } from "@atlas/membership/member-admin.repository";

const profileResourceLoader: RouteMetadata["resourceLoader"] = async ({ tx, ctx, params }) => {
  const membershipId = params["id"];
  if (!membershipId) {
    throw new Error("Missing membership id");
  }

  const membership = await requireMembershipById({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  return createTenantResourceRef({
    type: "member_profile",
    id: membership.id,
    tenantId: ctx.tenantId,
    ownerMembershipId: membership.id,
  });
};

export const getRouteMetadata = {
  permission: "profile.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: profileResourceLoader,
} satisfies RouteMetadata;

export const putRouteMetadata = {
  permission: "profile.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: profileResourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
