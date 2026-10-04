export type PlatformNavItem = {
  href: string;
  label: string;
  screenId: string;
  requiresTenantRead?: boolean;
  requiresTenantManage?: boolean;
  requiresEntitlementManage?: boolean;
  requiresFeatureFlagManage?: boolean;
  requiresCatalogManage?: boolean;
  requiresAuditRead?: boolean;
  requiresSupportAccess?: boolean;
  requiresEventingReplay?: boolean;
  requiresCostRead?: boolean;
  requiresIdentityManage?: boolean;
  mobilePrimary?: boolean;
};

export const PLATFORM_PRIMARY_NAV: readonly PlatformNavItem[] = [
  {
    href: "/platform",
    label: "Tenants",
    screenId: "P1",
    requiresTenantRead: true,
    mobilePrimary: true,
  },
  {
    href: "/platform/tenants/new",
    label: "Provision",
    screenId: "P2",
    requiresTenantManage: true,
  },
  {
    href: "/platform/feature-flags",
    label: "Feature Flags",
    screenId: "P4",
    requiresFeatureFlagManage: true,
  },
  {
    href: "/platform/catalog",
    label: "Catalog",
    screenId: "P5",
    requiresCatalogManage: true,
  },
  {
    href: "/platform/audit",
    label: "Audit",
    screenId: "P6",
    requiresAuditRead: true,
    mobilePrimary: true,
  },
  {
    href: "/platform/support",
    label: "Support",
    screenId: "P7",
    requiresSupportAccess: true,
    mobilePrimary: true,
  },
  {
    href: "/platform/eventing",
    label: "Eventing",
    screenId: "P8",
    requiresEventingReplay: true,
  },
  {
    href: "/platform/costs",
    label: "Costs",
    screenId: "P9",
    requiresCostRead: true,
  },
  {
    href: "/platform/accounts",
    label: "Accounts",
    screenId: "P10",
    requiresIdentityManage: true,
  },
] as const;

import type { PlatformCapabilityProjection } from "./platform-capability-projection";

export function filterPlatformNavigation(
  items: readonly PlatformNavItem[],
  capabilities: PlatformCapabilityProjection,
): PlatformNavItem[] {
  return items.filter((item) => {
    if (item.requiresTenantRead && !capabilities.canTenantRead) return false;
    if (item.requiresTenantManage && !capabilities.canTenantManage) return false;
    if (item.requiresEntitlementManage && !capabilities.canEntitlementManage) return false;
    if (item.requiresFeatureFlagManage && !capabilities.canFeatureFlagManage) return false;
    if (item.requiresCatalogManage && !capabilities.canCatalogManage) return false;
    if (item.requiresAuditRead && !capabilities.canAuditRead) return false;
    if (item.requiresSupportAccess && !capabilities.canSupportAccess) return false;
    if (item.requiresEventingReplay && !capabilities.canEventingReplay) return false;
    if (item.requiresCostRead && !capabilities.canCostRead) return false;
    if (item.requiresIdentityManage && !capabilities.canIdentityManage) return false;
    return true;
  });
}
