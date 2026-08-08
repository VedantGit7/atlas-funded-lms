import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { verifyMfaEnrollment } from "@atlas/auth";
import {
  AccountSecurityOkResponseSchema,
  MfaVerifyRequestSchema,
} from "@atlas/domain-identity";
import { emitSecurityNotification } from "../../../../../../../lib/account-security-orchestrator";
import { securityMutationMetadata } from "../../route.metadata";

type MfaVerifyBody = z.output<typeof MfaVerifyRequestSchema>;

export const POST = createTenantRoute<MfaVerifyBody, z.output<typeof AccountSecurityOkResponseSchema>>({
  metadata: securityMutationMetadata,
  body: MfaVerifyRequestSchema,
  output: AccountSecurityOkResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    await verifyMfaEnrollment({ factorId: input.factorId, code: input.code });

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
        eventType: "security.mfa_enabled",
        email,
      });
    }

    return { data: { ok: true as const } };
  },
});
