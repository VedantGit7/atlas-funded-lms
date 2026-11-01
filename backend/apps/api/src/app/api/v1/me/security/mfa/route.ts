import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { enrollMfaTotp, listMfaFactors } from "@atlas/auth";
import {
  MfaEnrollRequestSchema,
  MfaEnrollResponseSchema,
  MfaListResponseSchema,
} from "@atlas/domain-identity";
import { securityMutationMetadata, securityReadMetadata } from "../route.metadata";

export const GET = createTenantRoute({
  metadata: securityReadMetadata,
  output: MfaListResponseSchema,
  handler: async () => {
    const result = await listMfaFactors();
    return { data: { factors: result.factors } };
  },
});

export const POST = createTenantRoute<
  z.output<typeof MfaEnrollRequestSchema>,
  z.output<typeof MfaEnrollResponseSchema>
>({
  metadata: securityMutationMetadata,
  body: MfaEnrollRequestSchema,
  output: MfaEnrollResponseSchema,
  handler: async ({ input }) => {
    const result = await enrollMfaTotp({ password: input.password });
    return { data: result };
  },
});
