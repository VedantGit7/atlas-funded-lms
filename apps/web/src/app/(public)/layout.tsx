import { notFound, redirect } from "next/navigation";
import { PublicSiteShell } from "../../components/shells/PublicSiteShell";
import { loadPublicTenantBranding } from "../../lib/server/public-tenant-branding";
import { runTenantStateGate } from "../../lib/server/tenant-state-gate";

type PublicLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function PublicLayout({ children }: PublicLayoutProps) {
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
    <PublicSiteShell title={branding.publicName ?? "Atlas Academy"}>{children}</PublicSiteShell>
  );
}
