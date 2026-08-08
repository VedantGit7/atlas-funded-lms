import type { NextRequest } from "next/server";
import { ATLAS_INTERNAL_TENANT_HOST_HEADER } from "../http-headers";

/**
 * Reconstruct the browser-facing origin for redirects and email links.
 *
 * In local dev, `request.url` / `new URL(request.url).origin` is often
 * `http://localhost:3000` even when the user opened `fundedbeyond.localhost.test:3000`
 * (Turbopack binds one listener). Middleware stamps the real host on
 * `x-atlas-tenant-host` and `x-forwarded-host` — always prefer those for redirects.
 */
export function resolveRequestOriginFromHeaders(headerList: Headers): string {
  const host =
    headerList.get(ATLAS_INTERNAL_TENANT_HOST_HEADER) ??
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "localhost:3000";

  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https");

  return `${proto}://${host}`;
}

export function resolveRequestOrigin(req: NextRequest): string {
  return resolveRequestOriginFromHeaders(req.headers);
}
