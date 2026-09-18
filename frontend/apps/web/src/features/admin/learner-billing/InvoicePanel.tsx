"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, RefreshCw } from "lucide-react";
import type { LearnerBillingConfigResponse } from "@atlas/domain-config/schemas/learner-billing";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  INVOICE_PREFIX_MAX_LENGTH,
  formatInvoiceNumber,
  parseSequence,
  sanitiseInvoicePrefix,
  validateInvoice,
} from "./invoice-shared";

const inputClassName =
  "w-full rounded-xl border bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)]";
const labelClassName = "block text-sm font-bold text-[var(--admin-on-surface)]";

function fieldBorder(invalid: boolean): string {
  return invalid ? "border-[var(--admin-danger)]" : "border-[var(--admin-border)]";
}

type InvoiceInitial = {
  prefix: string | null;
  nextNumber: number | null;
  businessName: string | null;
};

export function InvoicePanel({ initial }: { initial: InvoiceInitial }) {
  const router = useRouter();
  const [saved, setSaved] = useState<InvoiceInitial>(initial);
  const [prefix, setPrefix] = useState(initial.prefix ?? "");
  const [nextNumber, setNextNumber] = useState(
    initial.nextNumber != null ? String(initial.nextNumber) : "1",
  );
  const [businessName, setBusinessName] = useState(initial.businessName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const errors = useMemo(
    () => validateInvoice({ businessName, prefix, nextNumber }),
    [businessName, prefix, nextNumber],
  );
  const visibleErrors = showErrors ? errors : {};

  const sequence = parseSequence(nextNumber);
  const dirty =
    prefix.trim() !== (saved.prefix ?? "") ||
    businessName.trim() !== (saved.businessName ?? "") ||
    sequence !== saved.nextNumber;

  // The allocator strips anything outside [A-Za-z0-9_-] and cuts to 16. The
  // field rejects those inputs rather than accepting them, but showing what
  // would survive makes the rejection legible.
  const trimmedPrefix = prefix.trim();
  const survivingPrefix = sanitiseInvoicePrefix(prefix);
  const prefixWouldChange = trimmedPrefix !== "" && survivingPrefix !== trimmedPrefix;

  const previewPrefix = survivingPrefix === "" ? "INV" : survivingPrefix;
  const previewSequence = sequence !== null && sequence >= 1 ? sequence : 1;

  // Lowering the counter is the one edit here that can do lasting damage: the
  // server refuses a number already printed, but a wind-back that stays above
  // the highest issued one is accepted and silently reuses a gap.
  const windingBack = saved.nextNumber !== null && sequence !== null && sequence < saved.nextNumber;

  function reset() {
    setPrefix(saved.prefix ?? "");
    setNextNumber(saved.nextNumber != null ? String(saved.nextNumber) : "1");
    setBusinessName(saved.businessName ?? "");
    setError(null);
    setShowErrors(false);
  }

  async function onSave() {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) {
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await clientApi.put<LearnerBillingConfigResponse>(
        "/api/v1/learner-billing/invoice",
        {
          prefix: trimmedPrefix,
          nextNumber: sequence,
          businessName: businessName.trim(),
        },
        "learner-billing-invoice",
        { successMessage: "Invoice settings saved." },
      );
      // Reconcile against what was stored, not what was typed.
      setSaved(response.data.invoice);
      setPrefix(response.data.invoice.prefix ?? "");
      setNextNumber(
        response.data.invoice.nextNumber != null ? String(response.data.invoice.nextNumber) : "1",
      );
      setBusinessName(response.data.invoice.businessName ?? "");
      setShowErrors(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not save the invoice settings. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
          Invoice Configuration
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Set how learner invoices are numbered and branded.
        </p>
      </header>

      <div className="max-w-xl space-y-5">
        <div className="space-y-2">
          <label htmlFor="inv-business" className={labelClassName}>
            Business Name<span className="text-[var(--admin-danger)]">*</span>
          </label>
          <input
            id="inv-business"
            value={businessName}
            maxLength={200}
            aria-invalid={visibleErrors.businessName !== undefined}
            aria-describedby={
              visibleErrors.businessName === undefined ? "inv-business-hint" : "inv-business-error"
            }
            onChange={(event) => {
              setBusinessName(event.target.value);
            }}
            placeholder="Enter business name"
            className={`${inputClassName} ${fieldBorder(visibleErrors.businessName !== undefined)}`}
          />
          {visibleErrors.businessName === undefined ? (
            <p id="inv-business-hint" className="text-xs text-[var(--admin-on-surface-variant)]">
              Printed at the top of every learner invoice.
            </p>
          ) : (
            <p
              id="inv-business-error"
              role="alert"
              className="text-xs font-medium text-[var(--admin-danger)]"
            >
              {visibleErrors.businessName}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="inv-prefix" className={labelClassName}>
              Invoice Prefix<span className="text-[var(--admin-danger)]">*</span>
            </label>
            <input
              id="inv-prefix"
              value={prefix}
              maxLength={INVOICE_PREFIX_MAX_LENGTH}
              spellCheck={false}
              aria-invalid={visibleErrors.prefix !== undefined}
              aria-describedby={
                visibleErrors.prefix === undefined ? "inv-prefix-hint" : "inv-prefix-error"
              }
              onChange={(event) => {
                setPrefix(event.target.value);
              }}
              placeholder="INV"
              className={`font-data ${inputClassName} ${fieldBorder(visibleErrors.prefix !== undefined)}`}
            />
            {visibleErrors.prefix === undefined ? (
              <p id="inv-prefix-hint" className="text-xs text-[var(--admin-on-surface-variant)]">
                {/* A hyphen is added for you — the commonest mistake here is
                    typing "INV-" and getting "INV--00001". */}
                Letters, numbers, hyphens and underscores. A hyphen is added before the number
                automatically, so type <span className="font-data">INV</span>, not{" "}
                <span className="font-data">INV-</span>.
              </p>
            ) : (
              <p
                id="inv-prefix-error"
                role="alert"
                className="text-xs font-medium text-[var(--admin-danger)]"
              >
                {visibleErrors.prefix}
                {prefixWouldChange ? ` It would have been stored as ${survivingPrefix}.` : ""}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="inv-next" className={labelClassName}>
              Next Invoice Number<span className="text-[var(--admin-danger)]">*</span>
            </label>
            <input
              id="inv-next"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={nextNumber}
              aria-invalid={visibleErrors.nextNumber !== undefined}
              aria-describedby={
                visibleErrors.nextNumber === undefined ? undefined : "inv-next-error"
              }
              onChange={(event) => {
                setNextNumber(event.target.value);
              }}
              placeholder="1"
              className={`font-data ${inputClassName} ${fieldBorder(visibleErrors.nextNumber !== undefined)}`}
            />
            {visibleErrors.nextNumber === undefined ? null : (
              <p
                id="inv-next-error"
                role="alert"
                className="text-xs font-medium text-[var(--admin-danger)]"
              >
                {visibleErrors.nextNumber}
              </p>
            )}
          </div>
        </div>

        {/* The real thing. The old preview concatenated the two fields and
            showed "INV-1"; the allocator adds its own hyphen and pads to five
            digits, so no invoice ever looked like that. */}
        <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--admin-on-surface)]">
            <FileText
              className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            Next invoice number
          </h2>
          <p className="font-data mt-2 text-lg font-semibold tracking-tight text-[var(--admin-on-surface)]">
            {formatInvoiceNumber(previewPrefix, previewSequence)}
          </p>
          <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
            The one after it will be {formatInvoiceNumber(previewPrefix, previewSequence + 1)}. The
            number is assigned when an order is paid, not when it is placed.
          </p>
        </section>
      </div>

      {windingBack ? (
        <div
          role="status"
          className="flex max-w-xl items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-4 py-3"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            {/* Nothing in the database stops a duplicate — invoice_number is
                indexed, not unique — so this is the only warning an admin gets
                before the server's own check. */}
            You are winding the counter back from {saved.nextNumber} to {sequence}. Saving is
            refused if that number has already been printed on an invoice, because two invoices
            cannot share a number.
          </p>
        </div>
      ) : null}

      {error !== null ? (
        <p role="alert" className="max-w-xl text-sm font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface)_88%,transparent)] px-1 py-3 backdrop-blur">
        {dirty ? (
          <span className="mr-auto text-xs font-semibold text-[var(--admin-on-surface-variant)]">
            Unsaved changes
          </span>
        ) : null}
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={reset}
          className="rounded-lg border border-[var(--admin-border)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
        >
          Discard changes
        </button>
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={() => void onSave()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-sm font-bold text-[var(--admin-on-primary)] shadow-sm transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
              Saving
            </>
          ) : (
            "Save"
          )}
        </button>
      </div>
    </div>
  );
}
