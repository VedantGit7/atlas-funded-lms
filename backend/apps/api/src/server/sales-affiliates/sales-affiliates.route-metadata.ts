import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

type LoaderCtx = { tenantId: string; actorMembershipId: string };

function loadTenantConfigRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "tenant_config",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

function loadSelfEnrollmentRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "member_enrollments",
      id: args.ctx.actorMembershipId,
      tenantId: args.ctx.tenantId,
      ownerMembershipId: args.ctx.actorMembershipId,
      relationships: {
        selfEnrollmentList: args.ctx.actorMembershipId,
      },
    }),
  );
}

export const adminAffiliateReadMetadata = {
  permission: "config.update",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

export const adminAffiliateWriteMetadata = {
  permission: "config.update",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

/**
 * Editing a partner can redirect where their commissions are paid, and the
 * reveal returns full bank and UPI details: both require step-up MFA (audit M6).
 */
export const adminAffiliatePartnerWriteMetadata = {
  ...adminAffiliateWriteMetadata,
  mfa: "required",
} satisfies RouteMetadata;

export const adminAffiliatePayoutRevealMetadata = {
  ...adminAffiliateWriteMetadata,
  mfa: "required",
} satisfies RouteMetadata;

export const learnerAffiliateReadMetadata = {
  permission: "enrollment.create",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadSelfEnrollmentRef({ ctx }),
} satisfies RouteMetadata;

export const learnerAffiliateWriteMetadata = {
  permission: "enrollment.create",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadSelfEnrollmentRef({ ctx }),
} satisfies RouteMetadata;
