import type { ReactNode } from "react";
import { loadPlatformShellContext } from "../../lib/server/platform-shell-context";
import { PlatformConsoleShellClient } from "./PlatformConsoleShellClient";

type PlatformConsoleShellGateProps = {
  children: ReactNode;
};

export async function PlatformConsoleShellGate({ children }: PlatformConsoleShellGateProps) {
  const context = await loadPlatformShellContext();

  if (context.kind === "host_blocked") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold">Platform console unavailable</h1>
        <p role="alert" className="mt-2 text-sm">
          {context.message}
        </p>
        <p className="mt-4 text-xs opacity-70">Request ID: {context.requestId}</p>
      </main>
    );
  }

  if (context.kind === "auth_blocked" || context.kind === "platform_forbidden") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold">Platform access denied</h1>
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
    <PlatformConsoleShellClient
      requestId={context.requestId}
      displayEmail={context.displayEmail}
      mfaEnabled={context.mfaEnabled}
      navigationItems={context.navigationItems}
      capabilities={context.capabilities}
    >
      {children}
    </PlatformConsoleShellClient>
  );
}
