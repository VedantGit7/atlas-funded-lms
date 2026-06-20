"use client";

import type { z } from "zod";
import type { certificateDtoSchema } from "../../../server/certificates/certificate.dto";

type CertificateDto = z.infer<typeof certificateDtoSchema>;

type IssuedCertificateTableProps = {
  certificates: CertificateDto[];
  onIssue: () => void;
  onRevoke: (certificate: CertificateDto) => void;
};

export function IssuedCertificateTable({
  certificates,
  onIssue,
  onRevoke,
}: IssuedCertificateTableProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
          onClick={onIssue}
        >
          Issue certificate
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3">Credential</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {certificates.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-500" colSpan={6}>
                  No certificates issued yet.
                </td>
              </tr>
            ) : (
              certificates.map((certificate) => (
                <tr key={certificate.id} className="border-t border-neutral-200">
                  <td className="px-4 py-3 font-mono text-xs">{certificate.credentialId}</td>
                  <td className="px-4 py-3">{certificate.templateName}</td>
                  <td className="px-4 py-3">
                    {certificate.recipientLabel ?? certificate.membershipId}
                  </td>
                  <td className="px-4 py-3 capitalize">{certificate.status}</td>
                  <td className="px-4 py-3">
                    {new Date(certificate.issuedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {certificate.status === "issued" ? (
                      <button
                        type="button"
                        className="text-sm text-red-700 underline"
                        onClick={() => {
                          onRevoke(certificate);
                        }}
                      >
                        Revoke
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
