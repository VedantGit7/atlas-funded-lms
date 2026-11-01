import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  ATLAS_ACCESS_TOKEN_COOKIE,
  ATLAS_REFRESH_TOKEN_COOKIE,
  ATLAS_SESSION_PERSISTENT_COOKIE,
  readCookieFromRequest,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
} from "./cookie-names";

const isProduction = process.env["NODE_ENV"] === "production";

const cookieBaseOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
};

export async function readSessionPersistenceFromStore(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ATLAS_SESSION_PERSISTENT_COOKIE)?.value === "1";
}

export async function readSessionPersistence(req: Request): Promise<boolean> {
  if (readCookieFromRequest(req, ATLAS_SESSION_PERSISTENT_COOKIE) === "1") {
    return true;
  }

  return readSessionPersistenceFromStore();
}

export type AuthSessionTokens = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds?: number;
  persistent: boolean;
};

export async function applyAuthSessionToCookieStore(args: AuthSessionTokens): Promise<void> {
  const cookieStore = await cookies();
  const accessMaxAge = args.expiresInSeconds ?? 60 * 60;

  cookieStore.set(ATLAS_ACCESS_TOKEN_COOKIE, args.accessToken, {
    ...cookieBaseOptions,
    ...(args.persistent ? { maxAge: accessMaxAge } : {}),
  });

  cookieStore.set(ATLAS_REFRESH_TOKEN_COOKIE, args.refreshToken, {
    ...cookieBaseOptions,
    ...(args.persistent ? { maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS } : {}),
  });

  if (args.persistent) {
    cookieStore.set(ATLAS_SESSION_PERSISTENT_COOKIE, "1", {
      ...cookieBaseOptions,
      maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    });
  } else {
    cookieStore.delete(ATLAS_SESSION_PERSISTENT_COOKIE);
  }
}

export function setAuthCookies(args: {
  response: NextResponse;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds?: number;
  /**
   * When true (default) the cookies persist across browser restarts
   * ("Remember me"). When false they are session cookies that the browser
   * clears when it closes.
   */
  persistent?: boolean;
}): void {
  const persistent = args.persistent ?? true;
  const accessMaxAge = args.expiresInSeconds ?? 60 * 60;

  args.response.cookies.set(ATLAS_ACCESS_TOKEN_COOKIE, args.accessToken, {
    ...cookieBaseOptions,
    ...(persistent ? { maxAge: accessMaxAge } : {}),
  });

  args.response.cookies.set(ATLAS_REFRESH_TOKEN_COOKIE, args.refreshToken, {
    ...cookieBaseOptions,
    ...(persistent ? { maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS } : {}),
  });

  if (persistent) {
    args.response.cookies.set(ATLAS_SESSION_PERSISTENT_COOKIE, "1", {
      ...cookieBaseOptions,
      maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    });
  } else {
    args.response.cookies.delete(ATLAS_SESSION_PERSISTENT_COOKIE);
  }
}

/** A new session from either login system (`AUTH_PROVIDER`). */
export type IssuedAuthSession =
  | { accessToken: string; refreshToken: string; expiresIn?: number }
  | { setCookies: string[] };

/**
 * Sets the cookies for a new session. A Supabase session becomes the Atlas
 * access and refresh cookies; Better Auth already wrote its own Set-Cookie
 * headers (atlas_session, or a pending two-factor challenge), which are passed on.
 */
export function applyAuthSession(args: {
  response: NextResponse;
  session: IssuedAuthSession;
  persistent?: boolean;
}): void {
  if ("setCookies" in args.session) {
    for (const cookie of args.session.setCookies) {
      args.response.headers.append("set-cookie", cookie);
    }
    return;
  }
  setAuthCookies({
    response: args.response,
    accessToken: args.session.accessToken,
    refreshToken: args.session.refreshToken,
    ...(args.session.expiresIn !== undefined ? { expiresInSeconds: args.session.expiresIn } : {}),
    ...(args.persistent !== undefined ? { persistent: args.persistent } : {}),
  });
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
 * Sets the cookies for a session that just passed a second factor: Supabase's
 * aal2 tokens (keeping "remember me"), or Better Auth's new session cookie.
 * A Better Auth session stepped up in place sets nothing.
 */
export async function applyVerifiedSessionToCookieStore(session: IssuedAuthSession): Promise<void> {
  if ("setCookies" in session) {
    await applySetCookiesToCookieStore(session.setCookies);
    return;
  }
  await applyAuthSessionToCookieStore({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    ...(session.expiresIn !== undefined ? { expiresInSeconds: session.expiresIn } : {}),
    persistent: await readSessionPersistenceFromStore(),
  });
}
