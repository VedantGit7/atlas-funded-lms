import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ATLAS_INTERNAL_REQUEST_ID_HEADER,
  SPOOFABLE_TENANT_HEADERS,
} from "@atlas/core/http/headers";
import { createRequestId, stripClientSuppliedRequestIds } from "@atlas/core/request/request-id";

export function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);

  // Never trust client-supplied tenant context headers.
  for (const header of SPOOFABLE_TENANT_HEADERS) {
    requestHeaders.delete(header);
  }

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
     * Keep static assets out of middleware.
     * Tenant resolution itself happens in server route wrappers/loaders.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
