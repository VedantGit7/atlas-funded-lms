import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import {
  ATLAS_SECURE_SESSION_COOKIE,
  ATLAS_SESSION_COOKIE,
  authRequestContext,
  expiredSessionCookie,
  signOutWithBetterAuth,
} from "@atlas/auth";
import { routeMetadata } from "./route.metadata";

/**
 * Signs out on this device. The session row is deleted and every API process
 * forgets it, so the cookie stops working everywhere at once (launch plan task
 * 3.2). The session cookie is cleared either way, and the answer is the same
 * whether or not there was a session.
 *
 * The cookies are cleared with headers appended after Better Auth's own:
 * NextResponse.cookies.delete rebuilt the Set-Cookie header, dropping Better
 * Auth's, and wrote a deletion without Secure that browsers ignore for
 * `__Secure-atlas_session`. The session cookie then outlived sign-out
 * (staging, 17 November 2026).
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req }) => {
  const response = NextResponse.json({ data: { ok: true } });

  const { setCookies } = await signOutWithBetterAuth({ ctx: authRequestContext(req) });
  for (const cookie of setCookies) response.headers.append("set-cookie", cookie);

  for (const name of [ATLAS_SESSION_COOKIE, ATLAS_SECURE_SESSION_COOKIE]) {
    response.headers.append("set-cookie", expiredSessionCookie(name));
  }
  return response;
});
