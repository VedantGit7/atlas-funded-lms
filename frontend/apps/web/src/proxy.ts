import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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

function buildForwardedRequestHeaders(req: NextRequest, cookieHeader: string): Headers {
  const requestHeaders = new Headers(req.headers);

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

  if (isProtectedRoute(pathname) && !hasValidAccessToken(req)) {
    const refreshResponse = await tryRefreshSessionForProxy(req);

    if (!refreshResponse) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    const cookieHeader = mergeRequestCookieHeader(req, refreshResponse);
    const requestHeaders = buildForwardedRequestHeaders(req, cookieHeader);
    const requestId = requestHeaders.get(ATLAS_INTERNAL_REQUEST_ID_HEADER) ?? createRequestId();

    const res = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    forwardRefreshedSessionCookies(res.headers, refreshResponse);
    res.headers.set(ATLAS_INTERNAL_REQUEST_ID_HEADER, requestId);
    return res;
  }

  const refreshResponse = await tryRefreshSessionForProxy(req);
  const cookieHeader = refreshResponse
    ? mergeRequestCookieHeader(req, refreshResponse)
    : req.cookies
        .getAll()
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");

  const requestHeaders = buildForwardedRequestHeaders(req, cookieHeader);
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
  return res;
}

export const config = {
  matcher: [
    /*
     * Keep static assets out of middleware.
     * Tenant resolution itself happens in server route wrappers/loaders.
     */
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
