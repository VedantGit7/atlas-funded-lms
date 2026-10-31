import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { resetPasswordWithRecoverySession } from "@atlas/auth";
import {
  PublicPasswordResetCompleteResponseSchema,
  PublicPasswordResetCompleteSchema,
  rejectClientTenantId,
} from "@atlas/domain-identity";
import { resolveRequestHostFromHeaders } from "@atlas/tenancy";
import { notifyPasswordReset } from "../../../../../../lib/account-security-orchestrator";
import { routeMetadata } from "./route.metadata";

/**
 * Completes "forgot password" with the session the recovery email link signed
 * in, asking accounts with MFA for their authenticator code first. A changed
 * password sends the same security email as an in-app change.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicPasswordResetCompleteSchema.parse(rawBody);

  const result = await resetPasswordWithRecoverySession({
    accessToken: input.accessToken,
    refreshToken: input.refreshToken ?? "",
    password: input.password,
    mfaCode: input.mfaCode,
  });

  if (result.status === "RESET") {
    await notifyPasswordReset({
      host: resolveRequestHostFromHeaders(req.headers),
      requestId,
      supabaseUserId: result.supabaseUserId,
      email: result.email,
    });
  }

  return NextResponse.json(
    PublicPasswordResetCompleteResponseSchema.parse({ data: { status: result.status } }),
  );
});
