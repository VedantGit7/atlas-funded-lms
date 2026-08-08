import type { RouteMetadata } from "@atlas/api/route-metadata";
import { requireMembershipById } from "@atlas/membership/member-admin.repository";
import { createTenantResourceRef } from "@atlas/authorization";

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

export const manageLearnerArchiveMetadata = {
  permission: "membership.suspend",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: memberResourceLoader,
} satisfies RouteMetadata;
