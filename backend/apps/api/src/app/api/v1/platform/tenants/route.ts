import { createPlatformRoute } from "@atlas/api/create-platform-route";
import {
  PlatformTenantListQuerySchema,
  PlatformTenantListResponseSchema,
  ProvisionTenantRequestSchema,
  ProvisionTenantResponseSchema,
} from "@atlas/domain-tenancy/schemas/platform-tenants";
import { readPlatformTenants, provisionTenant } from "@atlas/domain-tenancy";
import { routeMetadata, postRouteMetadata } from "./route.metadata";

export const GET = createPlatformRoute({
  metadata: routeMetadata,
  query: PlatformTenantListQuerySchema,
  output: PlatformTenantListResponseSchema,
  handler: async ({ tx, query }) => {
    return readPlatformTenants(tx, query);
  },
});

export const POST = createPlatformRoute({
  metadata: postRouteMetadata,
  body: ProvisionTenantRequestSchema,
  output: ProvisionTenantResponseSchema,
  handler: async ({ tx, body, ctx }) => {
    return provisionTenant(
      tx,
      {
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
        reason: ctx.reason,
        idempotencyKey: ctx.idempotencyKey,
        tenantBaseDomain: process.env["TENANT_BASE_DOMAIN"] ?? "localhost.test",
      },
      body,
    );
  },
});
