import type { ActiveEntitlementRow } from "./repositories/entitlement.repository";

/**
 * Plan resource limits for the Usage Insights "…And Limits" view. A limit of
 * `null` means unlimited. Values resolve in priority order:
 *   1. explicit `usage.limit.*` entitlement values set by the platform operator
 *   2. plan-tier defaults inferred from the subscription plan name
 * These defaults are placeholders and are expected to be tuned per commercial
 * plan; the entitlement override is the real source of truth.
 */
export type UsageLimits = {
  storageGb: number | null;
  mau: number | null;
  bandwidthGb: number | null;
  videoHours: number | null;
};

export const USAGE_LIMIT_KEYS = {
  storageGb: "usage.limit.storage_gb",
  mau: "usage.limit.mau",
  bandwidthGb: "usage.limit.bandwidth_gb",
  videoHours: "usage.limit.video_hours",
} as const;

const UNLIMITED: UsageLimits = {
  storageGb: null,
  mau: null,
  bandwidthGb: null,
  videoHours: null,
};

function planTierDefaults(planName: string | null): UsageLimits {
  const normalized = (planName ?? "").toLowerCase();
  if (normalized.includes("enterprise")) {
    return UNLIMITED;
  }
  if (normalized.includes("professional")) {
    return { storageGb: 100, mau: 1000, bandwidthGb: 500, videoHours: 200 };
  }
  if (normalized.includes("growth")) {
    return { storageGb: 50, mau: 500, bandwidthGb: 200, videoHours: 100 };
  }
  // Starter / unknown plans get the most conservative caps.
  return { storageGb: 10, mau: 100, bandwidthGb: 50, videoHours: 20 };
}

function readNumericEntitlement(entitlements: ActiveEntitlementRow[], key: string): number | null {
  const entry = entitlements.find((row) => row.key === key);
  if (!entry) {
    return null;
  }
  const value = entry.value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "object" && value !== null && "limit" in value) {
    const limit: unknown = value.limit;
    if (typeof limit === "number" && Number.isFinite(limit)) {
      return limit;
    }
  }
  return null;
}

export function resolveUsageLimits(
  planName: string | null,
  entitlements: ActiveEntitlementRow[],
): UsageLimits {
  const defaults = planTierDefaults(planName);
  return {
    storageGb:
      readNumericEntitlement(entitlements, USAGE_LIMIT_KEYS.storageGb) ?? defaults.storageGb,
    mau: readNumericEntitlement(entitlements, USAGE_LIMIT_KEYS.mau) ?? defaults.mau,
    bandwidthGb:
      readNumericEntitlement(entitlements, USAGE_LIMIT_KEYS.bandwidthGb) ?? defaults.bandwidthGb,
    videoHours:
      readNumericEntitlement(entitlements, USAGE_LIMIT_KEYS.videoHours) ?? defaults.videoHours,
  };
}
