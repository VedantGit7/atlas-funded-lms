import type { EntitlementView } from "@atlas/domain-config/schemas/entitlements";
import {
  filterLearnerNavigation,
  LEARNER_PRIMARY_NAV,
  type LearnerNavItem,
} from "../../features/learner/learner-navigation";
import { serverApi } from "../server-api";
export type LearnerNavigationProjection = {
  items: LearnerNavItem[];
  enabledEntitlements: Set<string>;
};

function fallbackLearnerNavigationProjection(): LearnerNavigationProjection {
  return {
    items: filterLearnerNavigation(LEARNER_PRIMARY_NAV, new Set()).filter(
      (item) => item.href !== "/newsfeed",
    ),
    enabledEntitlements: new Set(),
  };
}

function collectEnabledEntitlements(entitlements: EntitlementView[]): Set<string> {
  const enabled = new Set<string>();
  for (const entry of entitlements) {
    if (entry.enabled) {
      enabled.add(entry.key);
    }
  }
  return enabled;
}

async function loadLeaderboardsPublic(): Promise<boolean> {
  try {
    const response = await serverApi.get<{ data: { leaderboardsPublic: boolean } }>(
      "/api/v1/gamification/config",
    );
    return response.data.leaderboardsPublic;
  } catch {
    // Config is optional for shell rendering; default to visible when unavailable.
    return true;
  }
}

async function loadNewsfeedEnabled(): Promise<boolean> {
  try {
    const response = await serverApi.get<{ data: { enabled: boolean } }>(
      "/api/v1/public/marketing/newsfeeds/settings",
    );
    return response.data.enabled;
  } catch {
    return false;
  }
}

export async function loadLearnerNavigationProjection(): Promise<LearnerNavigationProjection> {
  try {
    const response = await serverApi.get<{ data: EntitlementView[] }>("/api/v1/entitlements");
    const enabledEntitlements = collectEnabledEntitlements(response.data);
    let items = filterLearnerNavigation(LEARNER_PRIMARY_NAV, enabledEntitlements);

    if (enabledEntitlements.has("gamification.enable")) {
      const leaderboardsPublic = await loadLeaderboardsPublic();
      if (!leaderboardsPublic) {
        items = items.filter((item) => item.href !== "/leaderboards");
      }
    }

    const newsfeedEnabled = await loadNewsfeedEnabled();
    if (!newsfeedEnabled) {
      items = items.filter((item) => item.href !== "/newsfeed");
    }

    return {
      items,
      enabledEntitlements,
    };
  } catch {
    // Entitlements are optional for shell rendering. Membership/auth is enforced by
    // /api/v1/me; if entitlements are unavailable, show core navigation only.
    return fallbackLearnerNavigationProjection();
  }
}
