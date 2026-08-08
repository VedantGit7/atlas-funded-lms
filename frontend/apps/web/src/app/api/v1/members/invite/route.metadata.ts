import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

export const inviteRouteMetadata = {
  permission: "membership.invite",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: ({ ctx }) =>
    Promise.resolve(
      createTenantResourceRef({
        type: "membership_collection",
        id: ctx.tenantId,
        tenantId: ctx.tenantId,
      }),
    ),
} satisfies RouteMetadata;

export const routeMetadata = inviteRouteMetadata;
