import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FbaLegalDocument } from "@/features/public/components/legal/FbaLegalDocument";
import { LegalDocumentUnavailable } from "@/features/public/components/legal/LegalDocumentUnavailable";
import { publicLegalServerApi } from "@/modules/public/public-legal.server-api";
import { loadPublicTenantBranding } from "@atlas/tenant-branding";
import { runTenantStateGate } from "@atlas/tenant-gate";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "Disclaimer covering educational use only, trading risk, and the limits of our responsibility.",
};

export default async function DisclaimerPage() {
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

  // Like Terms and Privacy, the disclaimer is the tenant's own configuration.
  // A tenant without one gets an explicit notice, never another tenant's text.
  const response = await publicLegalServerApi.getDocument("disclaimer");
  const publicName = branding.publicName ?? "Academy";
  const logoUrl = branding.logoLightUrl ?? branding.logoDarkUrl ?? null;

  if (!response.data.document) {
    return (
      <LegalDocumentUnavailable title="Disclaimer" publicName={publicName} logoUrl={logoUrl} />
    );
  }

  return (
    <FbaLegalDocument document={response.data.document} publicName={publicName} logoUrl={logoUrl} />
  );
}
