import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CertificateBuilderBoot } from "../../../features/certificates/certificate-builder/certificate-builder-boot";
import { loadCertificateStudioPublicName } from "../../../features/certificates/certificate-builder/load-studio-public-name";
import {
  resolveDocumentDescription,
  resolveDocumentTitle,
} from "../../../lib/branding/document-title";
import { loadPublicBootstrap } from "../../../lib/server/bootstrap";

/** "Certificate Studio · {Tenant} LMS"; pages under it use "%s · {Tenant} LMS". */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const bootstrap = await loadPublicBootstrap();
    const tenantTitle = resolveDocumentTitle(bootstrap);
    return {
      // Absolute, or the admin layout's template repeats the academy name (QA review 1 m1).
      title: {
        absolute: `Certificate Studio · ${tenantTitle}`,
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
