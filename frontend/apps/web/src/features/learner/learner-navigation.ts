import type { LearnerRouteEntitlement } from "./learner-route-registry";

export type LearnerNavItem = {
  href: string;
  label: string;
  entitlement?: LearnerRouteEntitlement;
  mobilePrimary?: boolean;
};

export const LEARNER_PRIMARY_NAV: readonly LearnerNavItem[] = [
  { href: "/", label: "Home", mobilePrimary: true },
  { href: "/courses", label: "Courses", mobilePrimary: true },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/practice", label: "Practice", mobilePrimary: true },
  { href: "/readiness", label: "Readiness" },
  { href: "/progress", label: "Progress" },
  { href: "/resources", label: "Resources" },
  { href: "/newsfeed", label: "Newsfeed" },
  { href: "/diagnostic/me", label: "Diagnostic" },
  { href: "/achievements", label: "Achievements", entitlement: "gamification.enable" },
  { href: "/leaderboards", label: "Leaderboards", entitlement: "gamification.enable" },
  { href: "/community", label: "Community", entitlement: "community.enable" },
  { href: "/hall-of-fame", label: "Hall of Fame", entitlement: "community.enable" },
  { href: "/certificates", label: "Certificates", entitlement: "certification.enable" },
  { href: "/notifications", label: "Notifications" },
  { href: "/search", label: "Search" },
] as const;

export type EnabledEntitlements = ReadonlySet<string>;

export function filterLearnerNavigation(
  items: readonly LearnerNavItem[],
  enabledEntitlements: EnabledEntitlements,
): LearnerNavItem[] {
  return items.filter((item) => {
    if (!item.entitlement) {
      return true;
    }
    return enabledEntitlements.has(item.entitlement);
  });
}

export function isEntitlementEnabled(
  enabledEntitlements: EnabledEntitlements,
  key: LearnerRouteEntitlement,
): boolean {
  return enabledEntitlements.has(key);
}
