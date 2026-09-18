"use client";

import { useState } from "react";
import Link from "next/link";
import { Coins, Info, TriangleAlert } from "lucide-react";
import type { LearnerBillingConfigResponse } from "@atlas/domain-config/schemas/learner-billing";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { useCurrency } from "../../currency/CurrencyProvider";
import { CurrencySelectModal } from "./CurrencySelectModal";
import { currencyName } from "./currency-options";
import { conversionExample } from "./home-currency-shared";

type Step = "idle" | "select" | "confirm";

export function HomeCurrencyPanel({ initialCurrency }: { initialCurrency: string | null }) {
  const [savedCode, setSavedCode] = useState<string | null>(initialCurrency);
  const [step, setStep] = useState<Step>("idle");
  // The currency chosen but not yet confirmed. Selecting now comes before
  // confirming, so the warning can name what is actually changing and show what
  // it does to a real price — a confirmation raised before the choice cannot.
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setDisplayCurrency, rates } = useCurrency();

  const savedName = currencyName(savedCode);
  const pendingName = currencyName(pendingCode);

  // What a learner would see happen to one course price. Omitted rather than
  // guessed when the rate table cannot support the conversion.
  const example =
    pendingCode === null || savedCode === null
      ? null
      : conversionExample({ rates, from: savedCode, to: pendingCode });

  async function onSaveCurrency(code: string) {
    setSaving(true);
    setError(null);
    try {
      const response = await clientApi.put<LearnerBillingConfigResponse>(
        "/api/v1/learner-billing/home-currency",
        { currency: code },
        "learner-billing-home-currency",
        { successMessage: "Home currency updated." },
      );
      setSavedCode(response.data.homeCurrency);
      // Propagate the new home currency across the app immediately.
      if (response.data.homeCurrency) setDisplayCurrency(response.data.homeCurrency);
      setPendingCode(null);
      setStep("idle");
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not update the currency. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
          Home Currency
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Set and view all statistics in your preferred currency.
        </p>
      </header>

      <div className="max-w-xl space-y-2">
        <label
          htmlFor="home-currency-value"
          className="block text-sm font-bold text-[var(--admin-on-surface)]"
        >
          Currency<span className="text-[var(--admin-danger)]">*</span>
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div
            id="home-currency-value"
            className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm"
          >
            <Coins
              className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <span
              className={
                savedName
                  ? "text-[var(--admin-on-surface)]"
                  : "italic text-[var(--admin-on-surface-variant)]"
              }
            >
              {savedName ?? "No currency selected"}
            </span>
            {/* The ISO code is what every report, export and API response
                actually carries, so it belongs beside the name. */}
            {savedCode === null ? null : (
              <span className="font-data ml-auto text-xs text-[var(--admin-on-surface-variant)]">
                {savedCode}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep("select");
            }}
            className="shrink-0 rounded-lg border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-6 py-2.5 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)]"
          >
            {savedCode === null ? "Set currency" : "Change"}
          </button>
        </div>
      </div>

      <div className="flex max-w-2xl items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {/* Corrected: course prices really are converted at live rates
              (CoursePrice renders through Money, which calls convert). What is
              never converted is a completed order. */}
          Course prices shown to learners are converted into this currency at the current exchange
          rate. Completed orders keep the currency they were taken in, and report tables show each
          row in its own currency. What a learner is charged is set per region in{" "}
          <Link
            href="/admin/learner-billing/locations"
            className="font-semibold text-[var(--admin-primary)] hover:underline"
          >
            Locations
          </Link>
          .
        </p>
      </div>

      {error !== null && step === "idle" ? (
        <p role="alert" className="text-sm font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      <AdminConfirmDialog
        open={step === "confirm"}
        title={
          pendingCode === null ? "Change currency?" : `Change home currency to ${pendingCode}?`
        }
        icon={TriangleAlert}
        tone="danger"
        confirmLabel={pendingCode === null ? "Yes, change" : `Yes, switch to ${pendingCode}`}
        busyLabel="Switching…"
        cancelLabel="Back"
        busy={saving}
        error={error}
        description={
          <div className="space-y-3">
            {savedCode === null || pendingCode === null ? null : (
              <p className="text-[var(--admin-on-surface)]">
                Switching from <span className="font-data font-semibold">{savedCode}</span>
                {savedName === null ? null : ` (${savedName})`} to{" "}
                <span className="font-data font-semibold">{pendingCode}</span>
                {pendingName === null ? null : ` (${pendingName})`}.
              </p>
            )}

            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="font-data shrink-0 pt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                  1.
                </span>
                <span>
                  {/* The consequence the old copy denied outright. */}
                  Course prices shown to learners are{" "}
                  <strong className="font-semibold text-[var(--admin-on-surface)]">
                    converted at the current exchange rate
                  </strong>
                  , not relabelled.{" "}
                  {example === null ? (
                    "A price stored in another currency will be re-quoted in the new one."
                  ) : (
                    <>
                      A course priced at <span className="font-data">{example.before}</span> will be
                      shown as <span className="font-data">{example.after}</span>.
                    </>
                  )}
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-data shrink-0 pt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                  2.
                </span>
                <span>
                  Nothing already recorded moves. Completed orders and issued invoices keep the
                  currency they were taken in, and report tables keep showing each row in its own
                  currency.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-data shrink-0 pt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                  3.
                </span>
                <span>
                  What a learner is actually charged is set per region on the pricing plan, not
                  here. If a plan uses the default &ldquo;Rest Of The World&rdquo; location, that
                  location&rsquo;s currency is what gets charged.
                </span>
              </li>
            </ol>
          </div>
        }
        onConfirm={() => {
          if (pendingCode !== null) void onSaveCurrency(pendingCode);
        }}
        onCancel={() => {
          if (saving) return;
          // Back to the picker, not out of the flow — the choice was already
          // made and losing it to a mis-click would be irritating.
          setError(null);
          setStep("select");
        }}
      />

      <CurrencySelectModal
        open={step === "select"}
        currentCode={savedCode}
        busy={false}
        onSave={(code) => {
          if (code === savedCode) {
            // Choosing the currency already in force is a no-op; there is
            // nothing to warn about and nothing to save.
            setPendingCode(null);
            setStep("idle");
            return;
          }
          setPendingCode(code);
          setStep("confirm");
        }}
        onCancel={() => {
          setPendingCode(null);
          setStep("idle");
        }}
      />
    </div>
  );
}
