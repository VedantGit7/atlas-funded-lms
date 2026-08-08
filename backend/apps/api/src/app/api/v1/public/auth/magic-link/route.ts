import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { sendMagicLink } from "@atlas/auth";
import { MagicLinkRequestSchema } from "@atlas/domain-identity";
import { routeMetadata } from "./route.metadata";

export const POST = createPublicRouteHandler(routeMetadata, async ({ req }) => {
  const rawBody: unknown = await req.json();
  const input = MagicLinkRequestSchema.parse(rawBody);

  await sendMagicLink({
    email: input.email,
    ...(input.emailRedirectTo ? { emailRedirectTo: input.emailRedirectTo } : {}),
  });

  return NextResponse.json({
    data: {
      ok: true,
      message: "If an account exists for this email, a sign-in link has been sent.",
    },
  });
});
