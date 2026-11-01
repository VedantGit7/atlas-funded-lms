import { NextResponse } from "next/server";
import { assertRedirectOnRequestHostFrom, createPublicRouteHandler } from "@atlas/api";
import { sendMagicLink } from "@atlas/auth";
import { MagicLinkRequestSchema } from "@atlas/domain-identity";
import { sendAuthEmails } from "../../../../../../lib/auth-email";
import { routeMetadata } from "./route.metadata";

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  const input = MagicLinkRequestSchema.parse(rawBody);

  const emailRedirectTo = input.emailRedirectTo
    ? assertRedirectOnRequestHostFrom(req.headers, input.emailRedirectTo, "emailRedirectTo")
    : undefined;

  const { emails } = await sendMagicLink({
    email: input.email,
    ...(emailRedirectTo ? { emailRedirectTo } : {}),
    req,
  });
  // Better Auth leaves the email to us; Supabase sent its own.
  await sendAuthEmails({ req, requestId, emails: emails ?? [] });

  return NextResponse.json({
    data: {
      ok: true,
      message: "If an account exists for this email, a sign-in link has been sent.",
    },
  });
});
