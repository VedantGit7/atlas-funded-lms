import type { EntitlementView } from "@atlas/domain-config/schemas/entitlements";
import {
  filterModerationNavigation,
  MODERATION_PRIMARY_NAV,
  type ModerationNavItem,
} from "../../features/moderation/moderation-navigation";
import { ServerApiError, serverApi } from "../server-api";

export type ModerationNavigationProjection = {
  items: ModerationNavItem[];
  enabledEntitlements: Set<string>;
  canAccessModerationQueue: boolean;
  canAccessAppealsReview: boolean;
  canAccessSpaceManage: boolean;
  canAccessWorkflowReview: boolean;
  pendingReviewCount: number | null;
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

async function probeModerationQueueAccess(): Promise<boolean> {
  try {
    await serverApi.get("/api/v1/moderation/cases?view=cases&limit=1");
    return true;
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return false;
    }
    return false;
  }
}

async function probeAppealsReviewAccess(): Promise<boolean> {
  try {
    await serverApi.get("/api/v1/moderation/cases?view=appeals&limit=1");
    return true;
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return false;
    }
    return false;
  }
}

async function probeSpaceManageAccess(): Promise<boolean> {
  try {
    await serverApi.get("/api/v1/spaces?limit=1");
    return true;
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return false;
    }
    return false;
  }
}

async function probeWorkflowReviewAccess(): Promise<{
  canAccess: boolean;
  pendingCount: number | null;
}> {
  try {
    const response = await serverApi.get<{ data: unknown[] }>(
      "/api/v1/workflows?status=pending&limit=25",
    );
    return { canAccess: true, pendingCount: response.data.length };
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return { canAccess: false, pendingCount: null };
    }
    return { canAccess: false, pendingCount: null };
  }
}

export async function loadModerationNavigationProjection(): Promise<ModerationNavigationProjection> {
  let enabledEntitlements = new Set<string>();
  let canAccessModerationQueue = false;
  let canAccessAppealsReview = false;
  let canAccessSpaceManage = false;
  let canAccessWorkflowReview = false;
  let pendingReviewCount: number | null = null;

  try {
    const [entitlements, queueAccess, appealsAccess, spaceAccess, workflowProbe] =
      await Promise.all([
        serverApi.get<{ data: EntitlementView[] }>("/api/v1/entitlements"),
        probeModerationQueueAccess(),
        probeAppealsReviewAccess(),
        probeSpaceManageAccess(),
        probeWorkflowReviewAccess(),
      ]);

    enabledEntitlements = collectEnabledEntitlements(entitlements.data);
    canAccessModerationQueue = queueAccess;
    canAccessAppealsReview = appealsAccess;
    canAccessSpaceManage = spaceAccess;
    canAccessWorkflowReview = workflowProbe.canAccess;
    pendingReviewCount = workflowProbe.pendingCount;
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      throw error;
    }
  }

  const capabilities = {
    canAccessModerationQueue,
    canAccessAppealsReview,
    canAccessSpaceManage,
    canAccessWorkflowReview,
  };

  return {
    items: filterModerationNavigation(MODERATION_PRIMARY_NAV, capabilities),
    enabledEntitlements,
    ...capabilities,
    pendingReviewCount,
  };
}

export function resolveModerationSpaceVisibilityOptions(
  enabledEntitlements: Set<string>,
): Array<"TENANT" | "PUBLIC" | "PRIVATE" | "UNLISTED"> {
  const options: Array<"TENANT" | "PUBLIC" | "PRIVATE" | "UNLISTED"> = ["TENANT", "PUBLIC"];
  if (enabledEntitlements.has("community.private_spaces.enable")) {
    options.push("PRIVATE", "UNLISTED");
  }
  return options;
}
