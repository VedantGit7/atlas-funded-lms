import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

/** Better Auth's Set-Cookie headers for a new session, or a pending two-factor challenge. */
export type IssuedAuthSession = { setCookies: string[] };

/** Passes Better Auth's Set-Cookie headers on to the response. */
export function applyAuthSession(args: {
  response: NextResponse;
  session: IssuedAuthSession;
}): void {
  for (const cookie of args.session.setCookies) {
    args.response.headers.append("set-cookie", cookie);
  }
}

/**
 * Writes Better Auth's Set-Cookie headers through Next's cookie store, for
 * route handlers that return through a wrapper and so can't append headers
 * (the login-method link start sets Better Auth's signed OAuth state cookie).
 */
export async function applySetCookiesToCookieStore(setCookies: string[]): Promise<void> {
  const cookieStore = await cookies();
  for (const header of setCookies) {
    const [pair = "", ...attributes] = header.split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const options: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      maxAge?: number;
    } = {};
    for (const attribute of attributes) {
      const [rawKey = "", rawValue = ""] = attribute.split("=");
      const key = rawKey.toLowerCase();
      if (key === "httponly") options.httpOnly = true;
      else if (key === "secure") options.secure = true;
      else if (key === "path") options.path = rawValue;
      else if (key === "max-age") options.maxAge = Number(rawValue);
      else if (key === "samesite") {
        const sameSite = rawValue.toLowerCase();
        if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") {
          options.sameSite = sameSite;
        }
      }
    }
    cookieStore.set(
      pair.slice(0, separator),
      decodeURIComponent(pair.slice(separator + 1)),
      options,
    );
  }
}

/**
 * Sets the cookies for a session that just passed a second factor: Better
 * Auth's new session cookie, or nothing when the session was stepped up in place.
 */
export async function applyVerifiedSessionToCookieStore(session: IssuedAuthSession): Promise<void> {
  await applySetCookiesToCookieStore(session.setCookies);
}
