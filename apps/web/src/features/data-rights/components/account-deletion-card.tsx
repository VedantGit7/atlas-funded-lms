"use client";

import { useRef, useState } from "react";
import { createDeletionRequest, formatApiError } from "../api";

type AccountDeletionCardProps = {
  canRequestDeletion: boolean;
  initialPending: boolean;
};

export function AccountDeletionCard({
  canRequestDeletion,
  initialPending,
}: AccountDeletionCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(initialPending);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  async function submitDeletionRequest() {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await createDeletionRequest({ confirm: true }, `deletion-self-${String(Date.now())}`);
      setPending(true);
      setConfirmOpen(false);
      setMessage("Your account deletion request has been submitted.");
    } catch (error) {
      const formatted = formatApiError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded border p-4" aria-labelledby="account-deletion-heading">
      <h2 id="account-deletion-heading" className="text-lg font-semibold">
        Account deletion
      </h2>
      <p className="text-sm text-neutral-700">
        Request deletion of your account data. A tenant administrator must approve processing.
      </p>
      {pending ? (
        <p className="text-sm" role="status">
          A deletion request is pending review.
        </p>
      ) : null}
      {message ? (
        <p className="text-sm" role="alert">
          {message}
          {requestId ? ` Request ID: ${requestId}` : ""}
        </p>
      ) : null}
      {canRequestDeletion && !pending ? (
        <button
          type="button"
          onClick={() => {
            setConfirmOpen(true);
          }}
        >
          Request account deletion
        </button>
      ) : null}
      {!canRequestDeletion ? (
        <p className="text-sm text-neutral-600">You do not have permission to request deletion.</p>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md space-y-4 rounded bg-white p-6 shadow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-deletion-title"
          >
            <h3 id="confirm-deletion-title">Request account deletion?</h3>
            <p>
              This files a deletion request for your membership. Processing is irreversible once an
              administrator approves it.
            </p>
            <div className="flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                autoFocus
                onClick={() => {
                  setConfirmOpen(false);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="button" onClick={() => void submitDeletionRequest()} disabled={busy}>
                {busy ? "Submitting…" : "Confirm request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
