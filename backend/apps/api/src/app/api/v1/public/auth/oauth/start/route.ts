import { NextResponse } from "next/server";
import { assertRedirectOnRequestHostFrom, createPublicRouteHandler } from "@atlas/api";
import { startOAuthSignIn } from "@atlas/auth";
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

  const { url, codeVerifier } = await startOAuthSignIn({
    provider: input.provider,
    redirectTo: assertRedirectOnRequestHostFrom(req.headers, input.redirectTo, "redirectTo"),
  });

  const body = PublicOAuthStartResponseSchema.parse({
    data: { url, codeVerifier },
  });

  return NextResponse.json(body);
});
