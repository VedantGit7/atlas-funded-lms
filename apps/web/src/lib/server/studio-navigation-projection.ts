import type { EntitlementView } from "@atlas/domain-config/schemas/entitlements";
import {
  filterStudioNavigation,
  STUDIO_PRIMARY_NAV,
  type StudioNavItem,
} from "../../features/studio/studio-navigation";
import { ServerApiError, serverApi } from "../server-api";

export type StudioNavigationProjection = {
  items: StudioNavItem[];
  enabledEntitlements: Set<string>;
  canAccessWorkflowReview: boolean;
  pendingReviewCount: number | null;
  pendingGradingCount: number | null;
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

async function probePendingGradingCount(): Promise<number | null> {
  try {
    const response = await serverApi.get<{ data: unknown[] }>(
      "/api/v1/grading-tasks?assignedTo=me&status=PENDING&limit=25",
    );
    return response.data.length;
  } catch {
    return null;
  }
}

export async function loadStudioNavigationProjection(): Promise<StudioNavigationProjection> {
  let enabledEntitlements = new Set<string>();
  let canAccessWorkflowReview = false;
  let pendingReviewCount: number | null = null;
  let pendingGradingCount: number | null = null;

  try {
    const [entitlements, workflowProbe, gradingCount] = await Promise.all([
      serverApi.get<{ data: EntitlementView[] }>("/api/v1/entitlements"),
      probeWorkflowReviewAccess(),
      probePendingGradingCount(),
    ]);

    enabledEntitlements = collectEnabledEntitlements(entitlements.data);
    canAccessWorkflowReview = workflowProbe.canAccess;
    pendingReviewCount = workflowProbe.pendingCount;
    pendingGradingCount = gradingCount;
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      throw error;
    }
  }

  return {
    items: filterStudioNavigation(STUDIO_PRIMARY_NAV, {
      enabledEntitlements,
      canAccessWorkflowReview,
    }),
    enabledEntitlements,
    canAccessWorkflowReview,
    pendingReviewCount,
    pendingGradingCount,
  };
}
