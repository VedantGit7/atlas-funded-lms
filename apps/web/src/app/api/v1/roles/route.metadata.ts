import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

export const getRouteMetadata = {
  permission: "role.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: ({ ctx }) =>
    Promise.resolve(
      createTenantResourceRef({
        type: "role_collection",
        id: ctx.tenantId,
        tenantId: ctx.tenantId,
      }),
    ),
} satisfies RouteMetadata;

export const postRouteMetadata = {
  permission: "role.create",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: getRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
