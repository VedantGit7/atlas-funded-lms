import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ShellAccessBlockedScreen } from "../patterns/errors/ShellAccessBlockedScreen";
import {
  STUDIO_NO_ACCESS_MESSAGE,
  loadStudioShellContext,
} from "../../lib/server/studio-shell-context";
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
      <ShellAccessBlockedScreen
        branding={context.branding}
        title={
          context.message === STUDIO_NO_ACCESS_MESSAGE
            ? "You don't have access"
            : "Studio unavailable"
        }
        description={context.message}
        requestId={context.requestId}
        action={{ href: "/", label: "Go to your learning" }}
      />
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
