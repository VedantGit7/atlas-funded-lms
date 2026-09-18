"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Info,
  Loader2,
  RotateCcw,
  SearchX,
  Undo2,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  managePageDescClassName,
  managePageTitleClassName,
  manageDangerButtonClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import {
  fetchPaymentTransactionDetail,
  refundPaymentTransaction,
  type PaymentTransactionDetail,
} from "./admin-payments-roster-api";
import {
  formatAmount,
  ordersEmptyPanelClassName,
  ordersFieldClassName,
  ordersNoteClassName,
} from "./payment-orders-shared";
// The input holds a bare number the operator edits and this file re-parses, so
// it cannot use the currency-formatted display helper above.
import { formatAmount as formatAmountInput } from "./payment-transaction-ui";
import {
  isRefundAmountValid,
  isRefundNoteValid,
  isRefundable,
  parseRefundAmountCents,
  REFUND_NOTE_MAX,
  revokeAccessBlockedReason,
} from "./payment-refund-rules";

const ORDERS_HREF = "/admin/reports/payments/orders";

const REFUND_REASONS = [
  { value: "customer_requested", label: "Customer requested" },
  { value: "duplicate", label: "Duplicate payment" },
  { value: "fraudulent", label: "Fraudulent" },
  { value: "other", label: "Other" },
] as const;

type RefundReason = (typeof REFUND_REASONS)[number]["value"];

const panelClassName = "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]";
const panelHeaderClassName =
  "border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3";
const labelClassName = "mb-1 block text-xs font-semibold text-[var(--admin-on-surface-variant)]";
const helpClassName = "mt-1 text-xs text-[var(--admin-on-surface-variant)]";

/**
 * `/admin/reports/payments/orders/[orderId]/refund`.
 *
 * Refunding is a Transactions capability reached from an Orders URL, and the
 * page is built that way deliberately: the refund endpoint needs the product
 * and gateway detail that the raw ledger row does not carry, so this screen
 * loads the transaction for the same id and submits to
 * `POST /reports/payments/transactions/[orderId]/refund`.
 *
 * Every rule here is the endpoint's, not this screen's invention — the
 * refundable balance, the required note, the reason vocabulary. Re-deriving
 * them would let the form accept something the server rejects, or worse, look
 * like it accepted something it did not.
 */
export function AdminPaymentOrderRefundPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const fieldId = useId();

  const [detail, setDetail] = useState<PaymentTransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState<RefundReason>("customer_requested");
  const [note, setNote] = useState("");
  const [revokeAccess, setRevokeAccess] = useState(false);
  const [notifyLearner, setNotifyLearner] = useState(true);
  const [touched, setTouched] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gatewayNote, setGatewayNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setLoadError(null);
    try {
      const response = await fetchPaymentTransactionDetail(orderId);
      setDetail(response.data);
      setAmountInput(formatAmountInput(response.data.refundableAmountCents));
    } catch (caught) {
      if (caught instanceof ClientApiError && caught.status === 404) {
        setNotFound(true);
      } else {
        setLoadError(
          caught instanceof ClientApiError ? caught.message : "Could not load this payment.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const breadcrumb = (
    <nav aria-label="Breadcrumb" className="font-data flex items-center gap-1.5 text-xs">
      <Link
        href={ORDERS_HREF}
        className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
      >
        Orders
      </Link>
      <ChevronRight className="h-3 w-3 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
      <Link
        href={`${ORDERS_HREF}/${orderId}`}
        className="max-w-[16rem] truncate text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
      >
        {orderId}
      </Link>
      <ChevronRight className="h-3 w-3 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
      <span className="font-semibold text-[var(--admin-on-surface)]">Refund</span>
    </nav>
  );

  if (loading) return <RefundSkeleton />;

  if (notFound) {
    return (
      <div className="space-y-5">
        {breadcrumb}
        <div className={ordersEmptyPanelClassName}>
          <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
            <SearchX className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-bold text-[var(--admin-on-surface)]">No payment to refund</h1>
          {/* An order can exist as a ledger row without a settled payment
              behind it, so this is not the same as "no such order". */}
          <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            No transaction was found for this order. A refund needs a payment that actually settled
            — a pending or failed order has nothing to reverse.
          </p>
          <Link
            href={`${ORDERS_HREF}/${orderId}`}
            className={`${managePrimaryButtonClassName} mt-6`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to the order
          </Link>
        </div>
      </div>
    );
  }

  if (loadError !== null || detail === null) {
    return (
      <div className="space-y-4">
        {breadcrumb}
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2 text-sm font-medium text-[var(--admin-danger)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {loadError ?? "Could not load this payment."}
        </p>
        <button
          type="button"
          className={manageSecondaryButtonClassName}
          onClick={() => {
            void load();
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  const refundableCents = detail.refundableAmountCents;
  const refundable = isRefundable(detail);

  if (!refundable) {
    return (
      <div className="space-y-5">
        {breadcrumb}
        <div className={ordersEmptyPanelClassName}>
          <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
            <Undo2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-bold text-[var(--admin-on-surface)]">
            Nothing left to refund
          </h1>
          {/* The same condition the endpoint enforces, said before the operator
              fills in a form the server would reject. */}
          <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            {detail.refundedAmountCents > 0
              ? `This payment has already been refunded in full — ${formatAmount(detail.refundedAmountCents, detail.currency)} of ${formatAmount(detail.amountCents, detail.currency)}.`
              : "This payment has no refundable balance. Only a settled payment can be reversed."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={`${ORDERS_HREF}/${orderId}`} className={manageSecondaryButtonClassName}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to the order
            </Link>
            <Link
              href={`/admin/reports/payments/transactions/${orderId}`}
              className={managePrimaryButtonClassName}
            >
              View the payment
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const amountCents = mode === "full" ? refundableCents : parseRefundAmountCents(amountInput);
  const amountValid = isRefundAmountValid(amountCents, refundableCents);
  const amountTooLarge = Number.isFinite(amountCents) && amountCents > refundableCents;

  const noteValid = isRefundNoteValid(note);
  const canSubmit = amountValid && noteValid && !saving;

  const revokeBlockedReason = revokeAccessBlockedReason(detail);
  const canRevokeAccess = revokeBlockedReason === null;

  async function submit() {
    if (!canSubmit || detail === null) return;
    setSaving(true);
    setError(null);
    try {
      const response = await refundPaymentTransaction(detail.id, {
        mode,
        ...(mode === "partial" ? { amountCents } : {}),
        reason,
        note: note.trim(),
        revokeAccess: canRevokeAccess && revokeAccess,
        notifyLearner,
      });
      // The gateway note is the server telling us whether money actually moved.
      // It is not a detail to swallow behind a success toast.
      setGatewayNote(response.data.gatewayNote);
      setConfirming(false);
      setSaving(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not record the refund.");
      setConfirming(false);
      setSaving(false);
    }
  }

  if (gatewayNote !== null) {
    return (
      <div className="space-y-5">
        {breadcrumb}
        <div className={ordersEmptyPanelClassName}>
          <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]">
            <Undo2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-bold text-[var(--admin-on-surface)]">Refund recorded</h1>
          <p className="mt-2 max-w-lg text-sm text-[var(--admin-on-surface-variant)]">
            {/* Verbatim from the server. It usually says the gateway reverse
                still has to be done by hand, which is the single most important
                thing an operator can be told here. */}
            {gatewayNote}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={`${ORDERS_HREF}/${orderId}`} className={manageSecondaryButtonClassName}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to the order
            </Link>
            <Link
              href={`/admin/reports/payments/transactions/${orderId}`}
              className={managePrimaryButtonClassName}
            >
              View the payment
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {breadcrumb}

      <div>
        <h1 className={managePageTitleClassName}>Refund this payment</h1>
        <p className={managePageDescClassName}>
          Reverses part or all of a settled payment on the ledger.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <div className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_32%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                A refund cannot be undone here
              </p>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                It is written to the ledger immediately. Depending on the gateway, the matching
                reverse may still need doing by hand — the confirmation will say which.
              </p>
            </div>
          </div>

          <form
            className={`${panelClassName} p-6`}
            onSubmit={(event) => {
              event.preventDefault();
              setTouched(true);
              if (!canSubmit) return;
              setConfirming(true);
            }}
            noValidate
          >
            {error ? (
              <p
                role="alert"
                className="mb-5 flex items-start gap-2 rounded-lg border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2 text-sm font-medium text-[var(--admin-danger)]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            ) : null}

            <div className="space-y-5">
              <div>
                <span className={labelClassName}>Amount</span>
                <div className="inline-flex overflow-hidden rounded-lg border border-[var(--admin-outline)]">
                  {(["full", "partial"] as const).map((value, index) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={value === mode}
                      disabled={saving}
                      className={[
                        "px-3 py-2 text-sm font-medium capitalize transition-colors",
                        index > 0 ? "border-l border-[var(--admin-outline)]" : "",
                        value === mode
                          ? "bg-[var(--admin-primary)] font-semibold text-[var(--admin-on-primary)]"
                          : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                      ].join(" ")}
                      onClick={() => {
                        setMode(value);
                        if (value === "full") {
                          setAmountInput(formatAmountInput(refundableCents));
                        }
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>

                {mode === "partial" ? (
                  <div className="mt-3">
                    <label className="sr-only" htmlFor={`${fieldId}-amount`}>
                      Refund amount
                    </label>
                    <input
                      id={`${fieldId}-amount`}
                      className={[
                        ordersFieldClassName,
                        "font-data w-full max-w-xs text-right",
                        touched && !amountValid
                          ? "border-[var(--admin-danger)] focus:border-[var(--admin-danger)] focus:ring-[var(--admin-danger)]/25"
                          : "",
                      ].join(" ")}
                      inputMode="decimal"
                      value={amountInput}
                      disabled={saving}
                      aria-invalid={touched && !amountValid}
                      onChange={(event) => {
                        setAmountInput(event.target.value);
                      }}
                    />
                    {touched && !amountValid ? (
                      <p
                        role="alert"
                        className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--admin-danger)]"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {amountTooLarge
                          ? `More than the refundable balance of ${formatAmount(refundableCents, detail.currency)}.`
                          : "Enter an amount greater than zero."}
                      </p>
                    ) : (
                      <p className={helpClassName}>
                        Up to {formatAmount(refundableCents, detail.currency)} remains refundable.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className={helpClassName}>
                    Refunds the full remaining balance of{" "}
                    <span className="font-data">
                      {formatAmount(refundableCents, detail.currency)}
                    </span>
                    .
                  </p>
                )}
              </div>

              <div>
                <span className={labelClassName}>Reason</span>
                <div className="flex flex-wrap gap-2">
                  {REFUND_REASONS.map((entry) => (
                    <button
                      key={entry.value}
                      type="button"
                      role="radio"
                      aria-checked={entry.value === reason}
                      disabled={saving}
                      className={[
                        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        entry.value === reason
                          ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]"
                          : "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                      ].join(" ")}
                      onClick={() => {
                        setReason(entry.value);
                      }}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClassName} htmlFor={`${fieldId}-note`}>
                  Note <span className="text-[var(--admin-danger)]">*</span>
                </label>
                <textarea
                  id={`${fieldId}-note`}
                  className={[
                    ordersFieldClassName,
                    "w-full resize-y",
                    touched && !noteValid
                      ? "border-[var(--admin-danger)] focus:border-[var(--admin-danger)] focus:ring-[var(--admin-danger)]/25"
                      : "",
                  ].join(" ")}
                  rows={3}
                  maxLength={REFUND_NOTE_MAX}
                  placeholder="Why this payment is being refunded."
                  value={note}
                  disabled={saving}
                  aria-invalid={touched && !noteValid}
                  onChange={(event) => {
                    setNote(event.target.value);
                  }}
                />
                {touched && !noteValid ? (
                  <p
                    role="alert"
                    className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--admin-danger)]"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />A note is
                    required — it is stored on the refund record.
                  </p>
                ) : (
                  <p className={helpClassName}>
                    Required. Stored on the refund and shown wherever it is reviewed.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
                <label
                  className={`flex items-start gap-3 ${canRevokeAccess ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[var(--admin-primary)]"
                    checked={canRevokeAccess && revokeAccess}
                    disabled={saving || !canRevokeAccess}
                    onChange={(event) => {
                      setRevokeAccess(event.target.checked);
                    }}
                  />
                  <span>
                    <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                      Revoke course access
                    </span>
                    <span className="block text-xs text-[var(--admin-on-surface-variant)]">
                      {/* Disabled rather than silently ignored: the service only
                          revokes when the payment carries both a course and a
                          membership. */}
                      {revokeBlockedReason ??
                        "Removes the learner's enrolment in the course this payment bought."}
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[var(--admin-primary)]"
                    checked={notifyLearner}
                    disabled={saving}
                    onChange={(event) => {
                      setNotifyLearner(event.target.checked);
                    }}
                  />
                  <span>
                    <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                      Notify the learner
                    </span>
                    <span className="block text-xs text-[var(--admin-on-surface-variant)]">
                      Queues a refund notification.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-[var(--admin-border)] pt-5 sm:flex-row sm:justify-end">
              <Link href={`${ORDERS_HREF}/${orderId}`} className={manageSecondaryButtonClassName}>
                Cancel
              </Link>
              <button type="submit" className={manageDangerButtonClassName} disabled={!canSubmit}>
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                Review refund
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-5 lg:col-span-4">
          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">This payment</h2>
            </div>
            <dl className="divide-y divide-[var(--admin-border)]">
              {[
                ["Paid", formatAmount(detail.amountCents, detail.currency)],
                [
                  "Already refunded",
                  detail.refundedAmountCents > 0
                    ? formatAmount(detail.refundedAmountCents, detail.currency)
                    : "None",
                ],
                ["Refundable", formatAmount(refundableCents, detail.currency)],
                ["Learner", detail.learner.name ?? detail.learner.email ?? "—"],
                ["Product", detail.product.title ?? "—"],
                ["Gateway", detail.gatewayKey ?? detail.gateway.provider ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 px-4 py-2.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    {label}
                  </dt>
                  <dd className="font-data min-w-0 truncate text-xs text-[var(--admin-on-surface)]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <div className={ordersNoteClassName}>
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Refunds belong to the payment, not the raw order row, so this reads its detail from
              Transactions — which is also where every refund on this payment is listed.
            </p>
          </div>
        </div>
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cancel"
            tabIndex={-1}
            className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
            onClick={() => {
              if (!saving) setConfirming(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${fieldId}-confirm`}
            className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
          >
            <header className="border-b border-[var(--admin-border)] px-6 py-5">
              <h2
                id={`${fieldId}-confirm`}
                className="text-base font-bold text-[var(--admin-on-surface)]"
              >
                Refund {formatAmount(amountCents, detail.currency)}?
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                This is written to the ledger immediately and cannot be undone here.
              </p>
            </header>

            <dl className="divide-y divide-[var(--admin-border)] px-6 py-2">
              {[
                ["Amount", formatAmount(amountCents, detail.currency)],
                ["Reason", REFUND_REASONS.find((r) => r.value === reason)?.label ?? reason],
                ["Learner", detail.learner.name ?? detail.learner.email ?? "—"],
                ["Course access", canRevokeAccess && revokeAccess ? "Revoked" : "Left in place"],
                ["Learner notified", notifyLearner ? "Yes" : "No"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 py-2.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    {label}
                  </dt>
                  <dd className="font-data min-w-0 truncate text-right text-xs text-[var(--admin-on-surface)]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mx-6 mb-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
              {note.trim()}
            </p>

            <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--admin-border)] px-6 py-4">
              <button
                type="button"
                className={manageSecondaryButtonClassName}
                disabled={saving}
                onClick={() => {
                  setConfirming(false);
                }}
              >
                Back
              </button>
              <button
                type="button"
                className={manageDangerButtonClassName}
                disabled={saving}
                onClick={() => {
                  void submit();
                }}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <Undo2 className="h-4 w-4" aria-hidden="true" />
                )}
                {saving ? "Refunding…" : "Refund"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RefundSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="h-3 w-56 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
      <div className="space-y-2">
        <div className="h-7 w-64 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        <div className="h-3 w-80 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <div className="h-20 rounded-xl bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-96 rounded-xl bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
        <div className="lg:col-span-4">
          <div className="h-64 rounded-xl bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}
