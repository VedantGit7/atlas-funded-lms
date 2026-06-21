import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { loadAdminShellContext } from "../../lib/server/admin-shell-context";
import { TenantAdminShellClient } from "./TenantAdminShellClient";

type TenantAdminShellGateProps = {
  children: ReactNode;
};

export async function TenantAdminShellGate({ children }: TenantAdminShellGateProps) {
  const context = await loadAdminShellContext();

  if (context.kind === "tenant_unavailable") {
    redirect(`/tenant-unavailable?reason=${context.reason}`);
  }

  if (context.kind === "membership_blocked") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold">Admin access unavailable</h1>
        <p role="alert" className="mt-2 text-sm">
          {context.message}
        </p>
        <p className="mt-4 text-xs opacity-70">Request ID: {context.requestId}</p>
      </main>
    );
  }

  if (context.kind === "session_assurance_blocked") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold">Session assurance required</h1>
        <p role="alert" className="mt-2 text-sm">
          {context.message}
        </p>
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
