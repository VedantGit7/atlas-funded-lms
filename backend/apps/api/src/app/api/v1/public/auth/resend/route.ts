import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { enforceAddressRateLimit } from "@atlas/api/rate-limit";
import { resendSignupVerification } from "@atlas/auth";
import { sendAuthEmails } from "../../../../../../lib/auth-email";
import { PublicAuthResendRequestSchema, rejectClientTenantId } from "@atlas/domain-identity";
import { routeMetadata } from "./route.metadata";

/**
 * Re-sends the link that finishes a sign-up (a fresh one). Response is uniform
 * (anti-enumeration) regardless of whether the address exists or is already
 * verified. It shares the sign-up form's per-address budget (security review
 * 5.3, finding 5) on top of the public-auth tier's per-IP one.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicAuthResendRequestSchema.parse(rawBody);
  await enforceAddressRateLimit({ kind: "signup-link", email: input.email });

  const { emails } = await resendSignupVerification({ email: input.email });
  await sendAuthEmails({ req, requestId, emails });

  return NextResponse.json({
    data: {
      ok: true,
      message: "If your account isn't finished yet, a new link has been sent.",
    },
  });
});
