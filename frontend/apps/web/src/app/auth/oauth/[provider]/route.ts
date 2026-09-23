import { NextResponse, type NextRequest } from "next/server";
import { buildApiProxyHeaders } from "@atlas/core/http/api-proxy";
import { ATLAS_INTERNAL_TENANT_HOST_HEADER } from "@/lib/http-headers";
import { resolveSafeRedirectPath } from "@/lib/auth/safe-redirect";
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_REMEMBER_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  resolveRequestOrigin,
} from "../oauth-shared";

const API_INTERNAL_URL = process.env["API_INTERNAL_URL"] ?? "http://127.0.0.1:3001";
const VALID_PROVIDERS = new Set(["google", "apple"]);
const OAUTH_COOKIE_MAX_AGE_SECONDS = 60 * 10;

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = resolveRequestOrigin(req);
  const loginUrl = `${origin}/login`;

  if (!VALID_PROVIDERS.has(provider)) {
    return NextResponse.redirect(`${loginUrl}?error=oauth`);
  }

  const remember = req.nextUrl.searchParams.get("remember") === "1";
  const next = resolveSafeRedirectPath(req.nextUrl.searchParams.get("next"));
  const callbackUrl = `${origin}/auth/callback`;

  let providerUrl: string;
  let codeVerifier: string;
  const browserHost =
    req.headers.get(ATLAS_INTERNAL_TENANT_HOST_HEADER) ?? req.headers.get("host") ?? "";

  try {
    const apiRes = await fetch(`${API_INTERNAL_URL}/api/v1/public/auth/oauth/start`, {
      method: "POST",
      headers: buildApiProxyHeaders(browserHost, {
        "content-type": "application/json",
        "idempotency-key": `public-oauth-start-${crypto.randomUUID()}`,
      }),
      redirect: "error",
      body: JSON.stringify({ provider, redirectTo: callbackUrl, rememberMe: remember }),
      cache: "no-store",
    });

    if (!apiRes.ok) {
      throw new Error("oauth_start_failed");
    }

    const payload = (await apiRes.json()) as {
      data?: { url?: string; codeVerifier?: string };
    };

    if (!payload.data?.url || !payload.data.codeVerifier) {
      throw new Error("oauth_start_malformed");
    }

    providerUrl = payload.data.url;
    codeVerifier = payload.data.codeVerifier;
  } catch {
    return NextResponse.redirect(`${loginUrl}?error=oauth`);
  }

  const response = NextResponse.redirect(providerUrl);
  const secure = origin.startsWith("https");
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  };

  response.cookies.set(OAUTH_VERIFIER_COOKIE, codeVerifier, cookieOptions);
  response.cookies.set(OAUTH_REMEMBER_COOKIE, remember ? "1" : "0", cookieOptions);
  if (next) {
    response.cookies.set(OAUTH_NEXT_COOKIE, next, cookieOptions);
  }

  return response;
}
