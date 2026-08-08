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

export const captureDeviceSessionMetadata = {
  permission: "profile.update",
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadMembershipCatalogRef({ ctx }),
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
