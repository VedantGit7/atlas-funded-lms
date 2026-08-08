import type { Metadata } from "next";
import { CertificateStudioHomeRoute } from "../../../../features/certificates/certificate-builder/certificate-studio-home-route";
import { loadCertificateStudioPublicName } from "../../../../features/certificates/certificate-builder/load-studio-public-name";

export const metadata: Metadata = {
  title: "Certificate Studio Home",
  description: "Start a new certificate design or open a recent template.",
};

export default async function CertificateStudioHomePage() {
  const publicName = await loadCertificateStudioPublicName();
  return <CertificateStudioHomeRoute publicName={publicName} />;
}
