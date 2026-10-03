import { createHash, timingSafeEqual } from "node:crypto";
import { isDeployedRuntime } from "../config/runtime-environment";
import { ATLAS_INTERNAL_TENANT_HOST_HEADER } from "./headers";
import {
  ATLAS_CLIENT_IP_HEADER,
  ATLAS_PROXY_AUTHENTICATED_HEADER,
  normalizeClientIp,
} from "./client-ip";
export {
  ATLAS_CLIENT_IP_HEADER,
  ATLAS_PROXY_AUTHENTICATED_HEADER,
  normalizeClientIp,
  resolveEdgeClientIp,
  validateClientIpConfiguration,
} from "./client-ip";

export const ATLAS_API_PROXY_KEY_HEADER = "x-atlas-proxy-key";
export const ATLAS_PROXY_SOURCE_HEADER = "x-atlas-proxy-source";

/** Server-only headers for requests sent to the configured internal API origin. */
export function buildApiProxyHeaders(
  browserHost: string,
  initial?: HeadersInit,
  env: NodeJS.ProcessEnv = process.env,
  clientIp = "unknown",
  source: "browser" | "server" = "server",
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
  headers.delete(ATLAS_PROXY_AUTHENTICATED_HEADER);
  headers.set(ATLAS_PROXY_SOURCE_HEADER, source);
  headers.delete(ATLAS_CLIENT_IP_HEADER);
  headers.set(ATLAS_CLIENT_IP_HEADER, normalizeClientIp(clientIp));
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
  const forwardedIp = headers.get(ATLAS_CLIENT_IP_HEADER) ?? "";
  const source = headers.get(ATLAS_PROXY_SOURCE_HEADER);
  headers.delete(ATLAS_PROXY_SOURCE_HEADER);
  headers.delete(ATLAS_CLIENT_IP_HEADER);
  headers.delete(ATLAS_PROXY_AUTHENTICATED_HEADER);
  // Only the authenticated web service can forward client identity to the API.
  headers.delete("x-forwarded-for");
  const edgeHeader = env["TRUSTED_CLIENT_IP_HEADER"]?.trim();
  if (edgeHeader) headers.delete(edgeHeader);
  headers.delete(ATLAS_API_PROXY_KEY_HEADER);
  const secret = env["API_PROXY_SECRET"]?.trim() ?? "";
  const authenticated =
    Boolean(secret && supplied) &&
    timingSafeEqual(
      createHash("sha256").update(secret).digest(),
      createHash("sha256").update(supplied).digest(),
    );
  const unsignedLocalDevelopment = !secret && !isDeployedRuntime(env);

  if (authenticated) {
    headers.set(ATLAS_PROXY_AUTHENTICATED_HEADER, source === "server" ? "server" : "browser");
    headers.set(ATLAS_CLIENT_IP_HEADER, normalizeClientIp(forwardedIp));
  }

  if (!authenticated && !unsignedLocalDevelopment) {
    headers.delete(ATLAS_INTERNAL_TENANT_HOST_HEADER);
    headers.delete("x-forwarded-host");
  }
}
