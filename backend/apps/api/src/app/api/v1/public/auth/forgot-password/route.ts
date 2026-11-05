import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
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

  const { emails } = await requestPasswordResetWithBetterAuth({
    ctx: authRequestContext(req),
    email: input.email,
  });
  await sendAuthEmails({ req, requestId, emails });

  return NextResponse.json({ data: { ok: true } });
});
