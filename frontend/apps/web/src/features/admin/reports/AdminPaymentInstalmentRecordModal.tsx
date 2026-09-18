"use client";

import { CheckSquare, Loader2, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  payPaymentInstalment,
  type PaymentInstalmentPlanItem,
  type PaymentInstalmentScheduleItem,
} from "./admin-payments-roster-api";

type PaymentMethod = "gateway" | "bank" | "cash" | "adjustment";

const METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "gateway", label: "Gateway charge" },
  { value: "bank", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "adjustment", label: "Adjustment" },
];

const GATEWAY_OPTIONS = [
  { value: "stripe", label: "Stripe" },
  { value: "razorpay", label: "Razorpay" },
  { value: "paypal", label: "PayPal" },
  { value: "manual", label: "Manual / other" },
];

type Props = {
  open: boolean;
  plan: PaymentInstalmentPlanItem;
  instalment: PaymentInstalmentScheduleItem;
  onClose: () => void;
  onRecorded: () => void;
};

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateInputToIso(value: string): string {
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

export function AdminPaymentInstalmentRecordModal({
  open,
  plan,
  instalment,
  onClose,
  onRecorded,
}: Props) {
  const titleId = useId();
  const [method, setMethod] = useState<PaymentMethod>("gateway");
  const [gatewayKey, setGatewayKey] = useState("razorpay");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayInputValue());
  const [sendReceipt, setSendReceipt] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMethod("gateway");
    setGatewayKey("razorpay");
    setReference("");
    setPaidOn(todayInputValue());
    setSendReceipt(true);
    setBusy(false);
    setError(null);
  }, [open, instalment.id]);

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

  const amountLabel = useMemo(
    () => formatMoney(instalment.amountCents, plan.currency),
    [instalment.amountCents, plan.currency],
  );

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await payPaymentInstalment(plan.id, {
        instalmentId: instalment.id,
        paymentMethod: method,
        gatewayKey: method === "gateway" ? gatewayKey : undefined,
        reference: reference.trim() || undefined,
        paidAt: dateInputToIso(paidOn),
        sendReceipt,
      });
      onRecorded();
      onClose();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to record payment.",
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
            Record Next Payment
          </h2>
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
          <div className="flex flex-col gap-2 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Instalment #{instalment.sequenceNo}
              </span>
              <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                {plan.learnerName ?? "Learner"}
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-[var(--admin-primary)]">
              {amountLabel}
            </div>
            <div className="text-sm text-[var(--admin-on-surface)]">{plan.productTitle}</div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Payment method
              </label>
              <Select
                value={method}
                onValueChange={(value) => {
                  setMethod(value as PaymentMethod);
                }}
                options={METHOD_OPTIONS}
                ariaLabel="Payment method"
                className="h-10 w-full"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Gateway
              </label>
              <Select
                value={gatewayKey}
                onValueChange={setGatewayKey}
                options={GATEWAY_OPTIONS}
                ariaLabel="Gateway"
                className="h-10 w-full"
                disabled={method !== "gateway"}
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Reference
              </label>
              <input
                className="h-10 w-full border border-transparent border-b-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs outline-none focus:border-[var(--admin-primary)]"
                placeholder="TXN-XXXX"
                value={reference}
                onChange={(event) => {
                  setReference(event.target.value);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Paid-on
              </label>
              <input
                type="date"
                className="h-10 w-full border border-transparent border-b-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs outline-none focus:border-[var(--admin-primary)]"
                value={paidOn}
                onChange={(event) => {
                  setPaidOn(event.target.value);
                }}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={sendReceipt}
              onChange={(event) => {
                setSendReceipt(event.target.checked);
              }}
              className="mt-0.5 h-4 w-4 accent-[var(--admin-primary)]"
            />
            <span className="text-sm text-[var(--admin-on-surface)]">
              Send receipt to learner
              <span className="mt-0.5 block text-xs text-[var(--admin-on-surface-variant)]">
                Preference is stored on the payment; email delivery is not automated yet.
              </span>
            </span>
          </label>

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
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded bg-[var(--admin-primary)] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)] disabled:opacity-50"
            disabled={busy || !paidOn}
            onClick={() => void submit()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckSquare className="h-4 w-4" aria-hidden="true" />
            )}
            Record {amountLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
