import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { enrollMfaTotp, listMfaFactors } from "@atlas/auth";
import {
  MfaEnrollRequestSchema,
  MfaEnrollResponseSchema,
  MfaListResponseSchema,
} from "@atlas/domain-identity";
import { securityFactorListMetadata, securityMutationMetadata } from "../route.metadata";

export const GET = createTenantRoute({
  // A session still waiting for its code reaches this, for the code dialog.
  metadata: securityFactorListMetadata,
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
