import { createTenantRoute } from "@atlas/api";
import { enrollMfaTotp, listMfaFactors } from "@atlas/auth";
import { MfaEnrollResponseSchema, MfaListResponseSchema } from "@atlas/domain-identity";
import { securityMutationMetadata, securityReadMetadata } from "../route.metadata";

export const GET = createTenantRoute({
  metadata: securityReadMetadata,
  output: MfaListResponseSchema,
  handler: async () => {
    const result = await listMfaFactors();
    return { data: { factors: result.factors } };
  },
});

export const POST = createTenantRoute({
  metadata: securityMutationMetadata,
  output: MfaEnrollResponseSchema,
  handler: async () => {
    const result = await enrollMfaTotp();
    return { data: result };
  },
});
