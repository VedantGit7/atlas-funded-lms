import { cache } from "react";
import { cookies, headers } from "next/headers";
import { ATLAS_ACCESS_TOKEN_COOKIE, ATLAS_REFRESH_TOKEN_COOKIE } from "../auth-cookies";
import { ATLAS_INTERNAL_COOKIE_HEADER } from "../http-headers";
import { buildCookieHeaderFromPairs } from "./apply-set-cookie-headers";
import { isAccessTokenExpired, refreshSessionCookieHeader } from "./session-refresh";
import { resolveTenantHostForInternalApi } from "./resolve-tenant-host";

function readCookieValue(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
  );
  return match?.[1] ?? null;
}

async function ensureFreshCookieHeader(cookieHeader: string): Promise<string> {
  const refreshToken = readCookieValue(cookieHeader, ATLAS_REFRESH_TOKEN_COOKIE);
  if (!refreshToken) {
    return cookieHeader;
  }

  const accessToken = readCookieValue(cookieHeader, ATLAS_ACCESS_TOKEN_COOKIE);
  if (accessToken && !isAccessTokenExpired(accessToken)) {
    return cookieHeader;
  }

  try {
    const tenantHost = await resolveTenantHostForInternalApi();
    const refreshed = await refreshSessionCookieHeader(cookieHeader, tenantHost);
    return refreshed ?? cookieHeader;
  } catch {
    return cookieHeader;
  }
}

/**
 * Build the Cookie header for internal API calls. Cached per RSC request so
 * parallel `serverApi.get` calls share one refresh and one cookie jar.
 *
 * Middleware stamps refreshed auth tokens onto `x-atlas-internal-cookie`
 * because RSC contexts cannot mutate `cookies()` during the same request.
 * When that header is absent (soft navigations, flight timing), we refresh
 * server-side from the refresh-token cookie before the first internal API call.
 */
export const resolveCookieHeaderForInternalApi = cache(async (): Promise<string> => {
  const headerList = await headers();
  const fromMiddleware = headerList.get(ATLAS_INTERNAL_COOKIE_HEADER);

  if (fromMiddleware) {
    return ensureFreshCookieHeader(fromMiddleware);
  }

  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeaderFromPairs(cookieStore.getAll());
  return ensureFreshCookieHeader(cookieHeader);
});
