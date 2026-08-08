import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { AuthShell } from "../../components/shells/AuthShell";
import { loadPublicTenantBranding } from "@atlas/tenant-branding";
import { runTenantStateGate } from "@atlas/tenant-gate";
import { resolvePlatformHost } from "../../lib/server/platform-host-gate";
import { getOrCreateRequestId } from "../../lib/request-id";

type AuthLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function AuthLayout({ children }: AuthLayoutProps) {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";

  // Platform plane (e.g. platform.localhost) has no tenant. Operators still need
  // to sign in here, so render a neutral, non-tenant-branded auth shell instead
  // of running the tenant gate (which would 404 on the platform host).
  if (resolvePlatformHost(host)) {
    const requestId = getOrCreateRequestId(headerList) || randomUUID();

    return (
      <AuthShell
        branding={{
          publicName: "Atlas Platform Console",
          issuerName: "Platform Operator Access",
          themeTokens: null,
          logoLightUrl: null,
          logoDarkUrl: null,
        }}
        requestId={requestId}
      >
        {children}
      </AuthShell>
    );
  }

  const gate = await runTenantStateGate();

  if (gate.kind === "not_found") {
    notFound();
  }

  if (gate.kind === "unavailable") {
    redirect(`/tenant-unavailable?reason=${gate.reason}`);
  }

  const branding = await loadPublicTenantBranding({
    tenantId: gate.tenant.tenantId,
    requestId: gate.tenant.requestId,
  });

  return (
    <AuthShell branding={branding} requestId={gate.tenant.requestId}>
      {children}
    </AuthShell>
  );
}
