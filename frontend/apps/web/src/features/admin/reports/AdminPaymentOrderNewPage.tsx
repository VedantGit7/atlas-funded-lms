"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Info,
  Loader2,
  Lock,
  Save,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  managePageDescClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import {
  PAYMENT_ORDER_STATUSES,
  createPaymentOrder,
  fetchPaymentOrderSummary,
  searchLearners,
  type LearnerSearchResult,
  type PaymentOrderStatus,
} from "./payment-orders-api";
import {
  formatAmount,
  ordersEmptyPanelClassName,
  ordersFieldClassName,
  ordersNoteClassName,
  statusChipClassName,
} from "./payment-orders-shared";

const ORDERS_HREF = "/admin/reports/payments/orders";

const panelClassName = "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]";

const labelClassName = "mb-1 block text-xs font-semibold text-[var(--admin-on-surface-variant)]";

const helpClassName = "mt-1 text-xs text-[var(--admin-on-surface-variant)]";

/**
 * `/admin/reports/payments/orders/new`.
 *
 * Recording a manual order asserts that money arrived somewhere this system
 * cannot see. Nothing here calls a gateway, moves funds or sends a receipt — it
 * writes one ledger row — and the screen says so rather than dressing the act
 * up as taking a payment.
 *
 * Three things make it more than a form:
 *
 * **It asks whether the operator may record before drawing the form.** Reading
 * the ledger is `reports.run`; recording is `config.update`. The server answers
 * with a real authorization decision, so an analyst is told up front instead of
 * losing their typing to a 403.
 *
 * **It confirms before writing.** A ledger entry has no undo in this console,
 * and the review step is where a missing external ID gets named as the durable
 * consequence it is.
 *
 * **It records why.** The reason rides along in the order's metadata, because
 * six months later it is the only thing that makes the row auditable.
 */
