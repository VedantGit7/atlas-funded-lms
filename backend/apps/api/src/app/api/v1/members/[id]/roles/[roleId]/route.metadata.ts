import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";
import { requireMembershipById } from "@atlas/membership/member-admin.repository";

export const routeMetadata = {
  permission: "role.revoke",
  entitlement: null,
  audit: "required",
  mfa: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
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
  },
} satisfies RouteMetadata;
