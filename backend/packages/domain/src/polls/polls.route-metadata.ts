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

/**
 * Respondent-scoped read. Same permission as responding, because the learner
 * who may answer a poll must be able to see it; enumerating polls stays on
 * `membership.read` via listPollsMetadata.
 */
export const getPollRespondentViewMetadata = {
  permission: "enrollment.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

export const respondPollMetadata = {
  permission: "enrollment.read",
  audit: "none",
  auditExempt: "learner_activity",
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
