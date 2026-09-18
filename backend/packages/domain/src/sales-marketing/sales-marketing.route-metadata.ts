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

/** Totals over the event log are the same read as the log itself. */
export const summariseAttributionEventsMetadata = {
  permission: "reports.run",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

/** Reading the retention policy is a read over reporting configuration. */
export const getAttributionRetentionMetadata = {
  permission: "reports.run",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

/**
 * Setting it is a configuration change with a destructive consequence.
 *
 * `config.update` rather than `reports.run`: choosing a retention window is a
 * decision to delete data on a schedule, and reading reports should not carry
 * that authority. Audited for the same reason.
 */
export const setAttributionRetentionMetadata = {
  permission: "config.update",
  entitlement: "analytics.dashboard.view",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

/** Running the purge by hand deletes rows now, so it is audited and idempotent. */
export const purgeAttributionEventsMetadata = {
  permission: "config.update",
  entitlement: "analytics.dashboard.view",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

/** Listing the attribution gaps is the same read as reading the log. */
export const getAttributionGapsMetadata = {
  permission: "reports.run",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

/** Scanning for anomalies is the same read as reading the log. */
export const getAttributionAnomaliesMetadata = {
  permission: "reports.run",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

/** Reading the health series is the same read as reading the log. */
export const getAttributionHealthMetadata = {
  permission: "reports.run",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

/** Grouping the log is the same read as listing it. */
export const getAttributionBreakdownMetadata = {
  permission: "reports.run",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

/** Exporting the log is the same read as listing it. */
export const exportAttributionEventsMetadata = {
  permission: "reports.run",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

/** Reading one event is the same read as reading the log it sits in. */
export const getAttributionEventMetadata = {
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
