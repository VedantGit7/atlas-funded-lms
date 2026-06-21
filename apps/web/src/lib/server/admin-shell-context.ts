import type { PublicTenantBranding } from "./public-tenant-branding";
import { loadPublicTenantBranding } from "./public-tenant-branding";
import { runTenantStateGate } from "./tenant-state-gate";
import {
  loadAdminNavigationProjection,
  type AdminNavigationProjection,
} from "./admin-navigation-projection";
import { ServerApiError, serverApi } from "../server-api";

export type AdminShellMemberProjection = {
  membershipId: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type AdminShellContext =
  | {
      kind: "ready";
      requestId: string;
      branding: PublicTenantBranding;
      member: AdminShellMemberProjection;
      navigation: AdminNavigationProjection;
    }
  | {
      kind: "membership_blocked";
      requestId: string;
      branding: PublicTenantBranding;
      reason: "unauthenticated" | "forbidden" | "suspended" | "invited";
      message: string;
    }
  | {
      kind: "session_assurance_blocked";
      requestId: string;
      branding: PublicTenantBranding;
      message: string;
    }
  | {
      kind: "tenant_unavailable";
      reason: string;
    };

export async function loadAdminShellContext(): Promise<AdminShellContext> {
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
          identity: { mfaEnabled: boolean };
        };
      }>("/api/v1/me"),
      loadAdminNavigationProjection(),
    ]);

    if (!me.data.identity.mfaEnabled) {
      return {
        kind: "session_assurance_blocked",
        requestId: gate.tenant.requestId,
        branding,
        message:
          "Admin console access requires multi-factor authentication on your account. Enable MFA and sign in again.",
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
        message: "Sign in with an active membership to access tenant administration.",
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

    if (error.code === "MEMBERSHIP_INVITED") {
      return {
        kind: "membership_blocked",
        requestId: gate.tenant.requestId,
        branding,
        reason: "invited",
        message: "Accept your invitation to access tenant administration.",
      };
    }

    return {
      kind: "membership_blocked",
      requestId: gate.tenant.requestId,
      branding,
      reason: "forbidden",
      message: "You do not have tenant admin access.",
    };
  }
}
