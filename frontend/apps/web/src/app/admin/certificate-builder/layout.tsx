import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CertificateBuilderBoot } from "../../../features/certificates/certificate-builder/certificate-builder-boot";
import { loadCertificateStudioPublicName } from "../../../features/certificates/certificate-builder/load-studio-public-name";
import {
  resolveDocumentDescription,
  resolveDocumentTitle,
} from "../../../lib/branding/document-title";
import { loadPublicBootstrap } from "../../../lib/server/bootstrap";

/** Relative title so the root/admin template keeps "{Tenant} LMS" in the tab. */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const bootstrap = await loadPublicBootstrap();
    const tenantTitle = resolveDocumentTitle(bootstrap);
    return {
      title: {
        default: `Certificate Studio · ${tenantTitle}`,
        template: `%s · ${tenantTitle}`,
      },
      description: resolveDocumentDescription(bootstrap),
    };
  } catch {
    return {
      title: "Certificate Studio",
      description: "Design and manage certificate templates for your academy.",
    };
  }
}

export default async function CertificateBuilderLayout({ children }: { children: ReactNode }) {
  const publicName = await loadCertificateStudioPublicName();

  return <CertificateBuilderBoot publicName={publicName}>{children}</CertificateBuilderBoot>;
}
