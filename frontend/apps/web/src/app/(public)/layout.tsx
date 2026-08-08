import { notFound, redirect } from "next/navigation";
import { PublicSiteShell } from "../../components/shells/PublicSiteShell";
import { PublicAttributionCapture } from "../../components/attribution/PublicAttributionCapture";
import { loadPublicTenantBranding } from "@atlas/tenant-branding";
import { runTenantStateGate } from "@atlas/tenant-gate";

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
    <PublicSiteShell
      publicName={branding.publicName ?? "Atlas Academy"}
      logoLightUrl={branding.logoLightUrl}
      logoDarkUrl={branding.logoDarkUrl}
    >
      <PublicAttributionCapture />
      {children}
    </PublicSiteShell>
  );
}
