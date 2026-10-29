import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { enforcePlatformMfaAttemptRateLimit } from "@atlas/api/rate-limit";
import {
  applyAuthSessionToCookieStore,
  readSessionPersistenceFromStore,
} from "@atlas/auth/cookie-store";
import { verifyMfaEnrollment } from "@atlas/auth";
import { AccountSecurityOkResponseSchema, MfaVerifyRequestSchema } from "@atlas/domain-identity";
import { mfaMutationMetadata } from "../route.metadata";

/**
 * Verifies the operator's new factor. Verification also completes MFA for this
 * session, so the aal2 session replaces the cookies and the console opens
 * without signing in again (as on the tenant route, audit H4).
 */
export const POST = createPlatformRoute({
  metadata: mfaMutationMetadata,
  body: MfaVerifyRequestSchema,
  output: AccountSecurityOkResponseSchema,
  handler: async ({ ctx, body }) => {
    await enforcePlatformMfaAttemptRateLimit({
      principalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    });
    const { session } = await verifyMfaEnrollment({ factorId: body.factorId, code: body.code });
    await applyAuthSessionToCookieStore({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresInSeconds: session.expiresIn,
      persistent: await readSessionPersistenceFromStore(),
    });
    return { data: { ok: true as const } };
  },
});
