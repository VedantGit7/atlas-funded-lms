import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { enforceAddressRateLimit } from "@atlas/api/rate-limit";
import { authRequestContext, requestPasswordResetWithBetterAuth } from "@atlas/auth";
import { PublicPasswordResetRequestSchema, rejectClientTenantId } from "@atlas/domain-identity";
import { sendAuthEmails } from "../../../../../../lib/auth-email";
import { routeMetadata } from "./route.metadata";

/**
 * Starts "forgot password" (launch plan task 3.2). The answer is the same
 * whether or not the address has an account.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicPasswordResetRequestSchema.parse(rawBody);
  // Per address as well as per IP (security review 5.3, finding 5).
  await enforceAddressRateLimit({ kind: "password-reset", email: input.email });

  const { emails } = await requestPasswordResetWithBetterAuth({
    ctx: authRequestContext(req),
    email: input.email,
  });
  await sendAuthEmails({ req, requestId, emails });

  return NextResponse.json({ data: { ok: true } });
});
