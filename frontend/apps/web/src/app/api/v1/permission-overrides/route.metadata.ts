import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

export const getRouteMetadata = {
  permission: "permission_override.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: ({ ctx }) =>
    Promise.resolve(
      createTenantResourceRef({
        type: "permission_override_collection",
        id: ctx.tenantId,
        tenantId: ctx.tenantId,
      }),
    ),
} satisfies RouteMetadata;

export const postRouteMetadata = {
  permission: "permission_override.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: getRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
