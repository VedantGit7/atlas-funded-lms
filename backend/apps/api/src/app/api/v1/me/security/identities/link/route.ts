import type { z } from "zod";
import { assertRedirectOnRequestHost, createTenantRoute } from "@atlas/api";
import { startLinkIdentity } from "@atlas/auth";
import { LinkIdentityRequestSchema, LinkIdentityResponseSchema } from "@atlas/domain-identity";
import { securityMutationMetadata } from "../../route.metadata";

type LinkIdentityBody = z.output<typeof LinkIdentityRequestSchema>;

export const POST = createTenantRoute<
  LinkIdentityBody,
  z.output<typeof LinkIdentityResponseSchema>
>({
  metadata: securityMutationMetadata,
  body: LinkIdentityRequestSchema,
  output: LinkIdentityResponseSchema,
  handler: async ({ input, requestHost }) => {
    const result = await startLinkIdentity({
      provider: input.provider,
      redirectTo: assertRedirectOnRequestHost({
        value: input.redirectTo,
        requestHost: requestHost ?? "",
        field: "redirectTo",
      }),
    });
    return { data: result };
  },
});
