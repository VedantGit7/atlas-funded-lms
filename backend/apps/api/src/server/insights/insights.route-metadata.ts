import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function loadInsightsResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "analytics_rollup",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export const insightDashboardMetadata = {
  permission: "insights.view",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadInsightsResourceRef({ ctx }),
} satisfies RouteMetadata;
