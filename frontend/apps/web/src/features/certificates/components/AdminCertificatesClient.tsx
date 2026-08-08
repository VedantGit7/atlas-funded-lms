"use client";

import { useCallback, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { CertificateDetailPanel } from "../../../features/certificates/components/CertificateDetailPanel";
import { errorBannerClassName } from "../../../features/certificates/components/certificate-template-admin-shared";
import { IssueCertificateDialog } from "../../../features/certificates/components/IssueCertificateDialog";
import { IssuedCertificateTable } from "../../../features/certificates/components/IssuedCertificateTable";
import { RevokeCertificateDialog } from "../../../features/certificates/components/RevokeCertificateDialog";
import type { certificateDtoSchema } from "@atlas/contracts/certificates/certificate.dto";

type CertificateDto = z.infer<typeof certificateDtoSchema>;

type AdminCertificatesClientProps = {
  initialCertificates: CertificateDto[];
  templates: Array<{ id: string; name: string }>;
  members: Array<{ id: string; label: string }>;
  sourceOptions: Array<{
    type: "course" | "learning_path" | "assessment";
    id: string;
    label: string;
  }>;
  defaultSource: { type: "course" | "learning_path" | "assessment"; id: string };
};

export function AdminCertificatesClient({
  initialCertificates,
  templates,
  members,
  sourceOptions,
  defaultSource,
}: AdminCertificatesClientProps) {
  const [certificates, setCertificates] = useState(initialCertificates);
  const [issueOpen, setIssueOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<CertificateDto | null>(null);
  const [selected, setSelected] = useState<CertificateDto | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await clientApi.get<{ data: CertificateDto[] }>(
        "/api/v1/certificates?limit=50",
      );
      setCertificates(response.data);
      setSelected((current) =>
        current ? (response.data.find((item) => item.id === current.id) ?? null) : null,
      );
      setErrorMessage(null);
      setRequestId(null);
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setErrorMessage(caught.message);
        setRequestId(caught.requestId);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {errorMessage ? (
        <div className={errorBannerClassName}>
          <p>{errorMessage}</p>
          {requestId ? <p className="mt-1 text-xs opacity-70">Request ID: {requestId}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row">
        <IssuedCertificateTable
          certificates={certificates}
          loading={refreshing && certificates.length === 0}
          selectedId={selected?.id ?? null}
          onIssue={() => {
            setIssueOpen(true);
          }}
          onRevoke={(certificate) => {
            setRevokeTarget(certificate);
          }}
          onSelect={(certificate) => {
            setSelected(certificate);
          }}
        />
        {selected ? (
          <CertificateDetailPanel
            certificate={selected}
            onClose={() => {
              setSelected(null);
            }}
            onRevoke={(certificate) => {
              setRevokeTarget(certificate);
            }}
          />
        ) : null}
      </div>

      <IssueCertificateDialog
        open={issueOpen}
        onClose={() => {
          setIssueOpen(false);
        }}
        onSuccess={() => {
          void refresh();
        }}
        templates={templates}
        members={members}
        sourceOptions={sourceOptions}
        defaultSource={defaultSource}
      />
      <RevokeCertificateDialog
        open={revokeTarget != null}
        certificate={revokeTarget}
        onClose={() => {
          setRevokeTarget(null);
        }}
        onSuccess={() => {
          void refresh();
        }}
      />
    </div>
  );
}
