import type { NextRequest } from "next/server";
import { createPlatformRoute } from "@atlas/api/create-platform-route";
import {
  PlatformTenantParamsSchema,
  PlatformTenantEntitlementListResponseSchema,
  PutPlatformTenantEntitlementsRequestSchema,
} from "@atlas/domain-tenancy/schemas/platform-tenants";
import {
  readPlatformTenantEntitlements,
  replacePlatformTenantEntitlements,
} from "@atlas/domain-tenancy";
import { routeMetadata, putRouteMetadata } from "./route.metadata";

const getEntitlements = createPlatformRoute({
  metadata: routeMetadata,
  params: PlatformTenantParamsSchema,
  output: PlatformTenantEntitlementListResponseSchema,
  handler: async ({ tx, params }) => {
    return readPlatformTenantEntitlements(tx, params.id);
  },
});

const putEntitlements = createPlatformRoute({
  metadata: putRouteMetadata,
  params: PlatformTenantParamsSchema,
  body: PutPlatformTenantEntitlementsRequestSchema,
  output: PlatformTenantEntitlementListResponseSchema,
  handler: async ({ tx, params, body, ctx }) => {
    return replacePlatformTenantEntitlements(
      tx,
      {
        tenantId: params.id,
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
        reason: ctx.reason,
      },
      body,
    );
  },
});

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getEntitlements(req, context);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return putEntitlements(req, context);
}
