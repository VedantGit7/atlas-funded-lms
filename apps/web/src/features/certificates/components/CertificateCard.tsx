"use client";

import type { z } from "zod";
import type { certificateDtoSchema } from "../../../server/certificates/certificate.dto";

type CertificateDto = z.infer<typeof certificateDtoSchema>;

type CertificateCardProps = {
  certificate: CertificateDto;
  onShare?: () => void;
};

export function CertificateCard({ certificate, onShare }: CertificateCardProps) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm print:border-neutral-400">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">{certificate.templateName}</h3>
          <p className="text-sm text-neutral-600">Credential ID: {certificate.credentialId}</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium uppercase tracking-wide text-neutral-700">
          {certificate.status}
        </span>
      </header>
      <dl className="grid gap-2 text-sm text-neutral-700">
        <div>
          <dt className="font-medium">Issued</dt>
          <dd>{new Date(certificate.issuedAt).toLocaleDateString()}</dd>
        </div>
        {certificate.revokedAt ? (
          <div>
            <dt className="font-medium">Revoked</dt>
            <dd>{new Date(certificate.revokedAt).toLocaleDateString()}</dd>
          </div>
        ) : null}
      </dl>
      {onShare ? (
        <button
          type="button"
          className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium"
          onClick={onShare}
        >
          Share verification link
        </button>
      ) : null}
    </article>
  );
}
