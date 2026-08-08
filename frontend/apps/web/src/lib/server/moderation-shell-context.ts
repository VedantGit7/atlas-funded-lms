import type { PublicTenantBranding } from "./public-tenant-branding";
import { loadPublicTenantBranding } from "./public-tenant-branding";
import { runTenantStateGate } from "./tenant-state-gate";
import {
  loadModerationNavigationProjection,
  type ModerationNavigationProjection,
} from "./moderation-navigation-projection";
import { ServerApiError, serverApi } from "../server-api";

export type ModerationShellMemberProjection = {
  membershipId: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type ModerationShellContext =
  | {
      kind: "ready";
      requestId: string;
      branding: PublicTenantBranding;
      member: ModerationShellMemberProjection;
      navigation: ModerationNavigationProjection;
    }
  | {
      kind: "membership_blocked";
      requestId: string;
      branding: PublicTenantBranding;
      reason: "unauthenticated" | "forbidden" | "suspended" | "invited";
      message: string;
    }
  | {
      kind: "entitlement_blocked";
      requestId: string;
      branding: PublicTenantBranding;
      message: string;
    }
  | {
      kind: "tenant_unavailable";
      reason: string;
    };

export async function loadModerationShellContext(): Promise<ModerationShellContext> {
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
    const [me, navigation] = await Promise.all([
      serverApi.get<{
        data: {
          membership: { id: string; status: string };
          profile: { displayName: string | null; avatarUrl: string | null } | null;
        };
      }>("/api/v1/me"),
      loadModerationNavigationProjection(),
    ]);

    if (!navigation.enabledEntitlements.has("community.enable")) {
      return {
        kind: "entitlement_blocked",
        requestId: gate.tenant.requestId,
        branding,
        message: "Community moderation requires the community entitlement.",
      };
    }

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
        message: "Sign in with an active membership to access moderation.",
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
        message: "Accept your invitation to access moderation.",
      };
    }

    if (error.code === "ENTITLEMENT_REQUIRED") {
      return {
        kind: "entitlement_blocked",
        requestId: gate.tenant.requestId,
        branding,
        message: "Community moderation requires the community entitlement.",
      };
    }

    return {
      kind: "membership_blocked",
      requestId: gate.tenant.requestId,
      branding,
      reason: "forbidden",
      message: "You do not have moderation access.",
    };
  }
}
