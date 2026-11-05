import type { NextRequest } from "next/server";
import { ATLAS_SECURE_SESSION_COOKIE, ATLAS_SESSION_COOKIE } from "../auth-cookies";

/**
 * Whether the request carries a Better Auth session cookie. The cookie is
 * opaque and the API checks it on every request, so this only decides whether
 * a protected page is worth rendering; the API's 401 decides the rest.
 */
export function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.has(ATLAS_SESSION_COOKIE) || req.cookies.has(ATLAS_SECURE_SESSION_COOKIE);
}
