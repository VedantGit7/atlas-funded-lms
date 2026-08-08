import { headers } from "next/headers";
import { ATLAS_INTERNAL_TENANT_HOST_HEADER } from "../http-headers";
import { resolveRequestOriginFromHeaders } from "./resolve-request-origin";

/**
 * Reconstruct the tenant's public `/auth/confirm` URL from the incoming request
 * so Supabase sends the verification link back to the tenant the user is on
 * (fundedbeyond.com, the Atlas host, etc.) rather than the project-wide Site
 * URL. Passed as `emailRedirectTo` (Supabase's `{{ .RedirectTo }}`); it must be
 * allow-listed under Supabase Auth → URL Configuration → Redirect URLs.
 */
export async function resolveTenantEmailRedirect(): Promise<string | undefined> {
  const headerList = await headers();
  const host =
    headerList.get(ATLAS_INTERNAL_TENANT_HOST_HEADER) ??
    headerList.get("x-forwarded-host") ??
    headerList.get("host");
  if (!host?.trim()) {
    return undefined;
  }
  return `${resolveRequestOriginFromHeaders(headerList)}/auth/confirm`;
}
