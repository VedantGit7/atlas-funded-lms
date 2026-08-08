export function resolvePlatformHost(host: string): boolean {
  const configured = process.env["PLATFORM_HOST"]?.trim().toLowerCase();
  const normalizedHost = host.split(":")[0]?.toLowerCase() ?? "";

  if (configured) {
    return normalizedHost === configured.split(":")[0]?.toLowerCase();
  }

  return normalizedHost === "platform.localhost" || normalizedHost.startsWith("platform.");
}

export function assertPlatformHost(host: string): void {
  if (!resolvePlatformHost(host)) {
    throw new Error("PLATFORM_HOST_MISMATCH");
  }
}
