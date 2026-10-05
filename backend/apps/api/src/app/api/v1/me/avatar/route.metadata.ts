import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

const selfAvatarResourceLoader: RouteMetadata["resourceLoader"] = ({ ctx }) =>
  Promise.resolve(
    createTenantResourceRef({
      type: "member_profile",
      id: ctx.actorMembershipId,
      tenantId: ctx.tenantId,
      ownerMembershipId: ctx.actorMembershipId,
    }),
  );

export const avatarMutationMetadata = {
  permission: "profile.update",
  entitlement: null,
  audit: "none",
  auditExempt: "own_preferences",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: selfAvatarResourceLoader,
} satisfies RouteMetadata;
