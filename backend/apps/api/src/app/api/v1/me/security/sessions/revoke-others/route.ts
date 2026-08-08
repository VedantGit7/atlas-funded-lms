import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { signOutOtherSessions } from "@atlas/auth";
import { AccountSecurityOkResponseSchema } from "@atlas/domain-identity";
import { securityMutationMetadata } from "../../route.metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof AccountSecurityOkResponseSchema>
>({
  metadata: securityMutationMetadata,
  output: AccountSecurityOkResponseSchema,
  handler: async () => {
    await signOutOtherSessions();
    return { data: { ok: true as const } };
  },
});
