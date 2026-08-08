import type { PublicTenantBranding } from "./public-tenant-branding";
import { loadPublicTenantBranding } from "./public-tenant-branding";
import { runTenantStateGate } from "./tenant-state-gate";
import {
  loadAdminNavigationProjection,
  type AdminNavigationProjection,
} from "./admin-navigation-projection";
import { ServerApiError, serverApi } from "../server-api";
import { redirectUnauthenticatedToLogin } from "./shell-auth-redirect";

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
  let gate;
  try {
    gate = await runTenantStateGate();
  } catch (error) {
    if (error instanceof ServerApiError && error.code === "TENANT_NOT_FOUND") {
      return { kind: "tenant_unavailable", reason: "not_found" };
    }
    if (error instanceof ServerApiError && error.code === "INTERNAL_ERROR") {
      return { kind: "tenant_unavailable", reason: "transient_error" };
    }
    throw error;
  }

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
    // After a successful tenant gate, a TENANT_NOT_FOUND on /me is almost always
    // a brief host-resolution miss during dev recompile. Retry once more with a
    // longer pause so admin shell does not bounce to the transient screen.
    let me: {
      data: {
        membership: { id: string; status: string; roleKeys: string[] };
        profile: { displayName: string | null; avatarUrl: string | null } | null;
        identity: { mfaEnabled: boolean };
      };
    };
    try {
      me = await serverApi.get("/api/v1/me");
    } catch (firstError) {
      if (
        !(firstError instanceof ServerApiError) ||
        firstError.code !== "TENANT_NOT_FOUND"
      ) {
        throw firstError;
      }
      await new Promise((resolve) => setTimeout(resolve, 750));
      me = await serverApi.get("/api/v1/me");
    }

    if (!me.data.identity.mfaEnabled) {
      return {
        kind: "session_assurance_blocked",
        requestId: gate.tenant.requestId,
        branding,
        message:
          "Admin console access requires multi-factor authentication on your account. Enable MFA and sign in again.",
      };
    }

    const roleKeys = me.data.membership.roleKeys ?? [];
    const isTenantAdmin = roleKeys.includes("owner") || roleKeys.includes("admin");
    if (!isTenantAdmin) {
      return {
        kind: "membership_blocked",
        requestId: gate.tenant.requestId,
        branding,
        reason: "forbidden",
        message:
          "You do not have tenant admin membership for this academy. Contact your academy administrator for access.",
      };
    }

    // Navigation probes are best-effort. A failure loading entitlements or other
    // secondary data must not block admin shell access when /api/v1/me succeeded.
    let navigation: AdminNavigationProjection;
    try {
      navigation = await loadAdminNavigationProjection(me.data.identity.mfaEnabled, {
        actorHasOwnerRank: roleKeys.includes("owner"),
      });
    } catch {
      navigation = await loadAdminNavigationProjection(me.data.identity.mfaEnabled, {
        skipAuthenticatedProbes: true,
        actorHasOwnerRank: roleKeys.includes("owner"),
      });
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

    const requestId = error.requestId || gate.tenant.requestId;

    if (error.status === 401 || error.code === "AUTH_REQUIRED") {
      await redirectUnauthenticatedToLogin("/admin");
    }

    if (error.code === "TENANT_NOT_FOUND") {
      // The tenant-state gate above already confirmed this tenant exists and is
      // ACTIVE for this host. A TENANT_NOT_FOUND on the authenticated call right
      // after is therefore a transient host-resolution miss (common in the brief
      // window after a redirect / dev route recompile), not a real missing tenant.
      // Surface it as transient so the user gets a retry, not a "suspended" page.
      return { kind: "tenant_unavailable", reason: "transient_error" };
    }

    if (error.code === "MEMBERSHIP_SUSPENDED") {
      return {
        kind: "membership_blocked",
        requestId,
        branding,
        reason: "suspended",
        message:
          "Your membership is suspended. Contact your academy administrator to restore access.",
      };
    }

    // Backend emits MEMBERSHIP_PENDING for INVITED; keep MEMBERSHIP_INVITED as a
    // compatibility alias in case older envelopes still use it.
    if (error.code === "MEMBERSHIP_PENDING" || error.code === "MEMBERSHIP_INVITED") {
      return {
        kind: "membership_blocked",
        requestId,
        branding,
        reason: "invited",
        message:
          "Your invitation has not been fully accepted yet. Open the link in your invitation email to finish setup.",
      };
    }

    if (error.code === "NO_MEMBERSHIP" || error.code === "MEMBERSHIP_REMOVED") {
      return {
        kind: "membership_blocked",
        requestId,
        branding,
        reason: "forbidden",
        message:
          "You do not have an active membership for this academy. Contact your academy administrator for access.",
      };
    }

    if (error.status === 429 || error.code === "RATE_LIMITED") {
      return {
        kind: "membership_blocked",
        requestId,
        branding,
        reason: "forbidden",
        message:
          "Admin access is temporarily rate-limited. Wait a moment and refresh the page.",
      };
    }

    return {
      kind: "membership_blocked",
      requestId,
      branding,
      reason: "forbidden",
      message: `Admin access could not be verified (${error.code}). Refresh and try again, or sign out and sign back in.`,
    };
  }
}
