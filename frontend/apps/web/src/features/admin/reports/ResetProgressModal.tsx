"use client";

import { useEffect, useId, useState } from "react";
import { History, Loader2, TriangleAlert, X } from "lucide-react";
import { ghostButtonClassName } from "../../analytics/analytics-admin-shared";
import { inlineExpandClassName } from "../../studio/courses/admin-form-dropdown-shared";

export type ResetProgressModalProps = {
  open: boolean;
  learnerName: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: { clearAssessmentAttempts: boolean; reason: string }) => void;
};

export function ResetProgressModal({
  open,
  learnerName,
  busy,
  onClose,
  onConfirm,
}: ResetProgressModalProps) {
  const titleId = useId();
  const reasonId = useId();
  const [clearAttempts, setClearAttempts] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setClearAttempts(false);
      setReason("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onClose, open]);

  if (!open) return null;

  const canSubmit = reason.trim().length > 0 && !busy;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--admin-scrim)] p-4 md:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex w-full max-w-[600px] flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl ${inlineExpandClassName}`}
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-bg)_50%,var(--admin-surface))] px-6 py-5">
          <h2
            id={titleId}
            className="pr-4 text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]"
          >
            Reset progress for {learnerName}
          </h2>
          <button
            type="button"
            className="rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:opacity-50"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-8 px-6 py-6">
          <div className="flex items-start gap-4 border-l-4 border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] p-4">
            <TriangleAlert
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
              aria-hidden="true"
            />
            <p className="m-0 text-sm leading-relaxed text-[var(--admin-on-surface)]">
              All lesson completions, watch positions, and time-on-content for this enrolment will
              be cleared. Assessment attempts are kept unless you opt in below.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <label className="group flex cursor-pointer items-center gap-4">
              <span className="relative flex h-6 w-6 items-center justify-center border-2 border-[var(--admin-on-surface)] bg-[var(--admin-bg)] transition-colors group-hover:border-[var(--admin-warning)]">
                <input
                  type="checkbox"
                  className="peer absolute inset-0 cursor-pointer opacity-0"
                  checked={clearAttempts}
                  disabled={busy}
                  onChange={(event) => {
                    setClearAttempts(event.target.checked);
                  }}
                  aria-label="Also clear assessment attempts"
                />
                <span
                  className={`pointer-events-none text-sm font-bold text-[var(--admin-warning)] transition-opacity ${
                    clearAttempts ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden="true"
                >
                  ✓
                </span>
              </span>
              <span className="select-none font-mono text-xs font-medium tracking-[0.08em] text-[var(--admin-on-surface)] uppercase">
                Also clear assessment attempts
              </span>
            </label>

            <div className="flex flex-col gap-2">
              <label
                htmlFor={reasonId}
                className="font-mono text-[11px] font-medium tracking-[0.1em] text-[var(--admin-on-surface-variant)] uppercase"
              >
                Reason for reset
              </label>
              <textarea
                id={reasonId}
                rows={4}
                disabled={busy}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
                placeholder="Enter administrative reason for this action…"
                className="w-full resize-none border border-[var(--admin-on-surface)] bg-[var(--admin-bg)] p-4 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-outline)] transition-colors focus:border-[var(--admin-warning)] focus:ring-1 focus:ring-[var(--admin-warning)] focus:outline-none disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-bg)_30%,var(--admin-surface))] px-6 py-4">
          <button
            type="button"
            className={`${ghostButtonClassName} h-10 px-6 font-mono text-xs tracking-[0.08em] uppercase`}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            className="inline-flex h-10 items-center gap-2 bg-[var(--admin-warning)] px-8 font-mono text-xs font-bold tracking-[0.08em] text-[var(--admin-on-primary)] uppercase transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-warning)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-surface)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              onConfirm({
                clearAssessmentAttempts: clearAttempts,
                reason: reason.trim(),
              });
            }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <History className="h-4 w-4" aria-hidden="true" />
            )}
            Reset progress
          </button>
        </div>
      </div>
    </div>
  );
}
