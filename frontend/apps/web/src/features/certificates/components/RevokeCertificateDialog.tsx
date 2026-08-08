"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { certificateDtoSchema } from "@atlas/contracts/certificates/certificate.dto";
import {
  dangerButtonClassName,
  errorBannerClassName,
  fieldClassName,
  labelClassName,
  outlineButtonClassName,
} from "./certificate-template-admin-shared";

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
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [onClose, open]);

  if (!open || !certificate) return null;

  async function submit() {
    if (!certificate) return;
    if (!confirm || reason.trim().length === 0) {
      setMessage("A reason and explicit confirmation are required.");
      return;
    }

    setMessage(null);
    setRequestId(null);
    setBusy(true);

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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-theme fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--admin-danger)]/30 bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-center gap-3 border-b border-[var(--admin-danger)]/20 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-6 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_18%,transparent)]">
            <TriangleAlert className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold text-[var(--admin-on-surface)]">
              Revoke certificate
            </h2>
            <p className="truncate font-mono text-xs text-[var(--admin-on-surface-variant)]">
              {certificate.credentialId}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            This marks the credential as invalid everywhere it is checked, including the public
            verification page. This cannot be undone.
          </p>

          <label className="flex flex-col gap-1.5">
            <span className={labelClassName}>Reason for revocation</span>
            <textarea
              className={`${fieldClassName} min-h-24 resize-none`}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
              placeholder="e.g. Certificate issued in error to the wrong learner..."
            />
          </label>

          <label className="flex items-start gap-2.5 text-sm text-[var(--admin-on-surface)]">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(event) => {
                setConfirm(event.target.checked);
              }}
              className="mt-0.5 h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-danger)] focus:ring-[var(--admin-danger)]"
            />
            I understand this revocation is permanent and intentional.
          </label>

          {message ? (
            <div className={errorBannerClassName}>
              <p>{message}</p>
              {requestId ? <p className="mt-1 text-xs opacity-70">Request ID: {requestId}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] px-6 py-4">
          <button type="button" className={outlineButtonClassName} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={dangerButtonClassName}
            disabled={busy || !confirm || reason.trim().length === 0}
            onClick={() => void submit()}
          >
            {busy ? "Revoking…" : "Revoke permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
