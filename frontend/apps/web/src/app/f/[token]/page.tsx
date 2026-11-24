import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TenantLogo } from "@atlas/design-system/components/tenant-logo";
import { loadPublicTenantBranding } from "@atlas/tenant-branding";
import { runTenantStateGate } from "@atlas/tenant-gate";
import { PublicMarketingFormClient } from "../../../features/marketing/PublicMarketingFormClient";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ source?: string }>;
};

/**
 * A shared form. It carries the academy's logo and name (QA review 1 m12:
 * the page had no branding). Inside a CTA pop-up (source=CTA) it is shown in
 * an iframe on the academy's own page, so the header is left out there.
 */
export default async function PublicFormPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const sourceRaw = (query.source ?? "LINK").toUpperCase();
  const source =
    sourceRaw === "CTA" || sourceRaw === "WEBSITE" || sourceRaw === "LINK" ? sourceRaw : "LINK";

  const gate = await runTenantStateGate();
  if (gate.kind === "not_found") notFound();
  if (gate.kind === "unavailable") redirect(`/tenant-unavailable?reason=${gate.reason}`);

  const embedded = source === "CTA";
  const branding = embedded
    ? null
    : await loadPublicTenantBranding({
        tenantId: gate.tenant.tenantId,
        requestId: gate.tenant.requestId,
      });

  return (
    <div className="min-h-screen bg-muted/50 text-foreground">
      {branding ? (
        <header className="border-b border-border bg-background">
          <div className="mx-auto flex max-w-lg items-center px-4 py-4 sm:px-6">
            <Link href="/" className="text-brand-primary">
              <TenantLogo
                publicName={branding.publicName ?? "Academy"}
                logoLightUrl={branding.logoLightUrl}
                logoDarkUrl={branding.logoDarkUrl}
              />
            </Link>
          </div>
        </header>
      ) : null}
      <main id="main-content">
        <PublicMarketingFormClient token={token} source={source} />
      </main>
    </div>
  );
}
