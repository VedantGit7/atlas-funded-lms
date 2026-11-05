import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { authRequestContext, resetPasswordWithBetterAuth } from "@atlas/auth";
import {
  PublicPasswordResetCompleteResponseSchema,
  PublicPasswordResetCompleteSchema,
  rejectClientTenantId,
} from "@atlas/domain-identity";
import { resolveRequestHostFromHeaders } from "@atlas/tenancy";
import { notifyPasswordReset } from "../../../../../../lib/account-security-orchestrator";
import { routeMetadata } from "./route.metadata";

/**
 * Completes "forgot password" from the link's single-use token. Every session
 * ends and none starts, so an account with MFA still needs its code to sign
 * in. A changed password sends the same security email as an in-app change.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicPasswordResetCompleteSchema.parse(rawBody);

  const reset = await resetPasswordWithBetterAuth({
    ctx: authRequestContext(req),
    token: input.token,
    password: input.password,
  });
  await notifyPasswordReset({
    host: resolveRequestHostFromHeaders(req.headers),
    requestId,
    principalId: reset.principalId,
    email: reset.email,
  });
  return NextResponse.json(
    PublicPasswordResetCompleteResponseSchema.parse({ data: { status: "RESET" } }),
  );
});
