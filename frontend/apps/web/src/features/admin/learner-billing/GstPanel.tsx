"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Info, Receipt, RefreshCw } from "lucide-react";
import type { LearnerBillingConfigResponse } from "@atlas/domain-config/schemas/learner-billing";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  GST_SLABS,
  PREVIEW_BASE_CENTS,
  formatAmount,
  normaliseGstin,
  parsePercentage,
  taxCents,
  validateGst,
} from "./gst-shared";

const inputClassName =
  "w-full rounded-xl border bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-60";
const labelClassName = "block text-sm font-bold text-[var(--admin-on-surface)]";

function fieldBorder(invalid: boolean): string {
  return invalid ? "border-[var(--admin-danger)]" : "border-[var(--admin-border)]";
}

type GstInitial = { enabled: boolean; number: string | null; percentage: number | null };

export function GstPanel({
  initial,
  homeCurrency,
}: {
  initial: GstInitial;
  homeCurrency: string | null;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<GstInitial>(initial);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [number, setNumber] = useState(initial.number ?? "");
  const [percentage, setPercentage] = useState(
    initial.percentage != null ? String(initial.percentage) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Field errors only after a save is attempted, so the form does not shout at
  // someone who is halfway through typing a fifteen-character GSTIN.
  const [showErrors, setShowErrors] = useState(false);

  const draft = { enabled, number, percentage };
  const errors = useMemo(() => validateGst(draft), [enabled, number, percentage]);
  const visibleErrors = showErrors ? errors : {};

  const dirty =
    enabled !== saved.enabled ||
    normaliseGstin(number) !== (saved.number ?? "") ||
    parsePercentage(percentage) !== saved.percentage;

  const rate = parsePercentage(percentage);
  const previewTax = taxCents(PREVIEW_BASE_CENTS, enabled ? rate : null);

  function reset() {
    setEnabled(saved.enabled);
    setNumber(saved.number ?? "");
    setPercentage(saved.percentage != null ? String(saved.percentage) : "");
    setError(null);
    setShowErrors(false);
  }

  async function onSave() {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) {
      // The server rejects this too; stopping here just saves the round trip.
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await clientApi.put<LearnerBillingConfigResponse>(
        "/api/v1/learner-billing/gst",
        {
          enabled,
          number: normaliseGstin(number) === "" ? null : normaliseGstin(number),
          percentage: rate,
        },
        "learner-billing-gst",
        { successMessage: "Tax settings saved." },
      );
      // Track what is actually stored so the dirty marker clears against the
      // server's answer, not against what was typed.
      setSaved(response.data.gst);
      setNumber(response.data.gst.number ?? "");
      setPercentage(
        response.data.gst.percentage != null ? String(response.data.gst.percentage) : "",
      );
      setEnabled(response.data.gst.enabled);
      setShowErrors(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not save the tax settings. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
            Goods &amp; Service Tax (GST)
          </h1>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Apply GST to learner invoices and reports.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            saved.enabled
              ? "border-[color-mix(in_srgb,var(--admin-success)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]"
              : "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"
          }`}
        >
          {/* The saved state, not the draft — this says what checkout is doing
              right now, which is the question an admin opens this page with. */}
          {saved.enabled ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Charging {saved.percentage ?? 0}%
            </>
          ) : (
            "Not charging tax"
          )}
        </span>
      </header>

      <div className="max-w-xl space-y-5">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 transition-colors hover:bg-[var(--admin-surface-high)]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked);
              if (!event.target.checked) setShowErrors(false);
            }}
            className="mt-0.5 h-4 w-4 accent-[var(--admin-primary)]"
          />
          <span>
            <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
              Enable GST
            </span>
            <span className="block text-sm text-[var(--admin-on-surface-variant)]">
              Add GST to learner pricing and invoices. Both fields below are required while this is
              on.
            </span>
          </span>
        </label>

        <div className="space-y-2">
          <label htmlFor="gst-number" className={labelClassName}>
            GSTIN
            {enabled ? <span className="text-[var(--admin-danger)]">*</span> : null}
          </label>
          <input
            id="gst-number"
            value={number}
            disabled={!enabled}
            maxLength={15}
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={visibleErrors.number !== undefined}
            aria-describedby={
              visibleErrors.number === undefined ? "gst-number-hint" : "gst-number-error"
            }
            onChange={(event) => {
              setNumber(event.target.value.toUpperCase());
            }}
            placeholder="27ABCDE1234F1Z0"
            className={`font-data ${inputClassName} ${fieldBorder(visibleErrors.number !== undefined)}`}
          />
          {visibleErrors.number === undefined ? (
            <p id="gst-number-hint" className="text-xs text-[var(--admin-on-surface-variant)]">
              {/* Says what is being checked, so a rejection does not look
                  arbitrary. */}
              15 characters, printed on every learner invoice. The check digit is verified, so a
              mistyped character is caught here rather than by a buyer&rsquo;s accountant.
            </p>
          ) : (
            <p
              id="gst-number-error"
              role="alert"
              className="text-xs font-medium text-[var(--admin-danger)]"
            >
              {visibleErrors.number}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="gst-percentage" className={labelClassName}>
            GST Percentage
            {enabled ? <span className="text-[var(--admin-danger)]">*</span> : null}
          </label>
          <div className="relative">
            <input
              id="gst-percentage"
              type="number"
              min={0}
              max={100}
              step="0.01"
              inputMode="decimal"
              value={percentage}
              disabled={!enabled}
              aria-invalid={visibleErrors.percentage !== undefined}
              aria-describedby={
                visibleErrors.percentage === undefined ? undefined : "gst-pct-error"
              }
              onChange={(event) => {
                setPercentage(event.target.value);
              }}
              placeholder="18"
              className={`${inputClassName} pr-9 ${fieldBorder(visibleErrors.percentage !== undefined)}`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--admin-on-surface-variant)]">
              %
            </span>
          </div>
          {visibleErrors.percentage === undefined ? null : (
            <p
              id="gst-pct-error"
              role="alert"
              className="text-xs font-medium text-[var(--admin-danger)]"
            >
              {visibleErrors.percentage}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-[var(--admin-on-surface-variant)]">Common slabs:</span>
            {GST_SLABS.map((slab) => {
              const active = rate === slab;
              return (
                <button
                  key={slab}
                  type="button"
                  disabled={!enabled}
                  onClick={() => {
                    setPercentage(String(slab));
                  }}
                  className={`font-data rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                      : "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                  }`}
                  aria-pressed={active}
                >
                  {slab}%
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* The worked example. Nothing else on this screen says whether the rate
          is added on top or already inside the price — checkout adds it on top,
          after discounts, so that is what this shows. */}
      <section className="max-w-xl rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--admin-on-surface)]">
          <Receipt className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
          What a learner will see
        </h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[var(--admin-on-surface-variant)]">Course price after discounts</dt>
            <dd className="font-data tabular-nums text-[var(--admin-on-surface)]">
              {homeCurrency === null
                ? (PREVIEW_BASE_CENTS / 100).toFixed(2)
                : formatAmount(PREVIEW_BASE_CENTS, homeCurrency)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[var(--admin-on-surface-variant)]">
              GST{enabled && rate !== null ? ` at ${rate}%` : ""}
            </dt>
            <dd className="font-data tabular-nums text-[var(--admin-on-surface)]">
              {homeCurrency === null
                ? (previewTax / 100).toFixed(2)
                : formatAmount(previewTax, homeCurrency)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-[var(--admin-border)] pt-1.5">
            <dt className="font-semibold text-[var(--admin-on-surface)]">Total charged</dt>
            <dd className="font-data font-semibold tabular-nums text-[var(--admin-on-surface)]">
              {homeCurrency === null
                ? ((PREVIEW_BASE_CENTS + previewTax) / 100).toFixed(2)
                : formatAmount(PREVIEW_BASE_CENTS + previewTax, homeCurrency)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
          GST is added on top of the price, after any coupon or wallet credit.{" "}
          {homeCurrency === null ? (
            <>
              No{" "}
              <Link
                href="/admin/learner-billing/home-currency"
                className="font-semibold text-[var(--admin-primary)] hover:underline"
              >
                home currency
              </Link>{" "}
              is set, so this example is shown without a symbol.
            </>
          ) : null}
        </p>
      </section>

      {enabled && rate !== null && rate > 0 && !saved.enabled ? (
        <div
          role="status"
          className="flex max-w-xl items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-4 py-3"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            {/* Enabling tax changes what every learner pays from the moment it
                saves; there is no scheduled start. */}
            Saving this makes every new checkout {rate}% more expensive, immediately. Orders already
            placed are not affected.
          </p>
        </div>
      ) : null}

      {!enabled && saved.enabled ? (
        <div
          role="status"
          className="flex max-w-xl items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-4 py-3"
        >
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Saving this stops collecting GST on new checkouts. Invoices already issued keep the tax
            they were charged.
          </p>
        </div>
      ) : null}

      {error !== null ? (
        <p role="alert" className="text-sm font-medium text-[var(--admin-danger)]">
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
          {/* Discards the edits rather than navigating away from them, which is
              what "Cancel" on a form is expected to do. */}
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