export function AdminPaymentOrderNewPage() {
  const router = useRouter();
  const fieldId = useId();

  const [canRecord, setCanRecord] = useState<boolean | null>(null);

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [status, setStatus] = useState<PaymentOrderStatus>("pending");
  const [externalId, setExternalId] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const [learnerQuery, setLearnerQuery] = useState("");
  const [learnerResults, setLearnerResults] = useState<LearnerSearchResult[]>([]);
  const [learner, setLearner] = useState<LearnerSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Asking the summary endpoint rather than adding another round trip: it
  // already answers under the operator's own permissions.
  const loadCapabilities = useCallback(async () => {
    try {
      const summary = await fetchPaymentOrderSummary({});
      setCanRecord(summary.capabilities.canRecord);
    } catch {
      // If the capability cannot be read, let the attempt proceed — the server
      // is the authority and will refuse it. Guessing "denied" would lock out
      // an operator who is merely offline for a moment.
      setCanRecord(true);
    }
  }, []);

  useEffect(() => {
    void loadCapabilities();
  }, [loadCapabilities]);

  const searchTicket = useRef(0);

  useEffect(() => {
    const term = learnerQuery.trim();
    if (term.length < 2 || learner !== null) {
      setLearnerResults([]);
      return;
    }

    const ticket = ++searchTicket.current;
    setSearching(true);
    const timer = setTimeout(() => {
      void searchLearners(term)
        .then((results) => {
          if (ticket !== searchTicket.current) return;
          setLearnerResults(results);
        })
        .catch(() => {
          if (ticket !== searchTicket.current) return;
          setLearnerResults([]);
        })
        .finally(() => {
          if (ticket === searchTicket.current) setSearching(false);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [learnerQuery, learner]);

  const major = Number(amount);
  const amountValid = amount.trim() !== "" && Number.isFinite(major) && major > 0;
  const amountNegative = amount.trim() !== "" && Number.isFinite(major) && major < 0;
  const currencyValid = /^[A-Za-z]{3}$/.test(currency.trim());

  // Pinned to two decimals before rounding: floating-point cents on a ledger is
  // a rounding bug waiting for a large number.
  const amountCents = amountValid ? Math.round(Number(major.toFixed(2)) * 100) : 0;

  const missingExternalId = externalId.trim() === "";
  const canSubmit = amountValid && currencyValid && !saving;

  const summaryRows = useMemo(
    () => [
      {
        label: "Amount",
        value: amountValid ? formatAmount(amountCents, currency.trim().toUpperCase()) : "—",
      },
      { label: "Status", value: status, isStatus: true },
      {
        label: "Learner",
        value: learner
          ? (learner.displayName ?? learner.email ?? learner.membershipId)
          : "Attributed to you",
      },
      { label: "External ID", value: missingExternalId ? "None" : externalId.trim() },
    ],
    [amountValid, amountCents, currency, status, learner, missingExternalId, externalId],
  );

  async function record() {
    setSaving(true);
    setError(null);
    try {
      const created = await createPaymentOrder({
        amountCents,
        currency: currency.trim().toUpperCase(),
        status,
        ...(learner ? { membershipId: learner.membershipId } : {}),
        ...(externalId.trim() ? { externalId: externalId.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      // Land on the new row in the ledger, highlighted, rather than dropping the
      // operator at the top of a list of fifty and letting them hunt.
      router.push(`${ORDERS_HREF}?created=${encodeURIComponent(created.id)}`);
    } catch (caught) {
      // The entered values stay on screen. Re-typing a reconciliation entry
      // because the save failed is the worst thing this form could do.
      setError(caught instanceof ClientApiError ? caught.message : "Could not record the order.");
      setConfirming(false);
      setSaving(false);
    }
  }

  function handleReview(event: React.SyntheticEvent) {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setConfirming(true);
  }

  const breadcrumb = (
    <nav aria-label="Breadcrumb" className="font-data flex items-center gap-1.5 text-xs">
      <Link
        href={ORDERS_HREF}
        className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
      >
        Orders
      </Link>
      <ChevronRight className="h-3 w-3 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
      <span className="font-semibold text-[var(--admin-on-surface)]">New</span>
    </nav>
  );

  if (canRecord === false) {
    return (
      <div className="space-y-5">
        {breadcrumb}
        <div className={ordersEmptyPanelClassName}>
          <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
            <Lock className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-bold text-[var(--admin-on-surface)]">
            You do not have permission to record orders
          </h1>
          <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            Recording an order writes to the payment ledger, so it needs a configuration permission
            rather than the reporting one that lets you read this section.
          </p>
          <Link href={ORDERS_HREF} className={`${manageSecondaryButtonClassName} mt-6`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {breadcrumb}

      <div>
        <h1 className={managePageTitleClassName}>Record a manual order</h1>
        <p className={managePageDescClassName}>For a payment taken outside the platform.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <div className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_32%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_9%,var(--admin-surface))] p-4">
            <TriangleAlert
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                This records a payment no gateway knows about
              </p>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                It writes one ledger row. No money moves, no gateway is called, and no receipt is
                sent. Use it only to reconcile a payment taken outside the platform.
              </p>
            </div>
          </div>

          <form className={`${panelClassName} p-6`} onSubmit={handleReview} noValidate>
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
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className={labelClassName} htmlFor={`${fieldId}-amount`}>
                    Amount <span className="text-[var(--admin-danger)]">*</span>
                  </label>
                  <input
                    id={`${fieldId}-amount`}
                    className={[
                      ordersFieldClassName,
                      "font-data w-full text-right",
                      touched && !amountValid
                        ? "border-[var(--admin-danger)] focus:border-[var(--admin-danger)] focus:ring-[var(--admin-danger)]/25"
                        : "",
                    ].join(" ")}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    disabled={saving}
                    aria-invalid={touched && !amountValid}
                    onChange={(event) => {
                      setAmount(event.target.value);
                    }}
                  />
                  {touched && !amountValid ? (
                    <p
                      role="alert"
                      className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--admin-danger)]"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {/* Naming the actual problem beats "enter a valid amount". */}
                      {amountNegative
                        ? "An amount must be positive. Record a refund from the order itself."
                        : "Enter an amount greater than zero."}
                    </p>
                  ) : (
                    <p className={helpClassName}>
                      In major units, as printed on the invoice.
                      {amountValid ? (
                        <span className="font-data">
                          {" "}
                          Stored as {String(amountCents)} minor units.
                        </span>
                      ) : null}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClassName} htmlFor={`${fieldId}-currency`}>
                    Currency <span className="text-[var(--admin-danger)]">*</span>
                  </label>
                  <input
                    id={`${fieldId}-currency`}
                    className={`${ordersFieldClassName} font-data w-full uppercase`}
                    maxLength={3}
                    value={currency}
                    disabled={saving}
                    aria-invalid={touched && !currencyValid}
                    onChange={(event) => {
                      setCurrency(event.target.value);
                    }}
                  />
                  <p className={helpClassName}>Three-letter code.</p>
                </div>
              </div>

              <div>
                <span className={labelClassName}>Learner</span>
                {learner ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[var(--admin-on-surface)]">
                        {learner.displayName ?? learner.email ?? "Learner"}
                      </span>
                      <span className="font-data block truncate text-[11px] text-[var(--admin-on-surface-variant)]">
                        {learner.email ?? learner.membershipId}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label="Clear learner"
                      className="rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface)] hover:text-[var(--admin-on-surface)]"
                      disabled={saving}
                      onClick={() => {
                        setLearner(null);
                        setLearnerQuery("");
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <label className="sr-only" htmlFor={`${fieldId}-learner`}>
                      Search learners
                    </label>
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <input
                      id={`${fieldId}-learner`}
                      type="search"
                      className={`${ordersFieldClassName} w-full pl-9`}
                      placeholder="Search by name or email"
                      value={learnerQuery}
                      disabled={saving}
                      onChange={(event) => {
                        setLearnerQuery(event.target.value);
                      }}
                    />
                    {learnerResults.length > 0 ? (
                      <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)] motion-safe:origin-top">
                        {learnerResults.map((result) => (
                          <li key={result.membershipId}>
                            <button
                              type="button"
                              className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-[var(--admin-surface-high)]"
                              onClick={() => {
                                setLearner(result);
                                setLearnerResults([]);
                              }}
                            >
                              <span className="text-sm text-[var(--admin-on-surface)]">
                                {result.displayName ?? result.email ?? result.membershipId}
                              </span>
                              <span className="font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                                {result.email ?? result.membershipId}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )}
                <p className={helpClassName}>
                  {searching
                    ? "Searching…"
                    : "Optional. Leave empty and the order is attributed to you."}
                </p>
              </div>

              <div>
                <label className={labelClassName} htmlFor={`${fieldId}-external`}>
                  External ID
                </label>
                <input
                  id={`${fieldId}-external`}
                  className={`${ordersFieldClassName} font-data w-full`}
                  placeholder="Bank transfer reference, cheque number, pi_…"
                  value={externalId}
                  disabled={saving}
                  onChange={(event) => {
                    setExternalId(event.target.value);
                  }}
                />
                <p
                  className={
                    missingExternalId
                      ? "mt-1 flex items-start gap-1.5 text-xs text-[var(--admin-warning)]"
                      : helpClassName
                  }
                >
                  {missingExternalId ? (
                    <>
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {/* Warned, never blocked: a cash payment genuinely has no
                          gateway reference, and refusing it would push the
                          operator into leaving the ledger wrong instead. */}
                      Without one, no gateway webhook can ever settle this order.
                    </>
                  ) : (
                    "The gateway reference a webhook will match on."
                  )}
                </p>
              </div>

              <div>
                <span className={labelClassName}>Status</span>
                <div className="inline-flex flex-wrap overflow-hidden rounded-lg border border-[var(--admin-outline)]">
                  {PAYMENT_ORDER_STATUSES.map((value, index) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={value === status}
                      disabled={saving}
                      className={[
                        "px-3 py-2 text-sm font-medium capitalize transition-colors",
                        index > 0 ? "border-l border-[var(--admin-outline)]" : "",
                        value === status
                          ? "bg-[var(--admin-primary)] font-semibold text-[var(--admin-on-primary)]"
                          : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                      ].join(" ")}
                      onClick={() => {
                        setStatus(value);
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                {status === "paid" && missingExternalId ? (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--admin-warning)]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {/* This combination creates the exact fault the ledger flags. */}
                    Marking it paid without an external ID creates an order the ledger will flag as
                    settled with nothing to reconcile against.
                  </p>
                ) : null}
              </div>

              <div>
                <label className={labelClassName} htmlFor={`${fieldId}-note`}>
                  Reason for the manual entry
                </label>
                <textarea
                  id={`${fieldId}-note`}
                  className={`${ordersFieldClassName} w-full resize-y`}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Bank transfer received 24 Oct, confirmed by finance."
                  value={note}
                  disabled={saving}
                  onChange={(event) => {
                    setNote(event.target.value);
                  }}
                />
                <p className={helpClassName}>
                  Optional, but it is stored on the order and is usually the only thing that
                  explains this row later.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-[var(--admin-border)] pt-5 sm:flex-row sm:justify-end">
              <Link href={ORDERS_HREF} className={manageSecondaryButtonClassName}>
                Cancel
              </Link>
              <button type="submit" className={managePrimaryButtonClassName} disabled={!canSubmit}>
                <Save className="h-4 w-4" aria-hidden="true" />
                Review and record
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-5 lg:col-span-4">
          <section className={panelClassName}>
            <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3">
              <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">What this does</h2>
            </div>
            <div className="space-y-3 p-4 text-sm text-[var(--admin-on-surface-variant)]">
              <p>
                A manual order is a ledger row asserting that money arrived somewhere this system
                cannot see.
              </p>
              <p>
                It is recorded against your account in the audit log, and the reason you give is
                stored on the order itself.
              </p>
              <p>
                {/* Said plainly because the console has no delete for orders. */}
                There is no way to remove an order from this console once it is recorded.
              </p>
            </div>
          </section>

          <div className={ordersNoteClassName}>
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Learner, product and gateway detail is not captured here — orders are the raw ledger
              rows, and that detail lives in Transactions.
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
            className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
          >
            <header className="border-b border-[var(--admin-border)] px-6 py-5">
              <h2
                id={`${fieldId}-confirm`}
                className="text-base font-bold text-[var(--admin-on-surface)]"
              >
                Record this order?
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Check the details. This console cannot remove an order once it is written.
              </p>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {missingExternalId ? (
                <div className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_32%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_9%,var(--admin-surface))] px-4 py-3">
                  <TriangleAlert
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-[var(--admin-on-surface)]">
                    No external ID — this order cannot be settled automatically by a webhook and
                    will need reconciling by hand.
                  </p>
                </div>
              ) : null}

              <dl className="divide-y divide-[var(--admin-border)] rounded-xl border border-[var(--admin-border)]">
                {summaryRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      {row.label}
                    </dt>
                    <dd className="min-w-0 text-right">
                      {row.isStatus ? (
                        <span className={statusChipClassName(status)}>{status}</span>
                      ) : (
                        <span className="font-data truncate text-xs text-[var(--admin-on-surface)]">
                          {row.value}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              {note.trim() ? (
                <p className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
                  {note.trim()}
                </p>
              ) : null}
            </div>

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
                className={managePrimaryButtonClassName}
                disabled={saving}
                onClick={() => {
                  void record();
                }}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {saving ? "Recording…" : "Record order"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
