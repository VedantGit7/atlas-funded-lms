import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

function loadMembershipCatalogRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "membership",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

/**
 * A member records their own device session, so the check is `profile.update`
 * on their own profile, as on the /me routes. Checking it against the tenant
 * refused everyone without an admin role's resource bypass: learners got a 403
 * on every page load (launch plan 5.1, staging, 6 November 2026).
 */
function loadOwnProfileRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "member_profile",
      id: args.ctx.actorMembershipId,
      tenantId: args.ctx.tenantId,
      ownerMembershipId: args.ctx.actorMembershipId,
    }),
  );
}

export const captureDeviceSessionMetadata = {
  permission: "profile.update",
  audit: "none",
  auditExempt: "client_telemetry",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadOwnProfileRef({ ctx }),
} satisfies RouteMetadata;

export const listDeviceSessionsMetadata = {
  permission: "membership.read",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadMembershipCatalogRef({ ctx }),
} satisfies RouteMetadata;

export const deleteDeviceSessionsMetadata = {
  permission: "membership.suspend",
  mfa: "required",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadMembershipCatalogRef({ ctx }),
} satisfies RouteMetadata;

export const forceSignOutMetadata = {
  permission: "membership.suspend",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadMembershipCatalogRef({ ctx }),
} satisfies RouteMetadata;
