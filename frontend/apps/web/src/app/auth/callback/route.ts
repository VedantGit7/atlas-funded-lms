import { NextResponse, type NextRequest } from "next/server";
import { ATLAS_CLIENT_IP_HEADER, buildApiProxyHeaders } from "@atlas/core/http/api-proxy";
import { ATLAS_INTERNAL_TENANT_HOST_HEADER } from "@/lib/http-headers";
import { resolvePostAuthRedirect } from "@/lib/auth/safe-redirect";
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_REMEMBER_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  resolveRequestOrigin,
} from "../oauth/oauth-shared";

const API_INTERNAL_URL = process.env["API_INTERNAL_URL"] ?? "http://127.0.0.1:3001";

type CallbackApiResponse = {
  data?: {
    status?: string;
    redirectTo?: string | null;
  };
};

function clearOAuthCookies(response: NextResponse): NextResponse {
  response.cookies.delete(OAUTH_VERIFIER_COOKIE);
  response.cookies.delete(OAUTH_REMEMBER_COOKIE);
  response.cookies.delete(OAUTH_NEXT_COOKIE);
  return response;
}

function resolveDestination(
  status: string | undefined,
  apiRedirect: string | null,
  clientNext: string | null,
): string | null {
  switch (status) {
    case "AUTHENTICATED":
      return resolvePostAuthRedirect(clientNext, apiRedirect, "/") ?? "/";
    case "INVITED_MEMBERSHIP":
      return resolvePostAuthRedirect(clientNext, apiRedirect, "/invite/accept") ?? "/invite/accept";
    default:
      // NO_ACTIVE_MEMBERSHIP, MFA_REQUIRED, EMAIL_VERIFICATION_REQUIRED are not
      // resolvable through the social flow; bounce back to login with an error.
      return null;
  }
}

export async function GET(req: NextRequest) {
  const origin = resolveRequestOrigin(req);
  const loginUrl = `${origin}/login`;

  const code = req.nextUrl.searchParams.get("code");
  const providerError = req.nextUrl.searchParams.get("error");
  const codeVerifier = req.cookies.get(OAUTH_VERIFIER_COOKIE)?.value;
  const rememberMe = req.cookies.get(OAUTH_REMEMBER_COOKIE)?.value === "1";
  const clientNext = req.cookies.get(OAUTH_NEXT_COOKIE)?.value ?? null;

  if (providerError || !code || !codeVerifier) {
    return clearOAuthCookies(NextResponse.redirect(`${loginUrl}?error=oauth`));
  }

  let apiRes: Response;
  const browserHost =
    req.headers.get(ATLAS_INTERNAL_TENANT_HOST_HEADER) ?? req.headers.get("host") ?? "";
  try {
    apiRes = await fetch(`${API_INTERNAL_URL}/api/v1/public/auth/oauth/callback`, {
      method: "POST",
      headers: buildApiProxyHeaders(
        browserHost,
        {
          "content-type": "application/json",
          "idempotency-key": `public-oauth-callback-${crypto.randomUUID()}`,
        },
        process.env,
        req.headers.get(ATLAS_CLIENT_IP_HEADER) ?? "unknown",
      ),
      redirect: "error",
      body: JSON.stringify({
        code,
        codeVerifier,
        rememberMe,
        ...(clientNext ? { redirectTo: clientNext } : {}),
      }),
      cache: "no-store",
    });
  } catch {
    return clearOAuthCookies(NextResponse.redirect(`${loginUrl}?error=oauth`));
  }

  if (!apiRes.ok) {
    return clearOAuthCookies(NextResponse.redirect(`${loginUrl}?error=oauth`));
  }

  const payload = (await apiRes.json()) as CallbackApiResponse;
  const destination = resolveDestination(
    payload.data?.status,
    payload.data?.redirectTo ?? null,
    clientNext,
  );

  if (!destination) {
    return clearOAuthCookies(NextResponse.redirect(`${loginUrl}?error=oauth`));
  }

  // Clear temporary cookies before appending the API's raw Set-Cookie headers;
  // response.cookies mutations rebuild that header and would discard them.
  const response = clearOAuthCookies(NextResponse.redirect(`${origin}${destination}`));

  // Relay the auth session cookies (access/refresh) set by the API onto the
  // browser redirect.
  const setCookies =
    typeof apiRes.headers.getSetCookie === "function" ? apiRes.headers.getSetCookie() : [];
  for (const header of setCookies) {
    response.headers.append("set-cookie", header);
  }

  return response;
}
