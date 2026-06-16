export type PlatformPermission = `platform.${string}` | "platform.*";

export type PlatformContext = {
  principalId: string;
  requestId: string;

  /**
   * The specific platform permission required by the caller.
   * Examples:
   * - platform.tenant.read
   * - platform.tenant.manage
   * - platform.entitlement.manage
   * - platform.catalog.manage
   * - platform.audit.read
   * - platform.support.access
   */
  requiredPermission: PlatformPermission;

  /**
   * Platform permissions already resolved by the platform auth layer.
   * This helper does not implement auth; it only enforces that the caller
   * passed an explicit platform permission set.
   */
  platformPermissions: readonly PlatformPermission[];

  /**
   * Set when the platform action is scoped to a specific tenant.
   * Platform routes that touch tenant data must also set the tenant GUC
   * transaction-locally via withPlatformScope().
   */
  tenantId?: string | null;

  /**
   * Optional explicit tenant list for audit payloads when a platform operation
   * touches one or more tenants.
   */
  touchedTenantIds?: readonly string[];
};
