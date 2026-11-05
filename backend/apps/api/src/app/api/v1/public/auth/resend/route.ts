import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { resendSignupVerification } from "@atlas/auth";
import { sendAuthEmails } from "../../../../../../lib/auth-email";
import { PublicAuthResendRequestSchema, rejectClientTenantId } from "@atlas/domain-identity";
import { routeMetadata } from "./route.metadata";

/**
 * Re-sends the signup verification email. Response is uniform (anti-enumeration)
 * regardless of whether the address exists or is already verified; rate limiting
 * is enforced by the public-auth tier.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicAuthResendRequestSchema.parse(rawBody);

  const { emails } = await resendSignupVerification({ email: input.email, req });
  await sendAuthEmails({ req, requestId, emails });

  return NextResponse.json({
    data: {
      ok: true,
      message: "If your email needs verification, a new link has been sent.",
    },
  });
});
