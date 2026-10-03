import "server-only";
import type {
  AcceptInvitationApiResponse,
  PublicAuthApiResponse,
  SetInvitationPasswordApiResponse,
} from "../api/public-client";
import { buildApiProxyHeaders } from "@atlas/core/http/api-proxy";
import { applySetCookieHeaders } from "./apply-set-cookie-headers";
import { resolveCookieHeaderForInternalApi } from "./resolve-request-cookies";
import { resolveTenantHostForInternalApi } from "./resolve-tenant-host";
import { resolveClientIpForInternalApi } from "./resolve-client-ip";

const API_INTERNAL_URL = process.env["API_INTERNAL_URL"] ?? "http://127.0.0.1:3001";

async function buildInternalApiRequest(
  path: string,
): Promise<{ url: string; forwardedHost: string }> {
  const forwardedHost = await resolveTenantHostForInternalApi();

  return {
    url: `${API_INTERNAL_URL}${path}`,
    forwardedHost,
  };
}

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
};

export class ServerPublicApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;

  constructor(code: string, status: number, requestId: string, message: string) {
    super(message);
    this.name = "ServerPublicApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

async function applySetCookieHeadersFromResponse(response: Response): Promise<void> {
  await applySetCookieHeaders(response);
}

// Hard ceiling on internal API calls so a stalled backend can never hang a
// server action (and the client screen waiting on it) indefinitely.
const INTERNAL_API_TIMEOUT_MS = 12_000;

async function postJson<T>(path: string, body: object, idempotencyPrefix: string): Promise<T> {
  const { url, forwardedHost } = await buildInternalApiRequest(path);
  const cookieHeader = await resolveCookieHeaderForInternalApi();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: buildApiProxyHeaders(
        forwardedHost,
        {
          "content-type": "application/json",
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
          "idempotency-key": `${idempotencyPrefix}-${crypto.randomUUID()}`,
        },
        process.env,
        await resolveClientIpForInternalApi(),
      ),
      redirect: "error",
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(INTERNAL_API_TIMEOUT_MS),
    });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
    throw new ServerPublicApiError(
      isTimeout ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
      isTimeout ? 504 : 502,
      crypto.randomUUID(),
      isTimeout
        ? "The request timed out. Please try again."
        : "Could not reach the server. Please try again.",
    );
  }

  await applySetCookieHeadersFromResponse(response);

  const payload: unknown = await response.json();

  if (!response.ok) {
    const envelope = payload as ApiErrorBody;
    throw new ServerPublicApiError(
      envelope.error?.code ?? "UNKNOWN_ERROR",
      response.status,
      envelope.error?.requestId ?? crypto.randomUUID(),
      envelope.error?.message ?? "Request failed.",
    );
  }

  return payload as T;
}

export const serverPublicApi = {
  login: (body: {
    email: string;
    password: string;
    redirectTo?: string | undefined;
    rememberMe?: boolean | undefined;
  }) => postJson<PublicAuthApiResponse>("/api/v1/public/auth/login", body, "public-login"),

  signup: (body: {
    email: string;
    password: string;
    displayName: string;
    inviteToken?: string;
    referralCode?: string;
    emailRedirectTo?: string;
  }) => postJson<PublicAuthApiResponse>("/api/v1/public/auth/signup", body, "public-signup"),

  resend: (body: { email: string; emailRedirectTo?: string }) =>
    postJson<{ data: { ok: boolean; message: string } }>(
      "/api/v1/public/auth/resend",
      body,
      "public-auth-resend",
    ),

  verifyMfa: (body: { code: string }) =>
    postJson<PublicAuthApiResponse>("/api/v1/public/auth/verify-mfa", body, "public-mfa-verify"),

  acceptInvitation: (body: { token: string }) =>
    postJson<AcceptInvitationApiResponse>(
      "/api/v1/public/invitations/accept",
      body,
      "public-invitation-accept",
    ),

  setInvitationPassword: (body: {
    token: string;
    password: string;
    accessToken: string;
    refreshToken?: string | undefined;
  }) =>
    postJson<SetInvitationPasswordApiResponse>(
      "/api/v1/public/invitations/set-password",
      body,
      "public-invitation-set-password",
    ),
};

export type ConfirmEmailResult = {
  ok: boolean;
  status: PublicAuthApiResponse["data"]["status"] | null;
  redirectTo: string | null;
  /** Raw Set-Cookie headers from the API, forwarded verbatim onto the redirect. */
  setCookies: string[];
};

/**
 * Verifies an email `token_hash` against the internal API and returns the raw
 * Set-Cookie headers so the route handler can attach them — verbatim, preserving
 * Max-Age/Secure/HttpOnly — onto its redirect response. Used by the SSR confirm
 * route handler (route handlers, unlike `cookies().set()`, reliably emit cookies
 * on a self-constructed redirect when set directly on the response).
 */
export async function confirmEmailViaInternalApi(input: {
  tokenHash: string;
  type: string;
}): Promise<ConfirmEmailResult> {
  const failure: ConfirmEmailResult = {
    ok: false,
    status: null,
    redirectTo: null,
    setCookies: [],
  };

  const { url, forwardedHost } = await buildInternalApiRequest("/api/v1/public/auth/confirm");
  const cookieHeader = await resolveCookieHeaderForInternalApi();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: buildApiProxyHeaders(
        forwardedHost,
        {
          "content-type": "application/json",
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
          "idempotency-key": `public-auth-confirm-${crypto.randomUUID()}`,
        },
        process.env,
        await resolveClientIpForInternalApi(),
      ),
      redirect: "error",
      body: JSON.stringify({ tokenHash: input.tokenHash, type: input.type }),
      cache: "no-store",
      signal: AbortSignal.timeout(INTERNAL_API_TIMEOUT_MS),
    });
  } catch {
    return failure;
  }

  const setCookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    return failure;
  }

  const data = (payload as PublicAuthApiResponse | null)?.data ?? null;
  return {
    ok: true,
    status: data?.status ?? null,
    redirectTo: data?.redirectTo ?? null,
    setCookies,
  };
}
