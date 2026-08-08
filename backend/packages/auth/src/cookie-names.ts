import { ATLAS_INTERNAL_COOKIE_HEADER } from "@atlas/core/http/headers";

export { ATLAS_INTERNAL_COOKIE_HEADER };

export const ATLAS_ACCESS_TOKEN_COOKIE = "atlas_access_token";
export const ATLAS_REFRESH_TOKEN_COOKIE = "atlas_refresh_token";
export const ATLAS_SESSION_PERSISTENT_COOKIE = "atlas_session_persistent";
export const ATLAS_UI_MODE_COOKIE = "atlas_ui_mode";

export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Middleware may stamp a refreshed cookie jar onto `x-atlas-internal-cookie`
 * when the browser still sends an expired access token in the standard Cookie
 * header. Prefer that internal jar for route-handler auth on the web app.
 */
export function readRequestCookieHeader(req: Request): string | null {
  return req.headers.get(ATLAS_INTERNAL_COOKIE_HEADER) ?? req.headers.get("cookie");
}

export function readCookieFromRequest(req: Request, name: string): string | null {
  const header = readRequestCookieHeader(req);

  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");

    if (rawKey === name) {
      return rest.join("=") || null;
    }
  }

  return null;
}

export function getBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}
