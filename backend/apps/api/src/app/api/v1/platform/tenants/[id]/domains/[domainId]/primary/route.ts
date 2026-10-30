import type { NextRequest } from "next/server";
import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { setPlatformTenantPrimaryDomain } from "@atlas/domain-tenancy";
import {
  PlatformTenantDomainParamsSchema,
  PlatformTenantDomainResponseSchema,
  TenantLifecycleRequestSchema,
} from "@atlas/domain-tenancy/schemas/platform-tenants";
import { forgetResolvedTenantHosts } from "@atlas/tenancy";
import { mutationRouteMetadata } from "../../route.metadata";

const setPrimary = createPlatformRoute({
  metadata: mutationRouteMetadata,
  params: PlatformTenantDomainParamsSchema,
  body: TenantLifecycleRequestSchema,
  output: PlatformTenantDomainResponseSchema,
  handler: async ({ tx, params, ctx }) =>
    setPlatformTenantPrimaryDomain(
      tx,
      {
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
        reason: ctx.reason,
      },
      params.id,
      params.domainId,
    ),
});

/** Makes a verified domain the tenant's primary one, the address its links use. */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; domainId: string }> },
) {
  const response = await setPrimary(req, context);
  if (response.ok) forgetResolvedTenantHosts();
  return response;
}
