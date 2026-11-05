import { cache } from "react";
import { cookies, headers } from "next/headers";
import { ATLAS_INTERNAL_COOKIE_HEADER } from "../http-headers";
import { buildCookieHeaderFromPairs } from "./apply-set-cookie-headers";

/**
 * Build the Cookie header for internal API calls. Cached per RSC request so
 * parallel `serverApi.get` calls share one cookie jar. The proxy stamps the jar
 * it forwards onto `x-atlas-internal-cookie`; without it, the request's own
 * cookies are used.
 */
export const resolveCookieHeaderForInternalApi = cache(async (): Promise<string> => {
  const headerList = await headers();
  const fromMiddleware = headerList.get(ATLAS_INTERNAL_COOKIE_HEADER);
  if (fromMiddleware) return fromMiddleware;

  const cookieStore = await cookies();
  return buildCookieHeaderFromPairs(cookieStore.getAll());
});
