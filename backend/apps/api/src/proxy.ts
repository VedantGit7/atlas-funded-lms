import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ATLAS_INTERNAL_COOKIE_HEADER,
  ATLAS_INTERNAL_REQUEST_ID_HEADER,
  SPOOFABLE_TENANT_HEADERS,
} from "@atlas/core/http/headers";
import { createRequestId, stripClientSuppliedRequestIds } from "@atlas/core/request/request-id";
import { sanitizeApiProxyHeaders } from "@atlas/core/http/api-proxy";

export function proxy(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  sanitizeApiProxyHeaders(requestHeaders);

  // Never trust client-supplied tenant context headers.
  for (const header of SPOOFABLE_TENANT_HEADERS) {
    requestHeaders.delete(header);
  }
  requestHeaders.delete(ATLAS_INTERNAL_COOKIE_HEADER);

  stripClientSuppliedRequestIds(requestHeaders);
  const requestId = createRequestId();
  requestHeaders.set(ATLAS_INTERNAL_REQUEST_ID_HEADER, requestId);

  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  res.headers.set(ATLAS_INTERNAL_REQUEST_ID_HEADER, requestId);

  return res;
}

export const config = {
  matcher: [
    /*
     * Keep static assets out of the proxy.
     * Tenant resolution itself happens in server route wrappers/loaders.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
