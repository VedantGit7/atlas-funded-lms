"use client";

import { useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { certificateDtoSchema } from "../../../server/certificates/certificate.dto";

type CertificateDto = z.infer<typeof certificateDtoSchema>;

type RevokeCertificateDialogProps = {
  open: boolean;
  certificate: CertificateDto | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function RevokeCertificateDialog({
  open,
  certificate,
  onClose,
  onSuccess,
}: RevokeCertificateDialogProps) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  if (!open || !certificate) return null;

  async function submit() {
    if (!certificate) return;
    if (!confirm || reason.trim().length === 0) {
      setMessage("A reason and explicit confirmation are required.");
      return;
    }

    setMessage(null);
    setRequestId(null);

    try {
      await clientApi.post(
        `/api/v1/certificates/${certificate.id}/revoke`,
        { reason: reason.trim(), confirm: true },
        "revoke-certificate",
      );
      onSuccess();
      onClose();
      setReason("");
      setConfirm(false);
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setMessage(caught.message);
        setRequestId(caught.requestId);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Revoke certificate</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Revoke credential <span className="font-mono">{certificate.credentialId}</span>?
        </p>
        <label className="mt-4 block text-sm">
          Reason
          <textarea
            className="mt-1 w-full rounded border px-3 py-2"
            rows={4}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </label>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(event) => {
              setConfirm(event.target.checked);
            }}
          />
          I confirm this revocation is intentional.
        </label>
        {message ? <p className="mt-4 text-sm text-red-700">{message}</p> : null}
        {requestId ? <p className="text-xs text-neutral-500">Request ID: {requestId}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-md px-3 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-red-700 px-3 py-2 text-sm text-white"
            onClick={() => void submit()}
          >
            Revoke
          </button>
        </div>
      </div>
    </div>
  );
}
