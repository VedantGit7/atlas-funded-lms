const cache = new Map<string, unknown>();

export function readPlatformClientDataCache(key: readonly unknown[]): unknown {
  return cache.get(JSON.stringify(key));
}

export function writePlatformClientDataCache(key: readonly unknown[], value: unknown): void {
  cache.set(JSON.stringify(key), value);
}

export function clearPlatformClientDataCache(
  _reason: "logout" | "host_change" | "mfa_downgrade" | "reason_expiry" | "capability_loss",
): void {
  cache.clear();
}
