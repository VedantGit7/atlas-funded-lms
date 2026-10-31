import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import {
  authProvider,
  authRequestContext,
  resetPasswordWithBetterAuth,
  resetPasswordWithRecoverySession,
} from "@atlas/auth";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  PublicPasswordResetCompleteResponseSchema,
  PublicPasswordResetCompleteSchema,
  rejectClientTenantId,
} from "@atlas/domain-identity";
import { resolveRequestHostFromHeaders } from "@atlas/tenancy";
import { notifyPasswordReset } from "../../../../../../lib/account-security-orchestrator";
import { routeMetadata } from "./route.metadata";

function resetLinkInvalid(): AtlasHttpError {
  return new AtlasHttpError({
    code: "AUTH_REQUIRED",
    status: 401,
    message: "Reset link is invalid or expired.",
  });
}

/**
 * Completes "forgot password". With Supabase, from the session the recovery
 * email link signed in, asking accounts with MFA for their authenticator code
 * first. With Better Auth, from the link's single-use token: every session
 * ends and none starts, so an account with MFA still needs its code to sign
 * in. A changed password sends the same security email as an in-app change.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicPasswordResetCompleteSchema.parse(rawBody);
  const host = resolveRequestHostFromHeaders(req.headers);

  if (authProvider() === "better-auth") {
    if (!input.token) throw resetLinkInvalid();
    const reset = await resetPasswordWithBetterAuth({
      ctx: authRequestContext(req),
      token: input.token,
      password: input.password,
    });
    await notifyPasswordReset({
      host,
      requestId,
      who: { principalId: reset.principalId },
      email: reset.email,
    });
    return NextResponse.json(
      PublicPasswordResetCompleteResponseSchema.parse({ data: { status: "RESET" } }),
    );
  }

  if (!input.accessToken) throw resetLinkInvalid();

  const result = await resetPasswordWithRecoverySession({
    accessToken: input.accessToken,
    refreshToken: input.refreshToken ?? "",
    password: input.password,
    mfaCode: input.mfaCode,
  });

  if (result.status === "RESET") {
    await notifyPasswordReset({
      host,
      requestId,
      who: { supabaseUserId: result.supabaseUserId },
      email: result.email,
    });
  }

  return NextResponse.json(
    PublicPasswordResetCompleteResponseSchema.parse({ data: { status: result.status } }),
  );
});
