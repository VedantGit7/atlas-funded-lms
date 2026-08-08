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

export const connectZoomMetadata = {
  permission: "config.update",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

export const listZoomMeetingsMetadata = {
  permission: "reports.run",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantConfigRef({ ctx }),
} satisfies RouteMetadata;

export const zoomWebhookMetadata = {
  public: true,
  permission: "pub",
  rateLimit: "publicRead",
  idempotency: "none",
} as const;
