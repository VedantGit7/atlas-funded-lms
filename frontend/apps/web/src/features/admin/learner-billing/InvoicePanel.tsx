"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { LearnerBillingConfigResponse } from "@atlas/domain-config/schemas/learner-billing";
import { ClientApiError, clientApi } from "../../../lib/client-api";

const inputClassName =
  "w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";
const labelClassName = "block text-sm font-bold text-[var(--admin-on-surface)]";

type InvoiceInitial = { prefix: string | null; nextNumber: number | null; businessName: string | null };

export function InvoicePanel({ initial }: { initial: InvoiceInitial }) {
  const router = useRouter();
  const [prefix, setPrefix] = useState(initial.prefix ?? "");
  const [nextNumber, setNextNumber] = useState(
    initial.nextNumber != null ? String(initial.nextNumber) : "1",
  );
  const [businessName, setBusinessName] = useState(initial.businessName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedNumber = Number(nextNumber);
  const valid =
    prefix.trim().length > 0 &&
    businessName.trim().length > 0 &&
    Number.isInteger(parsedNumber) &&
    parsedNumber >= 1;

  async function onSave() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await clientApi.put<LearnerBillingConfigResponse>(
        "/api/v1/learner-billing/invoice",
        {
          prefix: prefix.trim(),
          nextNumber: parsedNumber,
          businessName: businessName.trim(),
        },
        "learner-billing-invoice",
        { successMessage: "Invoice settings saved." },
      );
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
            onChange={(event) => {
              setBusinessName(event.target.value);
            }}
            placeholder="Enter business name"
            className={inputClassName}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="inv-prefix" className={labelClassName}>
              Invoice Prefix<span className="text-[var(--admin-danger)]">*</span>
            </label>
            <input
              id="inv-prefix"
              value={prefix}
              onChange={(event) => {
                setPrefix(event.target.value);
              }}
              placeholder="INV-"
              className={inputClassName}
            />
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
              value={nextNumber}
              onChange={(event) => {
                setNextNumber(event.target.value);
              }}
              placeholder="1"
              className={inputClassName}
            />
          </div>
        </div>

        <p className="rounded-xl bg-[var(--admin-surface-high)] px-4 py-3 text-[11px] text-[var(--admin-on-surface-variant)]">
          Next invoice will be numbered{" "}
          <span className="font-semibold text-[var(--admin-on-surface)]">
            {prefix.trim() || "INV-"}
            {Number.isInteger(parsedNumber) && parsedNumber >= 1 ? parsedNumber : 1}
          </span>
          .
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface)_88%,transparent)] px-1 py-3 backdrop-blur">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            router.push("/admin/settings");
          }}
          className="rounded-lg border border-[var(--admin-border)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid || saving}
          onClick={() => void onSave()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-sm font-bold text-[var(--admin-on-primary)] shadow-sm transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
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
