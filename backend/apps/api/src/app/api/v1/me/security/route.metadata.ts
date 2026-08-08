import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

const selfSecurityResourceLoader: RouteMetadata["resourceLoader"] = ({ ctx }) =>
  Promise.resolve(
    createTenantResourceRef({
      type: "member_profile",
      id: ctx.actorMembershipId,
      tenantId: ctx.tenantId,
      ownerMembershipId: ctx.actorMembershipId,
    }),
  );

export const securityMutationMetadata = {
  permission: "profile.update",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: selfSecurityResourceLoader,
} satisfies RouteMetadata;

export const securityReadMetadata = {
  permission: "profile.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: selfSecurityResourceLoader,
} satisfies RouteMetadata;
