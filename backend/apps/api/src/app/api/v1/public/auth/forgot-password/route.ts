import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { authProvider, authRequestContext, requestPasswordResetWithBetterAuth } from "@atlas/auth";
import { createSupabasePublicServerClient } from "@atlas/auth/supabase-server";
import { PublicPasswordResetRequestSchema, rejectClientTenantId } from "@atlas/domain-identity";
import { requestOrigin, sendAuthEmails } from "../../../../../../lib/auth-email";
import { routeMetadata } from "./route.metadata";

/**
 * Starts "forgot password". The web app used to ask Supabase directly; the
 * request comes here now so either login system can answer it (launch plan
 * task 3.2). The answer is the same whether or not the address has an account.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicPasswordResetRequestSchema.parse(rawBody);

  if (authProvider() === "better-auth") {
    const { emails } = await requestPasswordResetWithBetterAuth({
      ctx: authRequestContext(req),
      email: input.email,
    });
    await sendAuthEmails({ req, requestId, emails });
  } else {
    await createSupabasePublicServerClient()
      .auth.resetPasswordForEmail(input.email, {
        redirectTo: `${requestOrigin(req)}/reset-password`,
      })
      .catch(() => undefined);
  }

  return NextResponse.json({ data: { ok: true } });
});
