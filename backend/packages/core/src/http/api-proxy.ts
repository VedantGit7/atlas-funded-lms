import { createHash, timingSafeEqual } from "node:crypto";
import { isDeployedRuntime } from "../config/runtime-environment";
import { ATLAS_INTERNAL_TENANT_HOST_HEADER } from "./headers";

export const ATLAS_API_PROXY_KEY_HEADER = "x-atlas-proxy-key";

/** Server-only headers for requests sent to the configured internal API origin. */
export function buildApiProxyHeaders(
  browserHost: string,
  initial?: HeadersInit,
  env: NodeJS.ProcessEnv = process.env,
): Headers {
  const headers = new Headers(initial);
  const secret = env["API_PROXY_SECRET"]?.trim() ?? "";
  if (!secret && isDeployedRuntime(env)) {
    throw new Error("API_PROXY_SECRET is required for deployed API forwarding");
  }
  if (!browserHost.trim()) {
    throw new Error("Browser host is required for API forwarding");
  }

  // Never reuse a credential or tenant host supplied by the browser.
  headers.delete(ATLAS_API_PROXY_KEY_HEADER);
  if (secret) headers.set(ATLAS_API_PROXY_KEY_HEADER, secret);
  headers.set(ATLAS_INTERNAL_TENANT_HOST_HEADER, browserHost.trim());
  headers.set("x-forwarded-host", browserHost.trim());
  return headers;
}

/** Authenticate forwarding at API ingress and remove the credential before handlers. */
export function sanitizeApiProxyHeaders(
  headers: Headers,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const supplied = headers.get(ATLAS_API_PROXY_KEY_HEADER) ?? "";
  headers.delete(ATLAS_API_PROXY_KEY_HEADER);
  const secret = env["API_PROXY_SECRET"]?.trim() ?? "";
  const authenticated =
    Boolean(secret && supplied) &&
    timingSafeEqual(
      createHash("sha256").update(secret).digest(),
      createHash("sha256").update(supplied).digest(),
    );
  const unsignedLocalDevelopment = !secret && !isDeployedRuntime(env);

  if (!authenticated && !unsignedLocalDevelopment) {
    headers.delete(ATLAS_INTERNAL_TENANT_HOST_HEADER);
    headers.delete("x-forwarded-host");
  }
}
