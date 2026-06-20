"use client";

import { useCallback, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { IssueCertificateDialog } from "../../../features/certificates/components/IssueCertificateDialog";
import { IssuedCertificateTable } from "../../../features/certificates/components/IssuedCertificateTable";
import { RevokeCertificateDialog } from "../../../features/certificates/components/RevokeCertificateDialog";
import type { certificateDtoSchema } from "../../../server/certificates/certificate.dto";

type CertificateDto = z.infer<typeof certificateDtoSchema>;

type AdminCertificatesClientProps = {
  initialCertificates: CertificateDto[];
  templates: Array<{ id: string; name: string }>;
  members: Array<{ id: string; label: string }>;
  defaultSource: { type: "course" | "learning_path" | "assessment"; id: string };
};

export function AdminCertificatesClient({
  initialCertificates,
  templates,
  members,
  defaultSource,
}: AdminCertificatesClientProps) {
  const [certificates, setCertificates] = useState(initialCertificates);
  const [issueOpen, setIssueOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<CertificateDto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await clientApi.get<{ data: CertificateDto[] }>(
        "/api/v1/certificates?limit=50",
      );
      setCertificates(response.data);
      setErrorMessage(null);
      setRequestId(null);
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setErrorMessage(caught.message);
        setRequestId(caught.requestId);
      }
    }
  }, []);

  return (
    <div className="space-y-4">
      <IssuedCertificateTable
        certificates={certificates}
        onIssue={() => {
          setIssueOpen(true);
        }}
        onRevoke={(certificate) => {
          setRevokeTarget(certificate);
        }}
      />
      {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
      {requestId ? <p className="text-xs text-neutral-500">Request ID: {requestId}</p> : null}
      <IssueCertificateDialog
        open={issueOpen}
        onClose={() => {
          setIssueOpen(false);
        }}
        onSuccess={() => void refresh()}
        templates={templates}
        members={members}
        defaultSource={defaultSource}
      />
      <RevokeCertificateDialog
        open={revokeTarget != null}
        certificate={revokeTarget}
        onClose={() => {
          setRevokeTarget(null);
        }}
        onSuccess={() => void refresh()}
      />
    </div>
  );
}
