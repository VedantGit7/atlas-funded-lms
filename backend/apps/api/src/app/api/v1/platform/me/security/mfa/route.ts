import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { enrollMfaTotp, listMfaFactors } from "@atlas/auth";
import { MfaEnrollResponseSchema, MfaListResponseSchema } from "@atlas/domain-identity";
import { mfaMutationMetadata, mfaReadMetadata } from "./route.metadata";

/** The operator's own factors, for the console's first-time MFA setup. */
export const GET = createPlatformRoute({
  metadata: mfaReadMetadata,
  output: MfaListResponseSchema,
  handler: async () => {
    const result = await listMfaFactors();
    return { data: { factors: result.factors } };
  },
});

/** Starts a TOTP enrollment; the factor counts only once verified. */
export const POST = createPlatformRoute({
  metadata: mfaMutationMetadata,
  output: MfaEnrollResponseSchema,
  handler: async () => {
    const result = await enrollMfaTotp();
    return { data: result };
  },
});
