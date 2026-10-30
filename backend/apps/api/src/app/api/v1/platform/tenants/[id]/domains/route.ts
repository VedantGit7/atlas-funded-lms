import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { addPlatformTenantCustomDomain, listPlatformTenantDomains } from "@atlas/domain-tenancy";
import {
  AddPlatformTenantDomainRequestSchema,
  PlatformTenantDomainListResponseSchema,
  PlatformTenantDomainResponseSchema,
  PlatformTenantParamsSchema,
} from "@atlas/domain-tenancy/schemas/platform-tenants";
import { mutationRouteMetadata, routeMetadata } from "./route.metadata";

/** A tenant's domains, with the TXT record each pending one needs. */
export const GET = createPlatformRoute({
  metadata: routeMetadata,
  params: PlatformTenantParamsSchema,
  output: PlatformTenantDomainListResponseSchema,
  handler: async ({ tx, params }) => listPlatformTenantDomains(tx, params.id),
});

/** Adds a custom domain, pending until its TXT record is verified. */
export const POST = createPlatformRoute({
  metadata: mutationRouteMetadata,
  params: PlatformTenantParamsSchema,
  body: AddPlatformTenantDomainRequestSchema,
  output: PlatformTenantDomainResponseSchema,
  handler: async ({ tx, params, body, ctx }) => {
    const platformHost = process.env["PLATFORM_HOST"]?.trim().toLowerCase();
    return addPlatformTenantCustomDomain(
      tx,
      {
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
        reason: ctx.reason,
      },
      params.id,
      { hostname: body.hostname },
      { reservedHostnames: platformHost ? [platformHost] : [] },
    );
  },
});
