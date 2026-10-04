import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";
import { requireMembershipById } from "@atlas/membership/member-admin.repository";

const memberResourceLoader: RouteMetadata["resourceLoader"] = async ({ tx, ctx, params }) => {
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
    type: "membership",
    id: membership.id,
    tenantId: ctx.tenantId,
    ownerMembershipId: membership.id,
  });
};

export const postRouteMetadata = {
  permission: "membership.invite",
  mfa: "required",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: memberResourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = postRouteMetadata;
