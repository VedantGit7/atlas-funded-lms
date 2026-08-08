import type { StudioRouteEntitlement } from "./studio-route-registry";

export type StudioNavItem = {
  href: string;
  label: string;
  entitlement?: StudioRouteEntitlement;
  requiresWorkflowAccess?: boolean;
  mobilePrimary?: boolean;
};

export const STUDIO_PRIMARY_NAV: readonly StudioNavItem[] = [
  { href: "/studio", label: "Dashboard", mobilePrimary: true },
  { href: "/studio/courses", label: "Courses", mobilePrimary: true },
  { href: "/studio/items", label: "Item Bank" },
  { href: "/studio/item-collections", label: "Collections" },
  { href: "/studio/assessments", label: "Assessments", mobilePrimary: true },
  { href: "/studio/learning-paths", label: "Learning Paths" },
  { href: "/studio/grading", label: "Grading", mobilePrimary: true },
  { href: "/studio/analytics", label: "Analytics", entitlement: "analytics.dashboard.view" },
  { href: "/studio/review", label: "Review & Approvals", requiresWorkflowAccess: true },
] as const;

export type EnabledEntitlements = ReadonlySet<string>;

export type StudioNavigationCapabilities = {
  enabledEntitlements: EnabledEntitlements;
  canAccessWorkflowReview: boolean;
};

export function filterStudioNavigation(
  items: readonly StudioNavItem[],
  capabilities: StudioNavigationCapabilities,
): StudioNavItem[] {
  return items.filter((item) => {
    if (item.entitlement && !capabilities.enabledEntitlements.has(item.entitlement)) {
      return false;
    }
    if (item.requiresWorkflowAccess && !capabilities.canAccessWorkflowReview) {
      return false;
    }
    return true;
  });
}

export function isStudioEntitlementEnabled(
  enabledEntitlements: EnabledEntitlements,
  key: StudioRouteEntitlement,
): boolean {
  return enabledEntitlements.has(key);
}
