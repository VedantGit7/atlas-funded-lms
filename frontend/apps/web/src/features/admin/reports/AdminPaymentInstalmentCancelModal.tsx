"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  cancelPaymentInstalmentPlan,
  type PaymentInstalmentCancelReason,
  type PaymentInstalmentPlanItem,
} from "./admin-payments-roster-api";

const REASONS: Array<{ value: PaymentInstalmentCancelReason; label: string }> = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "completed_goals", label: "Completed goals" },
  { value: "no_time", label: "No time to study" },
  { value: "learner_request", label: "Learner request" },
  { value: "admin_correction", label: "Admin correction" },
  { value: "other", label: "Other" },
];

type Props = {
  open: boolean;
  plan: PaymentInstalmentPlanItem;
  onClose: () => void;
  onCancelled: () => void;
};

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function AdminPaymentInstalmentCancelModal({ open, plan, onClose, onCancelled }: Props) {
  const titleId = useId();
  const [accessOption, setAccessOption] = useState<"keep" | "revoke">("keep");
  const [reason, setReason] = useState<PaymentInstalmentCancelReason | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAccessOption("keep");
    setReason("");
    setBusy(false);
    setError(null);
  }, [open, plan.id]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  async function submit() {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await cancelPaymentInstalmentPlan(plan.id, { reason, accessOption });
      onCancelled();
      onClose();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to cancel plan.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_55%,transparent)] p-4 backdrop-blur-sm"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-50 flex w-full max-w-lg flex-col border border-[var(--admin-border)] bg-[var(--admin-surface-high)] shadow-2xl"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-[var(--admin-on-surface)]">
            Cancel Plan
          </h2>
          <button
            type="button"
            className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
            disabled={busy}
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center justify-between border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <span className="text-sm text-[var(--admin-on-surface-variant)]">
              Remaining balance
            </span>
            <span className="font-mono text-sm text-[var(--admin-danger)]">
              {formatMoney(plan.remainingAmountCents, plan.currency)}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="access"
                checked={accessOption === "keep"}
                onChange={() => {
                  setAccessOption("keep");
                }}
                className="mt-1 accent-[var(--admin-primary)]"
              />
              <span>
                <span className="block text-sm text-[var(--admin-on-surface)]">
                  Keep course access
                </span>
                <span className="mt-1 block text-xs text-[var(--admin-on-surface-variant)]">
                  Access is left unchanged on cancel.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="access"
                checked={accessOption === "revoke"}
                onChange={() => {
                  setAccessOption("revoke");
                }}
                className="mt-1 accent-[var(--admin-primary)]"
              />
              <span>
                <span className="block text-sm text-[var(--admin-on-surface)]">
                  Flag revoke course access
                </span>
                <span className="mt-1 block text-xs text-[var(--admin-on-surface-variant)]">
                  Intent is recorded on the plan. Access revocation is not automated yet — follow up
                  in memberships if needed.
                </span>
              </span>
            </label>
          </div>

          <div>
            <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Reason for cancellation <span className="text-[var(--admin-danger)]">*</span>
            </label>
            <Select
              value={reason}
              onValueChange={(value) => {
                setReason(value as PaymentInstalmentCancelReason);
              }}
              options={[{ value: "", label: "Select a reason..." }, ...REASONS]}
              ariaLabel="Cancellation reason"
              className="h-10 w-full"
            />
          </div>

          <div className="flex items-start gap-3 border border-[color-mix(in_srgb,var(--admin-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]" />
            <p className="text-sm leading-relaxed text-[var(--admin-danger)]">
              Scheduled instalments will be voided. This action cannot be undone.
            </p>
          </div>

          {error ? (
            <p className="border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] p-3 font-mono text-xs text-[var(--admin-danger)]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4">
          <button
            type="button"
            className="px-4 py-2 text-sm text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
            disabled={busy}
            onClick={onClose}
          >
            Keep plan
          </button>
          <button
            type="button"
            className="rounded bg-[var(--admin-danger)] px-5 py-2 text-sm font-bold text-[var(--admin-on-primary)] disabled:opacity-50"
            disabled={busy || !reason}
            onClick={() => void submit()}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Cancelling…
              </span>
            ) : (
              "Cancel plan"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
