import type { NextRequest } from "next/server";
import type { z } from "zod";

import { forgetResolvedTenantHosts } from "@atlas/tenancy";

import { createTenantRoute } from "@atlas/api/create-tenant-route";

import {
  DeleteDomainResponseSchema,
  DomainParamsSchema,
} from "@atlas/domain-branding/schemas/domains";

import { deleteTenantDomain } from "@atlas/domain-branding";

import { routeMetadata } from "./route.metadata";

type DeleteDomainResponse = z.output<typeof DeleteDomainResponseSchema>;

const deleteDomain = createTenantRoute<Record<string, never>, DeleteDomainResponse>({
  metadata: routeMetadata,

  params: DomainParamsSchema,

  output: DeleteDomainResponseSchema,

  handler: async ({ tx, params, ctx }) => {
    const { id } = DomainParamsSchema.parse(params);

    return deleteTenantDomain(
      tx,

      {
        tenantId: ctx.tenantId,

        actorMembershipId: ctx.actorMembershipId,

        requestId: ctx.requestId,
      },

      id,
    );
  },
});

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const response = await deleteDomain(req, context);
  // Committed: this process stops resolving the deleted hostname at once (others within 30 s).
  if (response.ok) forgetResolvedTenantHosts();
  return response;
}
