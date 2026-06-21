export type ModerationNavItem = {
  href: string;
  label: string;
  requiresModerationQueue?: boolean;
  requiresAppealsReview?: boolean;
  requiresSpaceManage?: boolean;
  requiresWorkflowReview?: boolean;
  mobilePrimary?: boolean;
};

export const MODERATION_PRIMARY_NAV: readonly ModerationNavItem[] = [
  {
    href: "/moderate/cases",
    label: "Moderation Queue",
    requiresModerationQueue: true,
    mobilePrimary: true,
  },
  {
    href: "/moderate/appeals",
    label: "Appeals",
    requiresAppealsReview: true,
    mobilePrimary: true,
  },
  {
    href: "/moderate/spaces",
    label: "Community Spaces",
    requiresSpaceManage: true,
    mobilePrimary: true,
  },
  {
    href: "/review",
    label: "Review & Approvals",
    requiresWorkflowReview: true,
  },
] as const;

export type ModerationNavigationCapabilities = {
  canAccessModerationQueue: boolean;
  canAccessAppealsReview: boolean;
  canAccessSpaceManage: boolean;
  canAccessWorkflowReview: boolean;
};

export function filterModerationNavigation(
  items: readonly ModerationNavItem[],
  capabilities: ModerationNavigationCapabilities,
): ModerationNavItem[] {
  return items.filter((item) => {
    if (item.requiresModerationQueue && !capabilities.canAccessModerationQueue) {
      return false;
    }
    if (item.requiresAppealsReview && !capabilities.canAccessAppealsReview) {
      return false;
    }
    if (item.requiresSpaceManage && !capabilities.canAccessSpaceManage) {
      return false;
    }
    if (item.requiresWorkflowReview && !capabilities.canAccessWorkflowReview) {
      return false;
    }
    return true;
  });
}
