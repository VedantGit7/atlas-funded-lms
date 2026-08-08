import type { EntitlementView } from "@atlas/domain-config/schemas/entitlements";
import {
  ADMIN_PRIMARY_NAV,
  filterAdminNavigation,
  type AdminNavItem,
} from "../../features/admin/admin-navigation";
import { projectAdminOwnerCapabilities } from "../../features/admin/admin-owner-projection";
import type { AdminOwnerCapabilityProjection } from "../../features/admin/admin-owner-projection";
import { ServerApiError, serverApi } from "../server-api";

export type AdminNavigationProjection = {
  items: AdminNavItem[];
  enabledEntitlements: Set<string>;
  canAccessWorkflowReview: boolean;
  canAccessStudio: boolean;
  canAccessModeration: boolean;
  canAccessAppealsReview: boolean;
  pendingReviewCount: number | null;
  ownerCapabilities: AdminOwnerCapabilityProjection;
  mfaEnabled: boolean;
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

async function probeStudioAccess(): Promise<boolean> {
  try {
    await serverApi.get("/api/v1/courses?limit=1");
    return true;
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return false;
    }
    return false;
  }
}

async function probeModerationAccess(): Promise<boolean> {
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

async function loadEntitlements(): Promise<EntitlementView[]> {
  try {
    const response = await serverApi.get<{ data: EntitlementView[] }>("/api/v1/entitlements");
    return response.data;
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return [];
    }
    throw error;
  }
}

export async function loadAdminNavigationProjection(
  mfaEnabled = false,
  options?: { skipAuthenticatedProbes?: boolean; actorHasOwnerRank?: boolean },
): Promise<AdminNavigationProjection> {
  let enabledEntitlements = new Set<string>();
  let canAccessWorkflowReview = false;
  let canAccessStudio = false;
  let canAccessModeration = false;
  let canAccessAppealsReview = false;
  let pendingReviewCount: number | null = null;

  if (!options?.skipAuthenticatedProbes) {
    try {
      const [entitlements, workflowProbe, studioAccess, moderationAccess, appealsAccess] =
        await Promise.all([
          loadEntitlements(),
          probeWorkflowReviewAccess(),
          probeStudioAccess(),
          probeModerationAccess(),
          probeAppealsReviewAccess(),
        ]);

      enabledEntitlements = collectEnabledEntitlements(entitlements);
      canAccessWorkflowReview = workflowProbe.canAccess;
      pendingReviewCount = workflowProbe.pendingCount;
      canAccessStudio = studioAccess;
      canAccessModeration = moderationAccess;
      canAccessAppealsReview = appealsAccess;
    } catch (error) {
      if (error instanceof ServerApiError && error.status === 401) {
        throw error;
      }
    }
  }

  const capabilities = {
    enabledEntitlements,
    canAccessWorkflowReview,
    canAccessStudio,
    canAccessModeration,
    canAccessAppealsReview,
  };

  return {
    items: filterAdminNavigation(ADMIN_PRIMARY_NAV, capabilities),
    enabledEntitlements,
    canAccessWorkflowReview,
    canAccessStudio,
    canAccessModeration,
    canAccessAppealsReview,
    pendingReviewCount,
    mfaEnabled,
    ownerCapabilities: projectAdminOwnerCapabilities({
      actorHasOwnerRank: options?.actorHasOwnerRank === true,
    }),
  };
}
