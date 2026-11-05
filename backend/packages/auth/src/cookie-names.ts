import { ATLAS_INTERNAL_COOKIE_HEADER } from "@atlas/core/http/headers";

export { ATLAS_INTERNAL_COOKIE_HEADER };

export const ATLAS_UI_MODE_COOKIE = "atlas_ui_mode";
/**
 * Better Auth's session cookie (docs/engineering/better-auth-design.md). On
 * https Better Auth names it `__Secure-atlas_session`.
 */
export const ATLAS_SESSION_COOKIE = "atlas_session";
export const ATLAS_SECURE_SESSION_COOKIE = `__Secure-${ATLAS_SESSION_COOKIE}`;

/** How long a "remember me" session lasts. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * The web proxy may stamp the cookie jar it forwards onto
 * `x-atlas-internal-cookie`. Prefer that internal jar for route-handler auth.
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
