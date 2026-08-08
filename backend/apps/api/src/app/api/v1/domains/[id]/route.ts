import type { z } from "zod";

import { createTenantRoute } from "@atlas/api/create-tenant-route";

import {
  DeleteDomainResponseSchema,
  DomainParamsSchema,
} from "@atlas/domain-branding/schemas/domains";

import { deleteTenantDomain } from "@atlas/domain-branding";

import { routeMetadata } from "./route.metadata";

type DeleteDomainResponse = z.output<typeof DeleteDomainResponseSchema>;

export const DELETE = createTenantRoute<Record<string, never>, DeleteDomainResponse>({
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
