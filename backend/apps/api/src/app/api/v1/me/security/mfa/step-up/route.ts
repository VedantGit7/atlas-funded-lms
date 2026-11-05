import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { enforceMfaAttemptRateLimit } from "@atlas/api/rate-limit";
import { applyVerifiedSessionToCookieStore } from "@atlas/auth/cookie-store";
import { stepUpMfa } from "@atlas/auth";
import { AccountSecurityOkResponseSchema, MfaStepUpRequestSchema } from "@atlas/domain-identity";
import { securityMutationMetadata } from "../../route.metadata";

type MfaStepUpBody = z.output<typeof MfaStepUpRequestSchema>;

/**
 * POST /api/v1/me/security/mfa/step-up
 *
 * Completes MFA for the current session with an enrolled authenticator, so
 * routes that declare `mfa: "required"` accept it (audit H4). The session is
 * marked aal2 in place, so no new cookie is needed.
 */
export const POST = createTenantRoute<
  MfaStepUpBody,
  z.output<typeof AccountSecurityOkResponseSchema>
>({
  metadata: securityMutationMetadata,
  body: MfaStepUpRequestSchema,
  output: AccountSecurityOkResponseSchema,
  handler: async ({ ctx, input }) => {
    await enforceMfaAttemptRateLimit({
      tenantId: ctx.tenantId,
      actorId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    });
    const { session } = await stepUpMfa({ code: input.code });
    await applyVerifiedSessionToCookieStore(session);
    return { data: { ok: true as const } };
  },
});
