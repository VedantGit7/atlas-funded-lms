import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loadLearnerShellContext } from "../../lib/server/learner-shell-context";
import { buildTenantUnavailableUrl } from "../../lib/tenant-unavailable-redirect";
import { LearnerShellClient } from "./LearnerShellClient";

type LearnerShellGateProps = {
  children: ReactNode;
};

export async function LearnerShellGate({ children }: LearnerShellGateProps) {
  const context = await loadLearnerShellContext();
  const returnTo = (await headers()).get("x-atlas-pathname");

  if (context.kind === "tenant_unavailable") {
    redirect(
      buildTenantUnavailableUrl({
        reason: context.reason,
        returnTo,
      }),
    );
  }

  if (context.kind === "membership_blocked") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold">Access unavailable</h1>
        <p role="alert" className="mt-2 text-sm">
          {context.message}
        </p>
        <p className="mt-4 text-xs opacity-70">Request ID: {context.requestId}</p>
      </main>
    );
  }

  return (
    <LearnerShellClient
      branding={context.branding}
      requestId={context.requestId}
      member={context.member}
      navigationItems={context.navigation.items}
      unreadNotificationCount={context.unreadNotificationCount}
    >
      {children}
    </LearnerShellClient>
  );
}
