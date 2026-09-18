import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { startPhoneChange } from "@atlas/auth";
import { AccountSecurityOkResponseSchema, ChangePhoneRequestSchema } from "@atlas/domain-identity";
import { securityMutationMetadata } from "../route.metadata";

type ChangePhoneBody = z.output<typeof ChangePhoneRequestSchema>;

export const POST = createTenantRoute<
  ChangePhoneBody,
  z.output<typeof AccountSecurityOkResponseSchema>
>({
  metadata: securityMutationMetadata,
  body: ChangePhoneRequestSchema,
  output: AccountSecurityOkResponseSchema,
  handler: async ({ input }) => {
    await startPhoneChange({ phone: input.phone });
    return { data: { ok: true as const } };
  },
});
