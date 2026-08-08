import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { loadPublicTenantBranding } from "../../lib/server/public-tenant-branding";
import { runTenantStateGate } from "../../lib/server/tenant-state-gate";
import { loadAdminNavigationProjection } from "../../lib/server/admin-navigation-projection";
import { buildTenantUnavailableUrl } from "../../lib/tenant-unavailable-redirect";
import { redirectUnauthenticatedToLogin } from "../../lib/server/shell-auth-redirect";
import { ServerApiError, serverApi } from "../../lib/server-api";
import { TenantAdminShellClient } from "./TenantAdminShellClient";

type AdminAccountShellProps = {
  children: ReactNode;
};

/**
 * Admin-chrome shell for account-level pages (e.g. /settings) reached by an
 * admin/owner. Unlike TenantAdminShellGate, this deliberately does NOT block
 * on MFA: /settings is where an admin without MFA yet goes to set it up, so
 * gating it behind "MFA required" would make that page unreachable.
 */
export async function AdminAccountShell({ children }: AdminAccountShellProps) {
  const gate = await runTenantStateGate();

  if (gate.kind === "not_found") {
    redirect(buildTenantUnavailableUrl({ reason: "not_found", returnTo: "/settings" }));
  }

  if (gate.kind === "unavailable") {
    redirect(buildTenantUnavailableUrl({ reason: gate.reason, returnTo: "/settings" }));
  }

  const branding = await loadPublicTenantBranding({
    tenantId: gate.tenant.tenantId,
    requestId: gate.tenant.requestId,
  });

  try {
    const me = await serverApi.get<{
      data: {
        membership: { id: string; roleKeys?: string[] };
        profile: { displayName: string | null; avatarUrl: string | null } | null;
        identity: { mfaEnabled: boolean };
      };
    }>("/api/v1/me");

    const actorHasOwnerRank = (me.data.membership.roleKeys ?? []).includes("owner");

    let navigation;
    try {
      navigation = await loadAdminNavigationProjection(me.data.identity.mfaEnabled, {
        actorHasOwnerRank,
      });
    } catch {
      navigation = await loadAdminNavigationProjection(me.data.identity.mfaEnabled, {
        skipAuthenticatedProbes: true,
        actorHasOwnerRank,
      });
    }

    return (
      <TenantAdminShellClient
        branding={branding}
        requestId={gate.tenant.requestId}
        member={{
          membershipId: me.data.membership.id,
          displayName: me.data.profile?.displayName ?? null,
          avatarUrl: me.data.profile?.avatarUrl ?? null,
        }}
        navigationItems={navigation.items}
        pendingReviewCount={navigation.pendingReviewCount}
        mfaEnabled={navigation.mfaEnabled}
      >
        {children}
      </TenantAdminShellClient>
    );
  } catch (error) {
    if (!(error instanceof ServerApiError)) {
      throw error;
    }

    if (error.status === 401 || error.code === "AUTH_REQUIRED") {
      await redirectUnauthenticatedToLogin("/settings");
    }

    throw error;
  }
}
