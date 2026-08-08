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
