import type { EntitlementView } from "@atlas/domain-config/schemas/entitlements";
import {
  filterLearnerNavigation,
  LEARNER_PRIMARY_NAV,
  type LearnerNavItem,
} from "../../features/learner/learner-navigation";
import { ServerApiError, serverApi } from "../server-api";

export type LearnerNavigationProjection = {
  items: LearnerNavItem[];
  enabledEntitlements: Set<string>;
};

function collectEnabledEntitlements(entitlements: EntitlementView[]): Set<string> {
  const enabled = new Set<string>();
  for (const entry of entitlements) {
    if (entry.enabled) {
      enabled.add(entry.key);
    }
  }
  return enabled;
}

export async function loadLearnerNavigationProjection(): Promise<LearnerNavigationProjection> {
  try {
    const response = await serverApi.get<{ data: EntitlementView[] }>("/api/v1/entitlements");
    const enabledEntitlements = collectEnabledEntitlements(response.data);
    return {
      items: filterLearnerNavigation(LEARNER_PRIMARY_NAV, enabledEntitlements),
      enabledEntitlements,
    };
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      throw error;
    }
    return {
      items: filterLearnerNavigation(LEARNER_PRIMARY_NAV, new Set()),
      enabledEntitlements: new Set(),
    };
  }
}
