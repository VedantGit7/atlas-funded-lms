"use client";

import { useState } from "react";
import type { z } from "zod";
import { CertificateCard } from "../../../features/certificates/components/CertificateCard";
import { CertificateShareDialog } from "../../../features/certificates/components/CertificateShareDialog";
import type { certificateDtoSchema } from "../../../server/certificates/certificate.dto";

type CertificateDto = z.infer<typeof certificateDtoSchema>;

type LearnerCertificatesClientProps = {
  certificates: CertificateDto[];
  origin: string;
};

export function LearnerCertificatesClient({
  certificates,
  origin,
}: LearnerCertificatesClientProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  if (certificates.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
        You do not have any certificates yet.
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {certificates.map((certificate) => (
          <CertificateCard
            key={certificate.id}
            certificate={certificate}
            onShare={() => {
              setShareUrl(`${origin}${certificate.verificationUrl}`);
            }}
          />
        ))}
      </div>
      <CertificateShareDialog
        open={shareUrl != null}
        verificationUrl={shareUrl ?? ""}
        onClose={() => {
          setShareUrl(null);
        }}
      />
    </>
  );
}
