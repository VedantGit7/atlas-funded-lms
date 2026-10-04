export type PlatformCapabilityKey =
  | "platform.tenant.read"
  | "platform.tenant.manage"
  | "platform.entitlement.manage"
  | "platform.feature_flag.manage"
  | "platform.catalog.manage"
  | "platform.audit.read"
  | "platform.support.access"
  | "platform.cost.read"
  | "platform.cost.manage"
  | "platform.identity.manage";

export type PlatformCapabilityProjection = {
  canTenantRead: boolean;
  canTenantManage: boolean;
  canEntitlementManage: boolean;
  canFeatureFlagManage: boolean;
  canCatalogManage: boolean;
  canAuditRead: boolean;
  canSupportAccess: boolean;
  canEventingReplay: boolean;
  canCostRead: boolean;
  canCostManage: boolean;
  canIdentityManage: boolean;
};

export function projectPlatformCapabilities(
  permissions: readonly string[],
): PlatformCapabilityProjection {
  const has = (permission: PlatformCapabilityKey) =>
    permissions.includes(permission) || permissions.includes("platform.*");

  return {
    canTenantRead: has("platform.tenant.read"),
    canTenantManage: has("platform.tenant.manage"),
    canEntitlementManage: has("platform.entitlement.manage"),
    canFeatureFlagManage: has("platform.feature_flag.manage"),
    canCatalogManage: has("platform.catalog.manage"),
    canAuditRead: has("platform.audit.read"),
    canSupportAccess: has("platform.support.access"),
    canEventingReplay: has("platform.tenant.manage"),
    canCostRead: has("platform.cost.read"),
    canCostManage: has("platform.cost.manage"),
    canIdentityManage: has("platform.identity.manage"),
  };
}
