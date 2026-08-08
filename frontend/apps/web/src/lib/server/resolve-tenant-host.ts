import { cache } from "react";
import { headers } from "next/headers";
import { ATLAS_INTERNAL_TENANT_HOST_HEADER } from "../http-headers";

/**
 * Resolve the browser-facing host for internal API calls. Cached per RSC request
 * so parallel internal API calls share one host resolution. Middleware stamps
 * the incoming request host onto `x-atlas-tenant-host` because RSC/server-action
 * contexts can lose or rewrite `host` during internal fetches.
 */
export const resolveTenantHostForInternalApi = cache(async (): Promise<string> => {
  const headerList = await headers();
  const tenantHost =
    headerList.get(ATLAS_INTERNAL_TENANT_HOST_HEADER) ??
    headerList.get("x-forwarded-host") ??
    headerList.get("host");

  if (!tenantHost?.trim()) {
    throw new Error("Missing tenant host for internal API request");
  }

  return tenantHost.trim();
});
