import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { loadStudioShellContext } from "../../lib/server/studio-shell-context";
import { buildTenantUnavailableUrl } from "../../lib/tenant-unavailable-redirect";
import { redirectUnauthenticatedToLogin } from "../../lib/server/shell-auth-redirect";
import { StudioShellClient } from "./StudioShellClient";

type StudioShellGateProps = {
  children: ReactNode;
};

export async function StudioShellGate({ children }: StudioShellGateProps) {
  const context = await loadStudioShellContext();

  if (context.kind === "tenant_unavailable") {
    redirect(
      buildTenantUnavailableUrl({
        reason: context.reason,
        returnTo: "/studio",
      }),
    );
  }

  if (context.kind === "membership_blocked") {
    if (context.reason === "unauthenticated") {
      await redirectUnauthenticatedToLogin("/studio");
    }

    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold">Studio access unavailable</h1>
        <p role="alert" className="mt-2 text-sm">
          {context.message}
        </p>
        <p className="mt-4 text-xs opacity-70">Request ID: {context.requestId}</p>
      </main>
    );
  }

  return (
    <StudioShellClient
      branding={context.branding}
      requestId={context.requestId}
      member={context.member}
      mfaEnabled={context.mfaEnabled}
      navigationItems={context.navigation.items}
      pendingReviewCount={context.navigation.pendingReviewCount}
      pendingGradingCount={context.navigation.pendingGradingCount}
    >
      {children}
    </StudioShellClient>
  );
}
