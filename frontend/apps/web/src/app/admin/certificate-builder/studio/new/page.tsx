import type { Metadata } from "next";
import { CertificateStudioEditorRoute } from "../../../../../features/certificates/certificate-builder/certificate-studio-editor-route";
import { loadCertificateStudioPublicName } from "../../../../../features/certificates/certificate-builder/load-studio-public-name";

export const metadata: Metadata = {
  title: "New Certificate Design",
  description: "Create a new certificate design in Certificate Studio.",
};

export default async function CertificateStudioNewPage({
  searchParams,
}: {
  searchParams: Promise<{ starter?: string }>;
}) {
  const publicName = await loadCertificateStudioPublicName();
  const params = await searchParams;
  return (
    <CertificateStudioEditorRoute
      publicName={publicName}
      {...(params.starter ? { starterId: params.starter } : {})}
    />
  );
}
