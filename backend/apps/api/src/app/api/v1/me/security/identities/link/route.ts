import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
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
  handler: async ({ input }) => {
    // Google sends the person back to /auth/callback/google on this host.
    const result = await startLinkIdentity({ provider: input.provider });
    return { data: result };
  },
});
