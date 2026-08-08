"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { StarterTemplate } from "./starter-templates";
import { CertificateStudioTemplates } from "./studio-templates";
import { certificateStudioNewPath } from "./studio-routes";

type CertificateStudioTemplatesRouteProps = {
  publicName: string;
};

/**
 * Use-a-template gallery at `/admin/certificate-builder/templates`.
 * Choosing a starter opens the canvas at `/studio/new?starter=…`.
 */
export function CertificateStudioTemplatesRoute({
  publicName,
}: CertificateStudioTemplatesRouteProps) {
  const router = useRouter();

  const onUseTemplate = useCallback(
    (starter: StarterTemplate) => {
      router.push(
        certificateStudioNewPath(starter.id === "blank-canvas" ? "blank-canvas" : starter.id),
      );
    },
    [router],
  );

  const onBlank = useCallback(() => {
    router.push(certificateStudioNewPath());
  }, [router]);

  return (
    <CertificateStudioTemplates
      publicName={publicName}
      onUseTemplate={onUseTemplate}
      onBlank={onBlank}
    />
  );
}
