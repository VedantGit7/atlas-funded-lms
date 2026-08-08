import type { AdminRouteEntitlement } from "./admin-route-registry";

export type AdminNavItem = {
  href: string;
  label: string;
  entitlement?: AdminRouteEntitlement;
  requiresWorkflowReview?: boolean;
  requiresStudioAccess?: boolean;
  requiresModerationAccess?: boolean;
  requiresAppealsReview?: boolean;
  mobilePrimary?: boolean;
  externalShell?: "studio";
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
    href: "/admin/moderation/cases",
    label: "Moderation Queue",
    requiresModerationAccess: true,
  },
  {
    href: "/admin/moderation/appeals",
    label: "Appeals",
    requiresAppealsReview: true,
  },
  { href: "/admin/review", label: "Review", requiresWorkflowReview: true },
  { href: "/admin/competency", label: "Competency" },
  {
    href: "/admin/certificates/templates",
    label: "Cert Templates",
    entitlement: "certification.enable",
  },
  { href: "/admin/certificates", label: "Certificates", entitlement: "certification.enable" },
  { href: "/admin/gamification", label: "Gamification", entitlement: "gamification.enable" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/notifications/templates", label: "Notification Templates" },
  { href: "/admin/automation", label: "Automation" },
  { href: "/admin/workflows", label: "Workflows" },
  { href: "/admin/locales", label: "Locales" },
  { href: "/admin/extensions", label: "Extensions" },
  { href: "/admin/readiness-policy", label: "Readiness Policy" },
  { href: "/admin/marketing", label: "Marketing" },
  { href: "/admin/sales", label: "Sales" },
  { href: "/admin/manage", label: "Manage" },
  { href: "/admin/sub-schools", label: "Sub-Schools" },
  { href: "/admin/analytics", label: "Analytics", entitlement: "analytics.dashboard.view" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/insights", label: "Insights" },
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
  canAccessAppealsReview: boolean;
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
    if (item.requiresAppealsReview && !capabilities.canAccessAppealsReview) {
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
