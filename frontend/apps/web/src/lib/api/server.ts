import "server-only";
import { randomUUID } from "node:crypto";

import { ServerApiError, type ApiErrorBody } from "./errors";
import { buildApiProxyHeaders } from "@atlas/core/http/api-proxy";
import { resolveCookieHeaderForInternalApi } from "../server/resolve-request-cookies";
import { resolveTenantHostForInternalApi } from "../server/resolve-tenant-host";
import { refreshSessionCookieHeader } from "../server/session-refresh";

const API_INTERNAL_URL = process.env["API_INTERNAL_URL"] ?? "http://127.0.0.1:3001";

/** HTTP statuses that indicate a transient server/proxy issue worth retrying. */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
/** Application error codes that map to transient conditions. */
const RETRYABLE_CODES = new Set(["TENANT_NOT_FOUND", "INTERNAL_ERROR"]);

/**
 * GET requests are safe to retry. A failure is transient when it is a network
 * error / non-JSON gateway response (surfaces as a non-ServerApiError) or a
 * ServerApiError carrying a retryable status or code.
 */
function isTransientGetError(error: unknown): boolean {
  if (error instanceof ServerApiError) {
    return RETRYABLE_CODES.has(error.code) || RETRYABLE_STATUS.has(error.status);
  }
  return true;
}

type RequestOptions = {
  cookieHeader?: string;
};

async function buildInternalApiRequest(
  path: string,
): Promise<{ url: string; forwardedHost: string }> {
  const forwardedHost = await resolveTenantHostForInternalApi();

  return {
    url: `${API_INTERNAL_URL}${path}`,
    forwardedHost,
  };
}

async function request<T>(path: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
  const { url, forwardedHost } = await buildInternalApiRequest(path);
  const cookie = options?.cookieHeader ?? (await resolveCookieHeaderForInternalApi());
  const requestHeaders = buildApiProxyHeaders(forwardedHost, init?.headers);

  if (cookie) {
    requestHeaders.set("cookie", cookie);
  }

  const response = await fetch(url, {
    ...init,
    headers: requestHeaders,
    redirect: "error",
    cache: "no-store",
  });

  // Read as text first so a non-JSON body (e.g. a proxy 502/504 HTML page or an
  // empty response) does not throw and erase the HTTP status we need to classify
  // the error for retry.
  const rawBody = await response.text();
  let parsed: unknown = null;
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const envelope = (parsed ?? {}) as ApiErrorBody;
    throw new ServerApiError(
      envelope.error?.code ?? `HTTP_${response.status.toString()}`,
      response.status,
      envelope.error?.requestId ?? randomUUID(),
      envelope.error?.message ?? `Request failed with status ${response.status.toString()}.`,
    );
  }

  return parsed as T;
}

async function tryRefreshCookieHeader(
  currentCookie: string,
  options?: { force?: boolean },
): Promise<string | null> {
  try {
    const tenantHost = await resolveTenantHostForInternalApi();
    const refreshed = await refreshSessionCookieHeader(currentCookie, tenantHost, options);
    if (!refreshed || refreshed === currentCookie) {
      return null;
    }
    return refreshed;
  } catch {
    return null;
  }
}

export const serverApi = {
  // Dev note: right after a dev-server restart, a request can land mid-compile
  // of a dependent route/middleware and spuriously resolve to no tenant. A short
  // delay then a single retry rides out that cold-compile window in dev; this is
  // a no-op cost in production where routes are already built.
  get: async <T>(path: string): Promise<T> => {
    const maxAttempts = 5;
    let cookieOverride: string | undefined;
    let authRetried = false;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await request<T>(
          path,
          undefined,
          cookieOverride !== undefined ? { cookieHeader: cookieOverride } : undefined,
        );
      } catch (error) {
        lastError = error;

        if (error instanceof ServerApiError && error.status === 401 && !authRetried) {
          const baseCookie = cookieOverride ?? (await resolveCookieHeaderForInternalApi());
          const refreshed = await tryRefreshCookieHeader(baseCookie, { force: true });
          if (refreshed) {
            cookieOverride = refreshed;
            authRetried = true;
            continue;
          }
        }

        if (isTransientGetError(error) && attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
          continue;
        }

        throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to complete internal API request");
  },

  post: <T>(path: string, body: object, idempotencyKeyPrefix: string) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        "idempotency-key": `${idempotencyKeyPrefix}-${randomUUID()}`,
      },
    }),
};
