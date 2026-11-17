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
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: selfSecurityResourceLoader,
} satisfies RouteMetadata;

/**
 * The step-up route takes the authenticator code, so a session still waiting
 * for its second factor may call it (security review 5.3, finding 2). It and
 * the factor list the code dialog reads first are the only routes such a
 * session reaches.
 */
export const securityStepUpMetadata = {
  ...securityMutationMetadata,
  mfa: "challenge",
} satisfies RouteMetadata;

export const securityReadMetadata = {
  permission: "profile.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: selfSecurityResourceLoader,
} satisfies RouteMetadata;

/** The account's own authenticators, which the code dialog lists before asking for a code. */
export const securityFactorListMetadata = {
  ...securityReadMetadata,
  mfa: "challenge",
} satisfies RouteMetadata;
