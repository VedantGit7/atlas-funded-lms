import { NextResponse } from "next/server";
import { assertRedirectOnRequestHostFrom, createPublicRouteHandler } from "@atlas/api";
import { sendMagicLink } from "@atlas/auth";
import { MagicLinkRequestSchema } from "@atlas/domain-identity";
import { routeMetadata } from "./route.metadata";

export const POST = createPublicRouteHandler(routeMetadata, async ({ req }) => {
  const rawBody: unknown = await req.json();
  const input = MagicLinkRequestSchema.parse(rawBody);

  const emailRedirectTo = input.emailRedirectTo
    ? assertRedirectOnRequestHostFrom(req.headers, input.emailRedirectTo, "emailRedirectTo")
    : undefined;

  await sendMagicLink({
    email: input.email,
    ...(emailRedirectTo ? { emailRedirectTo } : {}),
  });

  return NextResponse.json({
    data: {
      ok: true,
      message: "If an account exists for this email, a sign-in link has been sent.",
    },
  });
});
