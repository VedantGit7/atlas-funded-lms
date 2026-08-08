"use client";

import { AlertTriangle, Check, Info, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import {
  refundPaymentTransaction,
  type PaymentTransactionDetail,
} from "./admin-payments-roster-api";
import { formatAmount, formatMoney } from "./payment-transaction-ui";

type RefundReason = "duplicate" | "fraudulent" | "customer_requested" | "other";

const REASONS: Array<{ value: RefundReason; label: string }> = [
  { value: "duplicate", label: "Duplicate payment" },
  { value: "fraudulent", label: "Fraudulent" },
  { value: "customer_requested", label: "Customer requested" },
  { value: "other", label: "Other" },
];

type Props = {
  open: boolean;
  detail: PaymentTransactionDetail;
  onClose: () => void;
  onRefunded: () => void;
};

export function AdminPaymentRefundModal({ open, detail, onClose, onRefunded }: Props) {
  const titleId = useId();
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState<RefundReason>("customer_requested");
  const [note, setNote] = useState("");
  const [revokeAccess, setRevokeAccess] = useState(false);
  const [notifyLearner, setNotifyLearner] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("full");
    setAmountInput(formatAmount(detail.refundableAmountCents));
    setReason("customer_requested");
    setNote("");
    setRevokeAccess(false);
    setNotifyLearner(true);
    setBusy(false);
    setError(null);
  }, [open, detail.refundableAmountCents, detail.id]);

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

  const refundableCents = detail.refundableAmountCents;
  const parsedPartialCents = Math.round(Number(amountInput.replace(/,/g, "")) * 100);
  const amountCents = mode === "full" ? refundableCents : parsedPartialCents;
  const amountValid =
    Number.isFinite(amountCents) && amountCents > 0 && amountCents <= refundableCents;
  const canSubmit = !busy && note.trim().length > 0 && amountValid;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await refundPaymentTransaction(detail.id, {
        mode,
        ...(mode === "partial" ? { amountCents } : {}),
        reason,
        note: note.trim(),
        revokeAccess,
        notifyLearner,
      });
      onRefunded();
      onClose();
    } catch (err) {
      const message =
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Refund failed.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-bg)_55%,#000)] backdrop-blur-[2px]"
        aria-label="Close refund dialog"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-lg flex-col overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl shadow-[0_0_24px_color-mix(in_srgb,var(--admin-danger)_8%,transparent)]"
      >
        <div
          className="absolute inset-x-0 top-0 z-10 h-1 bg-[var(--admin-danger)]"
          aria-hidden="true"
        />

        {busy ? (
          <div className="absolute inset-x-0 top-1 z-10 h-0.5 overflow-hidden bg-[var(--admin-surface-high)]">
            <div className="h-full w-1/3 animate-[shimmer_1.5s_infinite] bg-[var(--admin-primary)]" />
          </div>
        ) : null}

        {error ? (
          <div className="mt-1 flex items-start gap-3 border-b border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] px-6 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" />
            <div>
              <h3 className="text-lg font-semibold text-[var(--admin-danger)]">Refund failed</h3>
              <p className="mt-1 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                {error}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-1 flex items-start gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[color-mix(in_srgb,var(--admin-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)]">
            <AlertTriangle className="h-6 w-6 text-[var(--admin-danger)]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={titleId} className="text-xl font-semibold text-[var(--admin-on-surface)]">
                  {busy ? "Processing refund" : "Approve refund"}
                </h2>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  Review the details before confirming. This updates the LMS ledger.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                disabled={busy}
                className="shrink-0 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6 bg-[color-mix(in_srgb,var(--admin-bg)_50%,transparent)] p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Amount
              </span>
              <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                {formatMoney(amountValid ? amountCents : refundableCents, detail.currency)}
              </span>
            </div>
            <div className="space-y-1">
              <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Learner
              </span>
              <span className="truncate font-mono text-xs text-[var(--admin-on-surface)]">
                {detail.learner.name ?? detail.learner.email ?? "—"}
              </span>
            </div>
            <div className="col-span-2 space-y-1">
              <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Gateway
              </span>
              <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                {detail.gatewayKey ?? detail.gateway.provider ?? "—"}
              </span>
            </div>
          </div>

          <div className="flex border border-[var(--admin-border)] bg-[var(--admin-bg)] p-1">
            {(["full", "partial"] as const).map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                className={[
                  "flex-1 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors",
                  mode === value
                    ? "border border-[var(--admin-primary)] bg-[var(--admin-surface-variant)] text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
                onClick={() => {
                  setMode(value);
                  if (value === "full") {
                    setAmountInput(formatAmount(refundableCents));
                  }
                }}
              >
                {value}
              </button>
            ))}
          </div>

          <div>
            <label
              htmlFor="refund-amount"
              className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]"
            >
              Amount ({detail.currency.toUpperCase()})
            </label>
            <div className="relative">
              <input
                id="refund-amount"
                type="text"
                inputMode="decimal"
                disabled={busy || mode === "full"}
                value={amountInput}
                onChange={(event) => {
                  setAmountInput(event.target.value);
                }}
                className="w-full border-0 border-b border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 py-3 font-mono text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] disabled:opacity-60"
              />
              {mode === "full" ? (
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  Capped
                </span>
              ) : null}
            </div>
          </div>

          <div>
            <label
              htmlFor="refund-reason"
              className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]"
            >
              Reason
            </label>
            <select
              id="refund-reason"
              disabled={busy}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value as RefundReason);
              }}
              className="w-full appearance-none border-0 border-b border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 py-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] disabled:opacity-60"
            >
              {REASONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="refund-note"
              className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]"
            >
              Note <span className="text-[var(--admin-danger)]">*</span>
            </label>
            <textarea
              id="refund-note"
              rows={3}
              disabled={busy}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
              }}
              placeholder="Required explanation for the refund…"
              className="w-full resize-none border-0 border-b border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 py-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[color-mix(in_srgb,var(--admin-on-surface-variant)_50%,transparent)] focus:border-[var(--admin-primary)] disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-3">
            <CheckboxRow
              checked={revokeAccess}
              disabled={busy || !detail.product.courseId}
              label="Revoke course access"
              hint={detail.product.courseId ? undefined : "No linked course ID on this order"}
              onChange={setRevokeAccess}
            />
            <CheckboxRow
              checked={notifyLearner}
              disabled={busy}
              label="Notify the learner by email"
              hint="Queued as a ledger flag until outbound mail is wired"
              onChange={setNotifyLearner}
            />
          </div>

          <div className="flex items-start gap-3 border border-[color-mix(in_srgb,var(--admin-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] p-4">
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-danger)]">
              Recording a refund on the ledger is permanent for audit. Reverse the charge in your
              payment gateway separately if required — automated gateway refunds are not wired yet.
            </p>
          </div>

          {busy ? (
            <div className="flex items-start gap-2 border-l-2 border-[var(--admin-primary)] bg-[var(--admin-surface-high)] p-4">
              <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-[var(--admin-primary)]" />
              <div>
                <p className="text-sm text-[var(--admin-on-surface)]">
                  Recording refund on the ledger…
                </p>
                <p className="mt-1 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  Do not close this window.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-4 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6">
          <button
            type="button"
            disabled={busy}
            className="border border-[var(--admin-border)] px-6 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-variant)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            className="flex items-center gap-2 border border-[var(--admin-danger)] bg-[var(--admin-danger)] px-6 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-primary)] shadow-[0_0_15px_color-mix(in_srgb,var(--admin-danger)_30%,transparent)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void submit()}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : error ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Retry refund
              </>
            ) : (
              `Approve refund — ${formatMoney(
                amountValid ? amountCents : refundableCents,
                detail.currency,
              )}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckboxRow({
  checked,
  disabled,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  hint?: string | undefined;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={[
        "flex cursor-pointer items-start gap-3",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      <span
        className={[
          "relative mt-0.5 flex h-5 w-5 items-center justify-center border",
          checked
            ? "border-[var(--admin-primary)] bg-[var(--admin-primary)]"
            : "border-[var(--admin-border)] bg-[var(--admin-bg)]",
        ].join(" ")}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />
        {checked ? <Check className="h-3.5 w-3.5 text-[var(--admin-on-primary)]" /> : null}
      </span>
      <span>
        <span className="block text-sm text-[var(--admin-on-surface)]">{label}</span>
        {hint ? (
          <span className="mt-0.5 block font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}
