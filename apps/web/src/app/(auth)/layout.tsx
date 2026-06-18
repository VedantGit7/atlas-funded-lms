import { notFound, redirect } from "next/navigation";
import { AuthShell } from "../../components/shells/AuthShell";
import { loadPublicTenantBranding } from "../../lib/server/public-tenant-branding";
import { runTenantStateGate } from "../../lib/server/tenant-state-gate";

type AuthLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function AuthLayout({ children }: AuthLayoutProps) {
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
