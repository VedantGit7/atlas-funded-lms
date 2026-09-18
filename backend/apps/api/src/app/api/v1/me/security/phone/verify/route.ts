import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { verifyPhoneChange } from "@atlas/auth";
import { AccountSecurityOkResponseSchema, VerifyPhoneRequestSchema } from "@atlas/domain-identity";
import { emitSecurityNotification } from "../../../../../../../lib/account-security-orchestrator";
import { securityMutationMetadata } from "../../route.metadata";

type VerifyPhoneBody = z.output<typeof VerifyPhoneRequestSchema>;

export const POST = createTenantRoute<
  VerifyPhoneBody,
  z.output<typeof AccountSecurityOkResponseSchema>
>({
  metadata: securityMutationMetadata,
  body: VerifyPhoneRequestSchema,
  output: AccountSecurityOkResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    await verifyPhoneChange({ phone: input.phone, token: input.token });

    const emailRows = await tx.$queryRaw<Array<{ email: string }>>`
      select ap.email
      from memberships m
      join auth_principals ap on ap.id = m.auth_principal_id
      where m.id = ${ctx.actorMembershipId}::uuid
        and m.tenant_id = ${ctx.tenantId}::uuid
      limit 1
    `;

    const email = emailRows[0]?.email;
    if (email) {
      await emitSecurityNotification(tx, ctx, {
        eventType: "security.phone_changed",
        email,
      });
    }

    return { data: { ok: true as const } };
  },
});
