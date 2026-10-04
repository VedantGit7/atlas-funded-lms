import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { enforceMfaAttemptRateLimit } from "@atlas/api/rate-limit";
import {
  applyAuthSessionToCookieStore,
  readSessionPersistenceFromStore,
} from "@atlas/auth/cookie-store";
import { verifyMfaEnrollment } from "@atlas/auth";
import { AccountSecurityOkResponseSchema, MfaVerifyRequestSchema } from "@atlas/domain-identity";
import { emitSecurityNotification } from "../../../../../../../lib/account-security-orchestrator";
import { securityMutationMetadata } from "../../route.metadata";

type MfaVerifyBody = z.output<typeof MfaVerifyRequestSchema>;

export const POST = createTenantRoute<
  MfaVerifyBody,
  z.output<typeof AccountSecurityOkResponseSchema>
>({
  metadata: securityMutationMetadata,
  body: MfaVerifyRequestSchema,
  output: AccountSecurityOkResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    await enforceMfaAttemptRateLimit({
      tenantId: ctx.tenantId,
      actorId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    });
    const { session } = await verifyMfaEnrollment({ factorId: input.factorId, code: input.code });
    // Verifying the new factor also completed MFA for this session: keep that
    // aal2 session, so a step-up that needed enrollment is satisfied (audit H4).
    await applyAuthSessionToCookieStore({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresInSeconds: session.expiresIn,
      persistent: await readSessionPersistenceFromStore(),
    });

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
