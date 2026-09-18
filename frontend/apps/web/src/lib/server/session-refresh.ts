import type { NextRequest } from "next/server";
import { ATLAS_ACCESS_TOKEN_COOKIE, ATLAS_REFRESH_TOKEN_COOKIE } from "../auth-cookies";
import { ATLAS_INTERNAL_TENANT_HOST_HEADER } from "../http-headers";
import {
  appendSetCookieHeaders,
  buildCookieHeaderFromPairs,
  mergeCookieHeaderString,
  mergeRequestCookieHeader,
} from "./apply-set-cookie-headers";

const API_INTERNAL_URL = process.env["API_INTERNAL_URL"] ?? "http://127.0.0.1:3001";

/** Skew buffer so we refresh slightly before the JWT actually expires. */
const ACCESS_TOKEN_EXPIRY_SKEW_MS = 30_000;

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }

  const payloadSegment = segments[1];
  if (!payloadSegment) {
    return null;
  }

  try {
    const json = decodeBase64Url(payloadSegment);
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function isAccessTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  const exp = payload?.["exp"];

  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    return true;
  }

  return exp * 1000 <= Date.now() + ACCESS_TOKEN_EXPIRY_SKEW_MS;
}

export function hasValidAccessToken(req: NextRequest): boolean {
  const accessToken = req.cookies.get(ATLAS_ACCESS_TOKEN_COOKIE)?.value;
  return Boolean(accessToken && !isAccessTokenExpired(accessToken));
}

function buildCookieHeader(req: NextRequest): string {
  return buildCookieHeaderFromPairs(req.cookies.getAll());
}

function readCookieValue(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
  );
  return match?.[1] ?? null;
}

/**
 * Mints a fresh access token for server-side internal API calls (RSC / Server
 * Actions). Returns an updated Cookie header string without mutating
 * `cookies()` — callers may only persist Set-Cookie in middleware/route handlers.
 */
export async function refreshSessionCookieHeader(
  cookieHeader: string,
  tenantHost: string,
  options?: { force?: boolean },
): Promise<string | null> {
  const refreshToken = readCookieValue(cookieHeader, ATLAS_REFRESH_TOKEN_COOKIE);
  if (!refreshToken) {
    return null;
  }

  const accessToken = readCookieValue(cookieHeader, ATLAS_ACCESS_TOKEN_COOKIE);
  if (!options?.force && accessToken && !isAccessTokenExpired(accessToken)) {
    return cookieHeader;
  }

  let response: Response;
  try {
    response = await fetch(`${API_INTERNAL_URL}/api/v1/public/auth/refresh`, {
      method: "POST",
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        "x-forwarded-host": tenantHost,
        [ATLAS_INTERNAL_TENANT_HOST_HEADER]: tenantHost,
        "content-type": "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return mergeCookieHeaderString(cookieHeader, response);
}

/**
 * Attempts to mint a fresh access token from the refresh-token cookie before
 * protected-route middleware sends the user to /login.
 */
export async function tryRefreshSessionForProxy(req: NextRequest): Promise<Response | null> {
  const refreshToken = req.cookies.get(ATLAS_REFRESH_TOKEN_COOKIE)?.value;
  const accessToken = req.cookies.get(ATLAS_ACCESS_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return null;
  }

  if (accessToken && !isAccessTokenExpired(accessToken)) {
    return null;
  }

  const browserHost = req.headers.get("host");
  if (!browserHost) {
    return null;
  }

  const cookieHeader = buildCookieHeader(req);

  let response: Response;
  try {
    response = await fetch(`${API_INTERNAL_URL}/api/v1/public/auth/refresh`, {
      method: "POST",
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        "x-forwarded-host": browserHost,
        [ATLAS_INTERNAL_TENANT_HOST_HEADER]: browserHost,
        "content-type": "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return response;
}

export function forwardRefreshedSessionCookies(target: Headers, refreshResponse: Response): void {
  appendSetCookieHeaders(target, refreshResponse);
}

export { mergeRequestCookieHeader };
