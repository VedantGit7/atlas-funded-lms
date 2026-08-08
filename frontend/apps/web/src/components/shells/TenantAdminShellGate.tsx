import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShellAccessBlockedScreen } from "../../components/patterns/errors/ShellAccessBlockedScreen";
import { loadAdminShellContext } from "../../lib/server/admin-shell-context";
import { buildTenantUnavailableUrl } from "../../lib/tenant-unavailable-redirect";
import { redirectUnauthenticatedToLogin } from "../../lib/server/shell-auth-redirect";
import { TenantAdminShellClient } from "./TenantAdminShellClient";

type TenantAdminShellGateProps = {
  children: ReactNode;
};

export async function TenantAdminShellGate({ children }: TenantAdminShellGateProps) {
  const context = await loadAdminShellContext();

  if (context.kind === "tenant_unavailable") {
    redirect(
      buildTenantUnavailableUrl({
        reason: context.reason,
        returnTo: "/admin",
      }),
    );
  }

  if (context.kind === "membership_blocked") {
    if (context.reason === "unauthenticated") {
      await redirectUnauthenticatedToLogin("/admin");
    }

    return (
      <ShellAccessBlockedScreen
        branding={context.branding}
        title="Admin access unavailable"
        description={context.message}
        requestId={context.requestId}
      />
    );
  }

  if (context.kind === "session_assurance_blocked") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold">Session assurance required</h1>
        <p role="alert" className="mt-2 text-sm">
          {context.message}
        </p>
        <Link
          href="/profile/security?setup=mfa&next=%2Fadmin"
          className="mt-4 inline-flex rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-primary-foreground"
        >
          Set up multi-factor authentication
        </Link>
        <p className="mt-4 text-xs opacity-70">Request ID: {context.requestId}</p>
      </main>
    );
  }

  return (
    <TenantAdminShellClient
      branding={context.branding}
      requestId={context.requestId}
      member={context.member}
      navigationItems={context.navigation.items}
      pendingReviewCount={context.navigation.pendingReviewCount}
      mfaEnabled={context.navigation.mfaEnabled}
    >
      {children}
    </TenantAdminShellClient>
  );
}
