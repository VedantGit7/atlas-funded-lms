const DEFAULT_PLATFORM_HOST = "platform.localhost";

/**
 * Platform plane host detection. Mirrors the frontend
 * `lib/server/platform-host-gate.ts` so the API can recognise platform-plane
 * requests (which never resolve a tenant) on the same `PLATFORM_HOST` config.
 */
export function resolvePlatformHost(host: string | null): boolean {
  const configured = process.env["PLATFORM_HOST"]?.trim().toLowerCase();
  const normalizedHost = (host ?? "").split(":")[0]?.toLowerCase() ?? "";

  if (!normalizedHost) {
    return false;
  }

  if (configured) {
    return normalizedHost === configured.split(":")[0]?.toLowerCase();
  }

  return normalizedHost === DEFAULT_PLATFORM_HOST || normalizedHost.startsWith("platform.");
}
