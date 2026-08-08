import type { z } from "zod";

import { createTenantRoute, noBodySchema } from "@atlas/api";

import {
  CreateDomainRequestSchema,
  CreateDomainResponseSchema,
  DomainListResponseSchema,
} from "@atlas/domain-branding/schemas/domains";

import { createTenantDomain, readTenantDomains } from "@atlas/domain-branding";

import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

type DomainListResponse = z.output<typeof DomainListResponseSchema>;

type CreateDomainRequest = z.output<typeof CreateDomainRequestSchema>;

type CreateDomainResponse = z.output<typeof CreateDomainResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, DomainListResponse>({
  metadata: getRouteMetadata,

  input: noBodySchema,

  output: DomainListResponseSchema,

  // Domain service maps `type` through a runtime normalizer; assert DTO shape for the route.
  handler: async ({ tx }) => await readTenantDomains(tx),
});

export const POST = createTenantRoute<CreateDomainRequest, CreateDomainResponse>({
  metadata: postRouteMetadata,

  body: CreateDomainRequestSchema,

  output: CreateDomainResponseSchema,

  handler: async ({ tx, input, ctx }) => {
    return await createTenantDomain(
      tx,

      {
        tenantId: ctx.tenantId,

        actorMembershipId: ctx.actorMembershipId,

        requestId: ctx.requestId,
      },

      input,
    );
  },
});
