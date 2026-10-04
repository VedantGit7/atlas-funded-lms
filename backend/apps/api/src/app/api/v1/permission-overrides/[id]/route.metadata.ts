import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

export const routeMetadata = {
  permission: "permission_override.manage",
  mfa: "required",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: ({ ctx }) =>
    Promise.resolve(
      createTenantResourceRef({
        type: "permission_override_collection",
        id: ctx.tenantId,
        tenantId: ctx.tenantId,
      }),
    ),
} satisfies RouteMetadata;
