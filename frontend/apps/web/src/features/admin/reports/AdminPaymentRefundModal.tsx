"use client";

import { AlertTriangle, Check, Info, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import {
  refundPaymentTransaction,
  type PaymentTransactionDetail,
} from "./admin-payments-roster-api";
import { formatAmount, formatMoney } from "./payment-transaction-ui";
import {
  isRefundAmountValid,
  isRefundNoteValid,
  parseRefundAmountCents,
  revokeAccessBlockedReason,
} from "./payment-refund-rules";
import {
  refundOutcomeTitle,
  refundRequestIdentity,
  type RefundRequestIdentity,
  type RefundStatus,
} from "./refund-submission";

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
  const [refundMethod, setRefundMethod] = useState<"gateway" | "manual_adjustment">("gateway");
  const [manualReference, setManualReference] = useState("");
  const requestIdentity = useRef<RefundRequestIdentity | null>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{
    gatewayNote: string;
    amountCents: number;
    status: RefundStatus;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("full");
    setAmountInput(formatAmount(detail.refundableAmountCents));
    setReason("customer_requested");
    setNote("");
    setRevokeAccess(false);
    setRefundMethod("gateway");
    setManualReference("");
    setBusy(false);
    setError(null);
    setOutcome(null);
  }, [open, detail.refundableAmountCents, detail.id]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      // Dismissing an outcome any other way would skip the caller's reload and
      // leave a refunded payment looking unrefunded.
      if (event.key === "Escape" && !busy) {
        if (outcome) {
          onRefunded();
        }
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose, onRefunded, outcome]);

  if (!open) return null;

  const refundableCents = detail.refundableAmountCents;
  const amountCents = mode === "full" ? refundableCents : parseRefundAmountCents(amountInput);
  const amountValid = isRefundAmountValid(amountCents, refundableCents);
  const manualReferenceValid =
    refundMethod === "gateway" ||
    (manualReference.trim().length > 0 && manualReference.trim().length <= 200);
  const canSubmit = !busy && isRefundNoteValid(note) && amountValid && manualReferenceValid;

  const revokeBlockedReason = revokeAccessBlockedReason(detail);
  const canRevokeAccess = revokeBlockedReason === null && refundMethod === "gateway";

  /**
   * Closing the outcome is what notifies the caller.
   *
   * `onRefunded` triggers a reload and, on the refunds ledger, unmounts this
   * modal — so calling it at submit time would erase the gateway note before it
   * could be read.
   */
  function dismissOutcome() {
    onRefunded();
    onClose();
  }

  async function submit() {
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const body = {
        mode,
        refundMethod,
        ...(refundMethod === "manual_adjustment"
          ? { manualReference: manualReference.trim() }
          : {}),
        ...(mode === "partial" ? { amountCents } : {}),
        reason,
        note: note.trim(),
        // Never send a revoke the server would silently skip.
        revokeAccess: canRevokeAccess && revokeAccess,
        notifyLearner: false,
      };
      requestIdentity.current = refundRequestIdentity(requestIdentity.current, {
        orderId: detail.id,
        ...body,
      });
      const response = await refundPaymentTransaction(detail.id, {
        ...body,
        refundRequestId: requestIdentity.current.refundRequestId,
      });
      if (["succeeded", "manual_adjustment", "failed"].includes(response.data.refund.status))
        requestIdentity.current = null;
      // `onRefunded` unmounts this modal at one call site, so the outcome is
      // shown first and the caller is told once the operator dismisses it.
      setOutcome({
        gatewayNote: response.data.gatewayNote,
        amountCents: response.data.refund.amountCents,
        status: response.data.refund.status,
      });
    } catch (err) {
      const message =
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not confirm the request. Retry with the same details to check it safely.";
      setError(message);
    } finally {
      submitting.current = false;
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
          if (busy) return;
          if (outcome) {
            onRefunded();
          }
          onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-y-auto border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl shadow-[0_0_24px_color-mix(in_srgb,var(--admin-danger)_8%,transparent)]"
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
              <h3 className="text-lg font-semibold text-[var(--admin-danger)]">
                Request could not be confirmed
              </h3>
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
                  {outcome
                    ? refundOutcomeTitle(outcome.status)
                    : busy
                      ? "Submitting request"
                      : "Review refund"}
                </h2>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  {outcome
                    ? "Read the gateway status below before closing."
                    : "Choose a gateway refund or an explicit manual ledger adjustment."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                disabled={busy}
                className="shrink-0 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
                onClick={() => {
                  if (outcome) {
                    dismissOutcome();
                    return;
                  }
                  onClose();
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {outcome ? (
          <>
            <div className="space-y-4 bg-[color-mix(in_srgb,var(--admin-bg)_50%,transparent)] p-6">
              <div className="flex items-start gap-3 border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
                <Info
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    {formatMoney(outcome.amountCents, detail.currency)} —{" "}
                    {refundOutcomeTitle(outcome.status)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    {outcome.gatewayNote}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6">
              <button
                type="button"
                className="border border-[var(--admin-border)] px-6 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-variant)]"
                onClick={dismissOutcome}
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-6 bg-[color-mix(in_srgb,var(--admin-bg)_50%,transparent)] p-6">
              <div className="space-y-2">
                <label
                  htmlFor={`${titleId}-method`}
                  className="block text-sm text-[var(--admin-on-surface)]"
                >
                  Refund method
                </label>
                <select
                  id={`${titleId}-method`}
                  className="w-full border border-[var(--admin-border)] bg-[var(--admin-bg)] p-2 text-sm text-[var(--admin-on-surface)]"
                  disabled={busy}
                  value={refundMethod}
                  onChange={(event) => {
                    setRefundMethod(event.target.value as "gateway" | "manual_adjustment");
                  }}
                >
                  <option value="gateway">Request gateway refund</option>
                  <option value="manual_adjustment">
                    Manual ledger adjustment — no money sent
                  </option>
                </select>
                {refundMethod === "manual_adjustment" ? (
                  <>
                    <label
                      htmlFor={`${titleId}-reference`}
                      className="block text-sm text-[var(--admin-on-surface)]"
                    >
                      Manual adjustment reference (required)
                    </label>
                    <input
                      id={`${titleId}-reference`}
                      className="w-full border border-[var(--admin-border)] bg-[var(--admin-bg)] p-2 text-sm text-[var(--admin-on-surface)]"
                      disabled={busy}
                      value={manualReference}
                      maxLength={200}
                      onChange={(event) => {
                        setManualReference(event.target.value);
                      }}
                    />
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      Records an adjustment only. No money is sent and course access is unchanged.
                    </p>
                  </>
                ) : null}
              </div>
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
                  checked={canRevokeAccess && revokeAccess}
                  disabled={busy || !canRevokeAccess}
                  label="Revoke course access after gateway confirmation"
                  hint={
                    revokeBlockedReason ??
                    (refundMethod === "manual_adjustment"
                      ? "Manual adjustments do not revoke course access."
                      : "Access remains active until the gateway confirms the refund.")
                  }
                  onChange={setRevokeAccess}
                />
                <CheckboxRow
                  checked={false}
                  disabled
                  label="Learner email unavailable"
                  hint="No notification will be sent or queued."
                  onChange={() => {}}
                />
              </div>

              <div className="flex items-start gap-3 border border-[color-mix(in_srgb,var(--admin-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] p-4">
                <Info
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
                  aria-hidden="true"
                />
                <p className="text-sm text-[var(--admin-danger)]">
                  Gateway refunds remain pending until the provider confirms them. Manual
                  adjustments only update the ledger and send no money.
                </p>
              </div>

              {busy ? (
                <div className="flex items-start gap-2 border-l-2 border-[var(--admin-primary)] bg-[var(--admin-surface-high)] p-4">
                  <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-[var(--admin-primary)]" />
                  <div>
                    <p className="text-sm text-[var(--admin-on-surface)]">Submitting request…</p>
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
                className="flex items-center gap-2 border border-[var(--admin-danger)] bg-[var(--admin-danger)] px-6 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-danger)] shadow-[0_0_15px_color-mix(in_srgb,var(--admin-danger)_30%,transparent)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
                  `${refundMethod === "gateway" ? "Request refund" : "Record adjustment"} — ${formatMoney(
                    amountValid ? amountCents : refundableCents,
                    detail.currency,
                  )}`
                )}
              </button>
            </div>
          </>
        )}
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
