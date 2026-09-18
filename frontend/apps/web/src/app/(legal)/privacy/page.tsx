import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FbaLegalDocument } from "@/features/public/components/legal/FbaLegalDocument";
import { LegalDocumentUnavailable } from "@/features/public/components/legal/LegalDocumentUnavailable";
import { publicLegalServerApi } from "@/modules/public/public-legal.server-api";
import { loadPublicTenantBranding } from "@atlas/tenant-branding";
import { runTenantStateGate } from "@atlas/tenant-gate";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy explaining how we collect, use, and protect your personal information.",
};

export default async function PrivacyPage() {
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

  // Legal text is tenant configuration, not app source. A tenant that has not
  // published its own gets an explicit notice rather than another tenant's
  // policy, which is what shipping these as module constants produced.
  const response = await publicLegalServerApi.getDocument("privacy");
  const publicName = branding.publicName ?? "Academy";
  const logoUrl = branding.logoLightUrl ?? branding.logoDarkUrl ?? null;

  if (!response.data.document) {
    return (
      <LegalDocumentUnavailable title="Privacy Policy" publicName={publicName} logoUrl={logoUrl} />
    );
  }

  return (
    <FbaLegalDocument document={response.data.document} publicName={publicName} logoUrl={logoUrl} />
  );
}
