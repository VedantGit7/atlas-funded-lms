import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FbaLegalDocument } from "@/features/public/components/legal/FbaLegalDocument";
import { TERMS_DOCUMENT } from "@/features/public/components/legal/terms-content";
import { loadPublicTenantBranding } from "@atlas/tenant-branding";
import { runTenantStateGate } from "@atlas/tenant-gate";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description:
    "Terms and Conditions for FundedBeyond Academy, including account use, educational services, fees, and trading risk disclaimers.",
};

export default async function TermsPage() {
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
    <FbaLegalDocument
      document={TERMS_DOCUMENT}
      publicName={branding.publicName ?? "FundedBeyond Academy"}
    />
  );
}
