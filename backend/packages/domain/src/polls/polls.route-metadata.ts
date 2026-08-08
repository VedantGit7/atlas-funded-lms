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

export const listPollsMetadata = {
  permission: "membership.read",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

export const createPollMetadata = {
  permission: "config.update",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

export const getPollMetadata = listPollsMetadata;
export const updatePollMetadata = createPollMetadata;
export const deletePollMetadata = createPollMetadata;
export const getPollResultsMetadata = listPollsMetadata;

export const respondPollMetadata = {
  permission: "enrollment.read",
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    Promise.resolve(
      createTenantResourceRef({
        type: "enrollment",
        id: ctx.actorMembershipId,
        tenantId: ctx.tenantId,
      }),
    ),
} satisfies RouteMetadata;
