import type { AdminRouteEntitlement } from "./admin-route-registry";

export type AdminNavItem = {
  href: string;
  label: string;
  entitlement?: AdminRouteEntitlement;
  requiresWorkflowReview?: boolean;
  requiresStudioAccess?: boolean;
  requiresModerationAccess?: boolean;
  mobilePrimary?: boolean;
  externalShell?: "studio" | "moderation" | "review";
};

export const ADMIN_PRIMARY_NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", mobilePrimary: true },
  { href: "/admin/members", label: "Members", mobilePrimary: true },
  { href: "/admin/roles", label: "Roles" },
  { href: "/admin/branding", label: "Branding" },
  { href: "/admin/domains", label: "Domains", entitlement: "branding.custom_domain.enable" },
  { href: "/admin/config", label: "Configuration" },
  { href: "/admin/feature-flags", label: "Feature Flags" },
  { href: "/admin/entitlements", label: "Entitlements" },
  {
    href: "/studio/courses",
    label: "Content",
    requiresStudioAccess: true,
    externalShell: "studio",
  },
  {
    href: "/moderate/cases",
    label: "Community",
    requiresModerationAccess: true,
    externalShell: "moderation",
  },
  { href: "/review", label: "Review", requiresWorkflowReview: true, externalShell: "review" },
  { href: "/admin/competency", label: "Competency" },
  {
    href: "/admin/certificates/templates",
    label: "Cert Templates",
    entitlement: "certification.enable",
  },
  { href: "/admin/certificates", label: "Certificates", entitlement: "certification.enable" },
  { href: "/admin/gamification", label: "Gamification", entitlement: "gamification.enable" },
  { href: "/admin/notifications/templates", label: "Notifications" },
  { href: "/admin/automation", label: "Automation" },
  { href: "/admin/workflows", label: "Workflows" },
  { href: "/admin/locales", label: "Locales" },
  { href: "/admin/extensions", label: "Extensions" },
  { href: "/admin/readiness-policy", label: "Readiness Policy" },
  { href: "/admin/analytics", label: "Analytics", entitlement: "analytics.dashboard.view" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/exports", label: "Data Exports", entitlement: "data.export.enable" },
  { href: "/admin/deletion-requests", label: "Deletion Requests", mobilePrimary: true },
] as const;

export type EnabledEntitlements = ReadonlySet<string>;

export type AdminNavigationCapabilities = {
  enabledEntitlements: EnabledEntitlements;
  canAccessWorkflowReview: boolean;
  canAccessStudio: boolean;
  canAccessModeration: boolean;
};

export function filterAdminNavigation(
  items: readonly AdminNavItem[],
  capabilities: AdminNavigationCapabilities,
): AdminNavItem[] {
  return items.filter((item) => {
    if (item.entitlement && !capabilities.enabledEntitlements.has(item.entitlement)) {
      return false;
    }
    if (item.requiresWorkflowReview && !capabilities.canAccessWorkflowReview) {
      return false;
    }
    if (item.requiresStudioAccess && !capabilities.canAccessStudio) {
      return false;
    }
    if (item.requiresModerationAccess && !capabilities.canAccessModeration) {
      return false;
    }
    return true;
  });
}

export function isAdminEntitlementEnabled(
  enabledEntitlements: EnabledEntitlements,
  key: AdminRouteEntitlement,
): boolean {
  return enabledEntitlements.has(key);
}
