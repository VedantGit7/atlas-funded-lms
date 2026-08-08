import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  DomainParamsSchema,
  SetPrimaryDomainResponseSchema,
} from "@atlas/domain-branding/schemas/domains";
import { setTenantDomainPrimary } from "@atlas/domain-branding";
import { routeMetadata } from "./route.metadata";

type SetPrimaryDomainResponse = z.output<typeof SetPrimaryDomainResponseSchema>;

export const PUT = createTenantRoute<
  Record<string, never>,
  SetPrimaryDomainResponse,
  typeof DomainParamsSchema
>({
  metadata: routeMetadata,
  input: noBodySchema,
  params: DomainParamsSchema,
  output: SetPrimaryDomainResponseSchema,
  handler: async ({ tx, params, ctx }) => {
    return setTenantDomainPrimary(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        requestId: ctx.requestId,
      },
      params.id,
    );
  },
});
