import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildDocumentCsp } from "../../../../configs/security-headers.mjs";
import { ATLAS_API_PROXY_KEY_HEADER, buildApiProxyHeaders } from "@atlas/core/http/api-proxy";
import {
  ATLAS_INTERNAL_COOKIE_HEADER,
  ATLAS_INTERNAL_REQUEST_ID_HEADER,
  ATLAS_INTERNAL_TENANT_HOST_HEADER,
  SPOOFABLE_TENANT_HEADERS,
} from "./lib/http-headers";
import { createRequestId, stripClientSuppliedRequestIds } from "./lib/request-id";
import {
  forwardRefreshedSessionCookies,
  hasValidAccessToken,
  mergeRequestCookieHeader,
  tryRefreshSessionForProxy,
} from "./lib/server/session-refresh";

const PROTECTED_ROUTE_PREFIXES = [
  "/admin",
  "/studio",
  "/moderate",
  "/platform",
  "/settings",
  "/profile",
  "/review",
] as const;

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function buildForwardedRequestHeaders(
  req: NextRequest,
  cookieHeader: string,
  documentCsp?: { nonce: string; value: string },
): Headers {
  let requestHeaders = new Headers(req.headers);
  requestHeaders.delete("x-nonce");
  requestHeaders.delete("content-security-policy");
  requestHeaders.delete("content-security-policy-report-only");
  if (documentCsp) {
    requestHeaders.set("x-nonce", documentCsp.nonce);
    requestHeaders.set("content-security-policy", documentCsp.value);
  }
  requestHeaders.delete(ATLAS_API_PROXY_KEY_HEADER);

  for (const header of SPOOFABLE_TENANT_HEADERS) {
    requestHeaders.delete(header);
  }
  requestHeaders.delete(ATLAS_INTERNAL_TENANT_HOST_HEADER);
  requestHeaders.delete(ATLAS_INTERNAL_COOKIE_HEADER);

  stripClientSuppliedRequestIds(requestHeaders);
  const requestId = createRequestId();
  requestHeaders.set(ATLAS_INTERNAL_REQUEST_ID_HEADER, requestId);
  requestHeaders.set("x-atlas-pathname", req.nextUrl.pathname);

  const browserHost = req.headers.get("host");
  if (browserHost) {
    requestHeaders.set(ATLAS_INTERNAL_TENANT_HOST_HEADER, browserHost);
    requestHeaders.set("x-forwarded-host", browserHost);
    if (req.nextUrl.pathname === "/api/v1" || req.nextUrl.pathname.startsWith("/api/v1/")) {
      requestHeaders = buildApiProxyHeaders(browserHost, requestHeaders);
    }
  }

  if (cookieHeader) {
    requestHeaders.set(ATLAS_INTERNAL_COOKIE_HEADER, cookieHeader);
    // Overwrite stale browser cookies after a silent refresh so proxied API
    // handlers and route code see the same session jar as serverApi.
    requestHeaders.set("cookie", cookieHeader);
  }

  return requestHeaders;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname === "/api" || pathname.startsWith("/api/");
  const sameOriginFrame = /^\/f\/[^/]+\/?$/.test(pathname);
  const nonce = isApi ? undefined : randomBytes(18).toString("base64");
  const documentCsp = nonce
    ? { nonce, value: buildDocumentCsp(nonce, process.env, { sameOriginFrame }) }
    : undefined;
  const secureResponse = (response: NextResponse) => {
    if (documentCsp) {
      response.headers.set(
        process.env["CSP_ENFORCE"] === "1"
          ? "content-security-policy"
          : "content-security-policy-report-only",
        documentCsp.value,
      );
      response.headers.set("cache-control", "private, no-store");
      if (sameOriginFrame) response.headers.set("x-frame-options", "SAMEORIGIN");
    }
    return response;
  };

  if (isProtectedRoute(pathname) && !hasValidAccessToken(req)) {
    const refreshResponse = await tryRefreshSessionForProxy(req);

    if (!refreshResponse) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
      return secureResponse(NextResponse.redirect(loginUrl));
    }

    const cookieHeader = mergeRequestCookieHeader(req, refreshResponse);
    const requestHeaders = buildForwardedRequestHeaders(req, cookieHeader, documentCsp);
    const requestId = requestHeaders.get(ATLAS_INTERNAL_REQUEST_ID_HEADER) ?? createRequestId();

    const res = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    forwardRefreshedSessionCookies(res.headers, refreshResponse);
    res.headers.set(ATLAS_INTERNAL_REQUEST_ID_HEADER, requestId);
    return secureResponse(res);
  }

  const refreshResponse = await tryRefreshSessionForProxy(req);
  const cookieHeader = refreshResponse
    ? mergeRequestCookieHeader(req, refreshResponse)
    : req.cookies
        .getAll()
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");

  const requestHeaders = buildForwardedRequestHeaders(req, cookieHeader, documentCsp);
  const requestId = requestHeaders.get(ATLAS_INTERNAL_REQUEST_ID_HEADER) ?? createRequestId();

  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (refreshResponse) {
    forwardRefreshedSessionCookies(res.headers, refreshResponse);
  }

  res.headers.set(ATLAS_INTERNAL_REQUEST_ID_HEADER, requestId);
  return secureResponse(res);
}

export const config = {
  matcher: [
    /*
     * Keep static assets out of middleware.
     * Tenant resolution itself happens in server route wrappers/loaders.
     */
    "/((?!_next/static|_next/image|_next/webpack-hmr|fonts/cormorant-garamond/v21/|fonts/plus-jakarta-sans/v12/|fonts/jetbrains-mono/v24/|fonts/inter/v20/|fonts/playfair-display/v40/|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
