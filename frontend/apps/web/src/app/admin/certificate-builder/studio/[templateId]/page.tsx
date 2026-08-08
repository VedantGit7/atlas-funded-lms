import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CertificateStudioEditorRoute } from "../../../../../features/certificates/certificate-builder/certificate-studio-editor-route";
import { loadCertificateStudioPublicName } from "../../../../../features/certificates/certificate-builder/load-studio-public-name";
import { CERTIFICATE_STUDIO_NEW } from "../../../../../features/certificates/certificate-builder/studio-routes";

export const metadata: Metadata = {
  title: "Edit Certificate Design",
  description: "Edit a certificate template in Certificate Studio.",
};

export default async function CertificateStudioEditPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const publicName = await loadCertificateStudioPublicName();
  const { templateId } = await params;

  if (templateId === "new") {
    redirect(CERTIFICATE_STUDIO_NEW);
  }

  return <CertificateStudioEditorRoute publicName={publicName} templateId={templateId} />;
}
