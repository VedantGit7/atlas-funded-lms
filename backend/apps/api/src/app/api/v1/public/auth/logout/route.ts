import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import {
  ATLAS_ACCESS_TOKEN_COOKIE,
  ATLAS_REFRESH_TOKEN_COOKIE,
  ATLAS_SECURE_SESSION_COOKIE,
  ATLAS_SESSION_COOKIE,
  ATLAS_SESSION_PERSISTENT_COOKIE,
  authProvider,
  authRequestContext,
  signOutWithBetterAuth,
} from "@atlas/auth";
import { routeMetadata } from "./route.metadata";

/**
 * Signs out on this device. With Better Auth the session row is deleted, so
 * the cookie stops working everywhere at once (launch plan task 3.2). Either
 * way every Atlas session cookie is cleared, and the answer is the same
 * whether or not there was a session.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req }) => {
  const response = NextResponse.json({ data: { ok: true } });

  if (authProvider() === "better-auth") {
    const { setCookies } = await signOutWithBetterAuth({ ctx: authRequestContext(req) });
    for (const cookie of setCookies) response.headers.append("set-cookie", cookie);
  }

  for (const name of [
    ATLAS_ACCESS_TOKEN_COOKIE,
    ATLAS_REFRESH_TOKEN_COOKIE,
    ATLAS_SESSION_PERSISTENT_COOKIE,
    ATLAS_SESSION_COOKIE,
    ATLAS_SECURE_SESSION_COOKIE,
  ]) {
    response.cookies.delete(name);
  }
  return response;
});
