import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { authRequestContext, startGoogleSignIn } from "@atlas/auth";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { resolvePlatformHost, resolveRequestHostFromHeaders } from "@atlas/tenancy";
import {
  PublicOAuthStartRequestSchema,
  PublicOAuthStartResponseSchema,
  rejectClientTenantId,
} from "@atlas/domain-identity";
import { routeMetadata } from "./route.metadata";

export const POST = createPublicRouteHandler(routeMetadata, async ({ req }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicOAuthStartRequestSchema.parse(rawBody);

  // Google only, and only on academy hosts: Apple is deferred, and the Google
  // clients register academy redirect addresses, not the console's.
  if (
    input.provider !== "google" ||
    resolvePlatformHost(resolveRequestHostFromHeaders(req.headers))
  ) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "This sign-in method isn't available here.",
    });
  }
  const start = await startGoogleSignIn({ ctx: authRequestContext(req) });
  const response = NextResponse.json(
    PublicOAuthStartResponseSchema.parse({ data: { url: start.url } }),
  );
  // Better Auth's signed state cookie, checked when Google sends the person back.
  for (const cookie of start.cookies.setCookies) response.headers.append("set-cookie", cookie);
  return response;
});
