import type { PublicTenantBranding } from "./public-tenant-branding";
import { loadPublicTenantBranding } from "./public-tenant-branding";
import { runTenantStateGate } from "./tenant-state-gate";
import {
  loadLearnerNavigationProjection,
  type LearnerNavigationProjection,
} from "./learner-navigation-projection";
import { parallelLoad } from "../api/parallel";
import { ServerApiError, serverApi } from "../server-api";

export type LearnerShellMemberProjection = {
  membershipId: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type LearnerShellContext =
  | {
      kind: "ready";
      requestId: string;
      branding: PublicTenantBranding;
      member: LearnerShellMemberProjection;
      navigation: LearnerNavigationProjection;
      unreadNotificationCount: number | null;
    }
  | {
      kind: "membership_blocked";
      requestId: string;
      branding: PublicTenantBranding;
      reason: "unauthenticated" | "forbidden" | "suspended" | "invited";
      message: string;
    }
  | {
      kind: "tenant_unavailable";
      reason: string;
    };

async function loadUnreadNotificationCount(): Promise<number | null> {
  try {
    const response = await serverApi.get<{
      data: Array<{ readAt: string | null }>;
    }>("/api/v1/me/notifications?limit=25");
    return response.data.filter((item) => item.readAt == null).length;
  } catch {
    return null;
  }
}

export async function loadLearnerShellContext(): Promise<LearnerShellContext> {
  const gate = await runTenantStateGate();

  if (gate.kind === "not_found") {
    return { kind: "tenant_unavailable", reason: "not_found" };
  }

  if (gate.kind === "unavailable") {
    return { kind: "tenant_unavailable", reason: gate.reason };
  }

  const branding = await loadPublicTenantBranding({
    tenantId: gate.tenant.tenantId,
    requestId: gate.tenant.requestId,
  });

  try {
    type MeShellResponse = {
      data: {
        membership: { id: string; status: string };
        profile: { displayName: string | null; avatarUrl: string | null } | null;
      };
    };

    const [me, navigation, unreadNotificationCount] = await parallelLoad<
      [MeShellResponse, LearnerNavigationProjection, number | null]
    >([
      () => serverApi.get<MeShellResponse>("/api/v1/me"),
      () => loadLearnerNavigationProjection(),
      () => loadUnreadNotificationCount(),
    ]);

    return {
      kind: "ready",
      requestId: gate.tenant.requestId,
      branding,
      member: {
        membershipId: me.data.membership.id,
        displayName: me.data.profile?.displayName ?? null,
        avatarUrl: me.data.profile?.avatarUrl ?? null,
      },
      navigation,
      unreadNotificationCount,
    };
  } catch (error) {
    if (!(error instanceof ServerApiError)) {
      throw error;
    }

    if (error.status === 401) {
      return {
        kind: "membership_blocked",
        requestId: gate.tenant.requestId,
        branding,
        reason: "unauthenticated",
        message: "Sign in with an active membership to access learner navigation.",
      };
    }

    if (error.code === "MEMBERSHIP_SUSPENDED") {
      return {
        kind: "membership_blocked",
        requestId: gate.tenant.requestId,
        branding,
        reason: "suspended",
        message: "Your membership is suspended.",
      };
    }

    if (error.code === "MEMBERSHIP_PENDING" || error.code === "MEMBERSHIP_INVITED") {
      return {
        kind: "membership_blocked",
        requestId: gate.tenant.requestId,
        branding,
        reason: "invited",
        message: "Accept your invitation to access learner navigation.",
      };
    }

    return {
      kind: "membership_blocked",
      requestId: gate.tenant.requestId,
      branding,
      reason: "forbidden",
      message: "You do not have active learner access.",
    };
  }
}
