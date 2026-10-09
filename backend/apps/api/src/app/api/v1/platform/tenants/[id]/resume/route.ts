import type { NextRequest } from "next/server";
import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { forgetResolvedTenantHosts } from "@atlas/tenancy";
import {
  PlatformTenantParamsSchema,
  PlatformTenantDetailResponseSchema,
  TenantLifecycleRequestSchema,
} from "@atlas/domain-tenancy/schemas/platform-tenants";
import { resumeTenant } from "@atlas/domain-tenancy";
import { routeMetadata } from "./route.metadata";

const resume = createPlatformRoute({
  metadata: routeMetadata,
  params: PlatformTenantParamsSchema,
  body: TenantLifecycleRequestSchema,
  output: PlatformTenantDetailResponseSchema,
  handler: async ({ tx, params, ctx }) =>
    resumeTenant(
      tx,
      {
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
        reason: ctx.reason,
      },
      params.id,
    ),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const response = await resume(req, context);
  // Committed: this process stops serving the old state at once (others within 30 s).
  if (response.ok) forgetResolvedTenantHosts();
  return response;
}
