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

export const listCouponsMetadata = {
  permission: "config.update",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

export const mutateCouponsMetadata = {
  permission: "config.update",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

export const learnerCouponMetadata = {
  permission: "enrollment.create",
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadSelfEnrollmentRef({ ctx }),
} satisfies RouteMetadata;

export const learnerCouponReadMetadata = {
  permission: "enrollment.create",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadSelfEnrollmentRef({ ctx }),
} satisfies RouteMetadata;
