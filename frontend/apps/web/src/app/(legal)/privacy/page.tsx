import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FbaLegalDocument } from "@/features/public/components/legal/FbaLegalDocument";
import { PRIVACY_DOCUMENT } from "@/features/public/components/legal/privacy-content";
import { loadPublicTenantBranding } from "@atlas/tenant-branding";
import { runTenantStateGate } from "@atlas/tenant-gate";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for FundedBeyond Academy explaining how we collect, use, and protect your personal information.",
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

  return (
    <FbaLegalDocument
      document={PRIVACY_DOCUMENT}
      publicName={branding.publicName ?? "FundedBeyond Academy"}
    />
  );
}
