const cache = new Map<string, unknown>();
let activeTenantScope: string | null = null;

export function tenantQueryKey(scope: string, parts: readonly unknown[]): readonly unknown[] {
  return ["tenant", scope, ...parts];
}

export function setActiveTenantScope(scope: string): void {
  if (activeTenantScope != null && activeTenantScope !== scope) {
    clearClientDataCache("host_change");
  }
  activeTenantScope = scope;
}

export function getActiveTenantScope(): string | null {
  return activeTenantScope;
}

export function readClientDataCache(key: readonly unknown[]): unknown {
  return cache.get(JSON.stringify(key));
}

export function writeClientDataCache(key: readonly unknown[], value: unknown): void {
  cache.set(JSON.stringify(key), value);
}

export function clearClientDataCache(
  reason: "logout" | "membership_failure" | "host_change",
): void {
  cache.clear();
  if (reason === "logout" || reason === "host_change") {
    void import("../../observability/posthog-browser").then(({ resetPostHogBrowser }) => {
      resetPostHogBrowser();
    });
  }
  if (reason === "host_change") {
    activeTenantScope = null;
  }
}
