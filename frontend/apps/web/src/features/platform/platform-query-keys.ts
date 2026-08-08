import { clearPlatformClientDataCache } from "../../lib/query/platform-data-cache";

export function platformQueryKey(parts: readonly unknown[]): readonly unknown[] {
  return ["platform", ...parts];
}

export function platformTenantsQueryKey(filter: Record<string, unknown> = {}): readonly unknown[] {
  return platformQueryKey(["tenants", filter]);
}

export function platformTenantDetailQueryKey(tenantId: string): readonly unknown[] {
  return platformQueryKey(["tenant", tenantId]);
}

export function platformTenantProvisioningQueryKey(tenantId: string): readonly unknown[] {
  return platformQueryKey(["tenant", tenantId, "provisioning"]);
}

export function platformTenantEntitlementsQueryKey(tenantId: string): readonly unknown[] {
  return platformQueryKey(["tenant", tenantId, "entitlements"]);
}

export function platformFeatureFlagsQueryKey(): readonly unknown[] {
  return platformQueryKey(["feature-flags"]);
}

export function platformCatalogQueryKey(tab: string): readonly unknown[] {
  return platformQueryKey(["catalog", tab]);
}

export function platformAuditQueryKey(filter: Record<string, unknown> = {}): readonly unknown[] {
  return platformQueryKey(["audit", filter]);
}

export function platformSupportSessionsQueryKey(): readonly unknown[] {
  return platformQueryKey(["support", "active-sessions"]);
}

export function platformDeadLetterQueryKey(
  filter: Record<string, unknown> = {},
): readonly unknown[] {
  return platformQueryKey(["dead-letter", filter]);
}

export function invalidatePlatformCaches(
  reason:
    | "logout"
    | "host_change"
    | "mfa_downgrade"
    | "reason_expiry"
    | "capability_loss" = "capability_loss",
): void {
  clearPlatformClientDataCache(reason);
}
