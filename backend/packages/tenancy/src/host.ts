import { AtlasHttpError } from "@atlas/core/http/errors";

const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

export function normalizeHost(input: string | null): string {
  if (!input) {
    throw new AtlasHttpError({
      code: "TENANT_NOT_FOUND",
      status: 404,
      message: "Tenant not found",
    });
  }

  let host = input.trim().toLowerCase();

  // Host can arrive as "host:port".
  if (host.startsWith("[")) {
    throw new AtlasHttpError({
      code: "TENANT_NOT_FOUND",
      status: 404,
      message: "Tenant not found",
    });
  }

  host = host.split(":")[0] ?? "";

  if (!host || host.includes("/") || host.includes("\\")) {
    throw new AtlasHttpError({
      code: "TENANT_NOT_FOUND",
      status: 404,
      message: "Tenant not found",
    });
  }

  // Local dev should still resolve through tenant_domains.
  // Example: tenant-a.localhost must exist in tenant_domains for local tests.
  if (LOCALHOST_HOSTS.has(host)) {
    throw new AtlasHttpError({
      code: "TENANT_NOT_FOUND",
      status: 404,
      message: "Tenant not found",
    });
  }

  return host;
}

export function resolveRequestHostFromHeaders(headers: Headers): string {
  const atlasTenantHost = headers.get("x-atlas-tenant-host");
  if (atlasTenantHost?.trim()) {
    return normalizeHost(atlasTenantHost);
  }

  const directHost = headers.get("host");
  const forwardedHost = headers.get("x-forwarded-host");

  if (forwardedHost) {
    const directHostname = directHost?.trim().toLowerCase().split(":")[0] ?? "";

    if (!directHost || LOCALHOST_HOSTS.has(directHostname)) {
      return normalizeHost(forwardedHost);
    }
  }

  return normalizeHost(directHost);
}
