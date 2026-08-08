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

export const listAttributionEventsMetadata = {
  permission: "reports.run",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

export const createAttributionEventMetadata = {
  permission: "profile.update",
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    Promise.resolve(
      createTenantResourceRef({
        type: "membership",
        id: ctx.actorMembershipId,
        tenantId: ctx.tenantId,
      }),
    ),
} satisfies RouteMetadata;

export const createAttributionEventPublicMetadata = {
  public: true,
  permission: "pub",
  rateLimit: "publicRead",
  idempotency: "none",
} as const;
