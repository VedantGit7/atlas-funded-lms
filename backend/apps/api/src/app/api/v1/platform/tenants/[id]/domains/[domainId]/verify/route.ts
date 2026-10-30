import type { NextRequest } from "next/server";
import { Resolver } from "node:dns/promises";
import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { verifyPlatformTenantDomain } from "@atlas/domain-tenancy";
import {
  PlatformTenantDomainParamsSchema,
  PlatformTenantDomainResponseSchema,
  TenantLifecycleRequestSchema,
} from "@atlas/domain-tenancy/schemas/platform-tenants";
import { forgetResolvedTenantHosts } from "@atlas/tenancy";
import { mutationRouteMetadata } from "../../route.metadata";

// Public resolvers rather than the container's: a record just created must be
// seen as soon as it is published, not after a local cache expires.
function resolveTxt(name: string): Promise<string[][]> {
  const resolver = new Resolver({ timeout: 5000, tries: 2 });
  resolver.setServers(["1.1.1.1", "8.8.8.8"]);
  return resolver.resolveTxt(name);
}

const verify = createPlatformRoute({
  metadata: mutationRouteMetadata,
  params: PlatformTenantDomainParamsSchema,
  body: TenantLifecycleRequestSchema,
  output: PlatformTenantDomainResponseSchema,
  handler: async ({ tx, params, ctx }) =>
    verifyPlatformTenantDomain(
      tx,
      {
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
        reason: ctx.reason,
      },
      params.id,
      params.domainId,
      resolveTxt,
    ),
});

/** Checks the domain's TXT record; a match makes requests for it reach the tenant. */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; domainId: string }> },
) {
  const response = await verify(req, context);
  // Committed: this process serves the new domain at once (others within 30 s).
  if (response.ok) forgetResolvedTenantHosts();
  return response;
}
