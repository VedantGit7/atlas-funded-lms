"use client";

import { useRef, useState } from "react";
import { Info, X } from "lucide-react";
import { createDeletionRequest, formatApiError } from "../api";
import { useAccountTheme } from "../../account-settings/account-theme-context";

type AccountDeletionCardProps = {
  canRequestDeletion: boolean;
  initialPending: boolean;
  email: string | null;
};

export function AccountDeletionCard({
  canRequestDeletion,
  initialPending,
  email,
}: AccountDeletionCardProps) {
  const { classes } = useAccountTheme();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(initialPending);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);

  const canConfirmDelete = email ? confirmEmail === email : confirmEmail.length > 0;

  async function submitDeletionRequest() {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await createDeletionRequest({ confirm: true }, `deletion-self-${String(Date.now())}`);
      setPending(true);
      setConfirmOpen(false);
      setConfirmEmail("");
    } catch (error) {
      const formatted = formatApiError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--acct-danger-surface)] p-6">
        <div>
          <h3 className={classes.sectionDangerTitle}>Delete account</h3>
          <p className={`${classes.sectionDesc} text-[var(--acct-on-danger-container)]`}>
            Once you delete your account, there is no going back. Please be certain.
          </p>
          {pending ? (
            <p
              role="status"
              className={`${classes.helper} mt-2 font-medium text-[var(--acct-danger)]`}
            >
              A deletion request is pending review.
            </p>
          ) : null}
          {!canRequestDeletion ? (
            <p className={`${classes.helper} mt-2`}>
              You do not have permission to request deletion.
            </p>
          ) : null}
        </div>
        {canRequestDeletion && !pending ? (
          <button
            type="button"
            className={classes.dangerButton}
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            Delete your account
          </button>
        ) : null}
      </div>

      {message ? (
        <p role="alert" className={`${classes.errorBanner} m-6`}>
          {message}
          {requestId ? ` Request ID: ${requestId}` : ""}
        </p>
      ) : null}

      {confirmOpen ? (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${classes.modalScrim}`}
        >
          <div
            className={classes.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-deletion-title"
          >
            <div className="flex items-center justify-between border-b border-[var(--acct-border)] p-6">
              <h3 id="confirm-deletion-title" className={classes.sectionTitle}>
                Are you absolutely sure?
              </h3>
              <button
                type="button"
                className="text-[var(--acct-outline)] transition-colors hover:text-[var(--acct-on-surface)]"
                aria-label="Close dialog"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmEmail("");
                }}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-6">
              <div className={`${classes.errorBanner} mb-6 flex gap-3`}>
                <Info className="h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="text-sm">
                  Unexpected bad things will happen if you do not read this. This action cannot be
                  undone.
                </p>
              </div>
              <p className="mb-4 text-sm text-[var(--acct-on-surface)]">
                This will permanently delete your account and remove all associations with your
                data.
              </p>
              <div className="space-y-2">
                <label className={classes.label} htmlFor="confirm-email">
                  To confirm, type your email{" "}
                  <span className="font-bold text-[var(--acct-on-surface)]">
                    {email ?? "address"}
                  </span>{" "}
                  below.
                </label>
                <input
                  id="confirm-email"
                  type="text"
                  className={classes.field}
                  placeholder={email ?? "your@email.com"}
                  value={confirmEmail}
                  onChange={(event) => {
                    setConfirmEmail(event.target.value);
                  }}
                />
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  className={`${classes.dangerButton} w-full`}
                  disabled={!canConfirmDelete || busy}
                  onClick={() => void submitDeletionRequest()}
                >
                  {busy ? "Submitting…" : "Delete this account"}
                </button>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  ref={cancelRef}
                  type="button"
                  autoFocus
                  className={classes.outlineButton}
                  onClick={() => {
                    setConfirmOpen(false);
                    setConfirmEmail("");
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
