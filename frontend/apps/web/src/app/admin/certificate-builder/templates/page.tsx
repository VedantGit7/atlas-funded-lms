import type { Metadata } from "next";
import { CertificateStudioTemplatesRoute } from "../../../../features/certificates/certificate-builder/certificate-studio-templates-route";
import { loadCertificateStudioPublicName } from "../../../../features/certificates/certificate-builder/load-studio-public-name";

export const metadata: Metadata = {
  title: "Use a Template · Certificate Studio",
  description: "Choose a certificate starter template to open in Certificate Studio.",
};

export default async function CertificateStudioTemplatesPage() {
  const publicName = await loadCertificateStudioPublicName();
  return <CertificateStudioTemplatesRoute publicName={publicName} />;
}
