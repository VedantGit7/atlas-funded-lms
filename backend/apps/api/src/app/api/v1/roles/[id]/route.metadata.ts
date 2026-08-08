import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";
import { requireRoleById } from "@atlas/domain-access";

export const putRouteMetadata = {
  permission: "role.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const roleId = params["id"];
    if (!roleId) {
      throw new Error("Missing role id");
    }

    const role = await requireRoleById({
      tx,
      tenantId: ctx.tenantId,
      roleId,
    });

    return createTenantResourceRef({
      type: "role",
      id: role.id,
      tenantId: ctx.tenantId,
    });
  },
} satisfies RouteMetadata;

export const deleteRouteMetadata = {
  permission: "role.delete",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: putRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const getByIdRouteMetadata = {
  permission: "role.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: putRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = putRouteMetadata;
