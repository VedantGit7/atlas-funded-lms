import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { enforceAddressRateLimit } from "@atlas/api/rate-limit";
import { sendMagicLink } from "@atlas/auth";
import { MagicLinkRequestSchema } from "@atlas/domain-identity";
import { sendAuthEmails } from "../../../../../../lib/auth-email";
import { routeMetadata } from "./route.metadata";

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  const input = MagicLinkRequestSchema.parse(rawBody);
  // Per address as well as per IP (security review 5.3, finding 5).
  await enforceAddressRateLimit({ kind: "sign-in-link", email: input.email });

  const { emails } = await sendMagicLink({ email: input.email, req });
  // Better Auth leaves the email to us, sent from the academy.
  await sendAuthEmails({ req, requestId, emails });

  return NextResponse.json({
    data: {
      ok: true,
      message: "If an account exists for this email, a sign-in link has been sent.",
    },
  });
});
