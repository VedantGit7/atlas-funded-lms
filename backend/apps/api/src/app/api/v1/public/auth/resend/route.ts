import { NextResponse } from "next/server";
import { assertRedirectOnRequestHostFrom, createPublicRouteHandler } from "@atlas/api";
import { resendSignupVerification } from "@atlas/auth";
import { PublicAuthResendRequestSchema, rejectClientTenantId } from "@atlas/domain-identity";
import { routeMetadata } from "./route.metadata";

/**
 * Re-sends the signup verification email. Response is uniform (anti-enumeration)
 * regardless of whether the address exists or is already verified; rate limiting
 * is enforced by the public-auth tier plus Supabase's own per-email cooldown.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicAuthResendRequestSchema.parse(rawBody);

  const emailRedirectTo = input.emailRedirectTo
    ? assertRedirectOnRequestHostFrom(req.headers, input.emailRedirectTo, "emailRedirectTo")
    : undefined;

  await resendSignupVerification({
    email: input.email,
    ...(emailRedirectTo ? { emailRedirectTo } : {}),
  });

  return NextResponse.json({
    data: {
      ok: true,
      message: "If your email needs verification, a new link has been sent.",
    },
  });
});
