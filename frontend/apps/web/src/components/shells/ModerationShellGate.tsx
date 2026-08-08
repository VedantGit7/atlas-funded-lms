import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { loadModerationShellContext } from "../../lib/server/moderation-shell-context";
import { buildTenantUnavailableUrl } from "../../lib/tenant-unavailable-redirect";
import { redirectUnauthenticatedToLogin } from "../../lib/server/shell-auth-redirect";
import { ModerationShellClient } from "./ModerationShellClient";

type ModerationShellGateProps = {
  children: ReactNode;
};

export async function ModerationShellGate({ children }: ModerationShellGateProps) {
  const context = await loadModerationShellContext();

  if (context.kind === "tenant_unavailable") {
    redirect(
      buildTenantUnavailableUrl({
        reason: context.reason,
        returnTo: "/moderate",
      }),
    );
  }

  if (context.kind === "membership_blocked") {
    if (context.reason === "unauthenticated") {
      await redirectUnauthenticatedToLogin("/moderate");
    }

    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold">Moderation access unavailable</h1>
        <p role="alert" className="mt-2 text-sm">
          {context.message}
        </p>
        <p className="mt-4 text-xs opacity-70">Request ID: {context.requestId}</p>
      </main>
    );
  }

  if (context.kind === "entitlement_blocked") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold">Community entitlement required</h1>
        <p role="alert" className="mt-2 text-sm">
          {context.message}
        </p>
        <p className="mt-4 text-xs opacity-70">Request ID: {context.requestId}</p>
      </main>
    );
  }

  return (
    <ModerationShellClient
      branding={context.branding}
      requestId={context.requestId}
      member={context.member}
      navigationItems={context.navigation.items}
      pendingReviewCount={context.navigation.pendingReviewCount}
    >
      {children}
    </ModerationShellClient>
  );
}
