"use client";

import { PauseCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import type { certificateDtoSchema } from "@atlas/contracts/certificates/certificate.dto";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { RevokeCertificateDialog } from "./RevokeCertificateDialog";
import {
  dangerOutlineButtonClassName,
  errorBannerClassName,
  outlineButtonClassName,
} from "./certificate-template-admin-shared";

type CertificateDto = z.infer<typeof certificateDtoSchema>;

export function CertificateDetailActions({ certificate }: { certificate: CertificateDto }) {
  const router = useRouter();
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [busy, setBusy] = useState<"suspend" | "reissue" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "suspend" | "reissue") {
    setBusy(action);
    setError(null);
    try {
      await clientApi.post(
        `/api/v1/certificates/${certificate.id}/${action}`,
        {},
        `${action}-certificate`,
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : `Unable to ${action} certificate.`,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <div className={errorBannerClassName}>{error}</div> : null}
      <div className="flex flex-wrap gap-3">
        {certificate.status === "issued" ? (
          <>
            <button
              type="button"
              className={outlineButtonClassName}
              disabled={busy != null}
              onClick={() => void run("suspend")}
            >
              <PauseCircle className="h-4 w-4" aria-hidden="true" />
              {busy === "suspend" ? "Suspending…" : "Suspend"}
            </button>
            <button
              type="button"
              className={dangerOutlineButtonClassName}
              disabled={busy != null}
              onClick={() => {
                setRevokeOpen(true);
              }}
            >
              Revoke
            </button>
          </>
        ) : (
          <button
            type="button"
            className={outlineButtonClassName}
            disabled={busy != null}
            onClick={() => void run("reissue")}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {busy === "reissue" ? "Re-issuing…" : "Re-issue certificate"}
          </button>
        )}
      </div>
      <RevokeCertificateDialog
        open={revokeOpen}
        certificate={certificate}
        onClose={() => {
          setRevokeOpen(false);
        }}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
