"use client";

import { AlertTriangle, Ban, Loader2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import { voidPaymentInvoice, type PaymentInvoiceDetail } from "./admin-payments-roster-api";

type VoidReason = "issued_in_error" | "duplicate" | "amount_incorrect" | "order_refunded";

const REASONS: Array<{ value: VoidReason; label: string }> = [
  { value: "issued_in_error", label: "Issued in error" },
  { value: "duplicate", label: "Duplicate" },
  { value: "amount_incorrect", label: "Amount incorrect" },
  { value: "order_refunded", label: "Order refunded" },
];

type Props = {
  open: boolean;
  detail: PaymentInvoiceDetail;
  onClose: () => void;
  onVoided: () => void;
};

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function AdminPaymentInvoiceVoidModal({ open, detail, onClose, onVoided }: Props) {
  const titleId = useId();
  const [reason, setReason] = useState<VoidReason | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setBusy(false);
    setError(null);
  }, [open, detail.orderId]);

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

  const canSubmit = !busy && reason !== "";

  async function submit() {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await voidPaymentInvoice(detail.orderId, { reason });
      onVoided();
      onClose();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to void invoice.",
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
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
            <h2 id={titleId} className="text-lg font-semibold text-[var(--admin-on-surface)]">
              Void Invoice {detail.invoiceNumber}?
            </h2>
          </div>
          <button
            type="button"
            className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)] disabled:opacity-50"
            disabled={busy}
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-6 p-6">
          <div className="grid grid-cols-2 gap-4 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div>
              <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Learner
              </p>
              <p className="text-sm text-[var(--admin-on-surface)]">
                {detail.learnerName ?? detail.email ?? "—"}
              </p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Amount
              </p>
              <p className="font-mono text-xs text-[var(--admin-on-surface)]">
                {formatMoney(detail.amountCents, detail.currency)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Reason for voiding <span className="text-[var(--admin-danger)]">*</span>
            </label>
            <Select
              value={reason}
              onValueChange={(value) => {
                setReason(value as VoidReason);
              }}
              options={[
                { value: "", label: "Select a reason..." },
                ...REASONS.map((item) => ({ value: item.value, label: item.label })),
              ]}
              ariaLabel="Reason for voiding"
              className="h-10 w-full"
            />
          </div>

          <div className="flex gap-3 border border-[color-mix(in_srgb,var(--admin-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] p-4">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-danger)]">
              Voiding keeps the invoice number reserved for audit and cannot be reversed.
            </p>
          </div>

          {error ? (
            <div className="border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] px-3 py-2 font-mono text-xs text-[var(--admin-danger)]">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4">
          <button
            type="button"
            className="rounded border border-[var(--admin-border)] px-4 py-2 text-sm text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] disabled:opacity-50"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded border border-[var(--admin-danger)] bg-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] hover:opacity-90 disabled:opacity-50"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Ban className="h-4 w-4" aria-hidden="true" />
            )}
            Void invoice
          </button>
        </div>
      </div>
    </div>
  );
}
