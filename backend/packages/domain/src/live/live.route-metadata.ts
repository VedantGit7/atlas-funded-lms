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

export const listLiveSessionsMetadata = {
  permission: "reports.run",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

export const createLiveSessionMetadata = {
  permission: "config.update",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

export const getLiveSessionMetadata = listLiveSessionsMetadata;
export const updateLiveSessionMetadata = createLiveSessionMetadata;
export const deleteLiveSessionMetadata = createLiveSessionMetadata;
export const listLiveAttendanceMetadata = listLiveSessionsMetadata;

export const checkInLiveAttendanceMetadata = {
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
