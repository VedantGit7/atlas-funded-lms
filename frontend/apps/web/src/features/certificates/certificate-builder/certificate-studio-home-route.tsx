"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { CertificateDesignDocument } from "@atlas/contracts/certificates/certificate-design-document";
import { CertificateStudioHome } from "./studio-home";
import { certificateStudioEditPath, certificateStudioNewPath } from "./studio-routes";

type CertificateStudioHomeRouteProps = {
  publicName: string;
};

/**
 * Studio Home at `/admin/certificate-builder/home`.
 * Opening a design navigates to `/studio/new` or `/studio/[templateId]`.
 */
export function CertificateStudioHomeRoute({ publicName }: CertificateStudioHomeRouteProps) {
  const router = useRouter();

  const onOpenStudio = useCallback(
    (args: {
      templateId?: string;
      name: string;
      document?: CertificateDesignDocument;
      updatedAt?: string;
      starterId?: string;
    }) => {
      if (args.templateId) {
        router.push(certificateStudioEditPath(args.templateId));
        return;
      }
      router.push(certificateStudioNewPath(args.starterId));
    },
    [router],
  );

  return <CertificateStudioHome publicName={publicName} onOpenStudio={onOpenStudio} />;
}
