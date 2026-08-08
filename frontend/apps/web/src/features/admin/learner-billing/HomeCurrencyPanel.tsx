"use client";

import { useState } from "react";
import { Coins } from "lucide-react";
import type { LearnerBillingConfigResponse } from "@atlas/domain-config/schemas/learner-billing";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { useCurrency } from "../../currency/CurrencyProvider";
import { CurrencySelectModal } from "./CurrencySelectModal";
import { currencyName } from "./currency-options";

type Step = "idle" | "confirm" | "select";

export function HomeCurrencyPanel({ initialCurrency }: { initialCurrency: string | null }) {
  const [savedCode, setSavedCode] = useState<string | null>(initialCurrency);
  const [step, setStep] = useState<Step>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setDisplayCurrency } = useCurrency();

  const savedName = currencyName(savedCode);

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
            <Coins className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
            <span
              className={savedName ? "text-[var(--admin-on-surface)]" : "text-[var(--admin-on-surface-variant)]"}
            >
              {savedName ?? "No currency selected"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep("confirm");
            }}
            className="shrink-0 rounded-lg border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-6 py-2.5 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)]"
          >
            Change
          </button>
        </div>
      </div>

      <div className="max-w-2xl space-y-1.5">
        <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">Note</h2>
        <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          This currency only reflects on reports. To update the currency shown to learners, go to{" "}
          <span className="font-semibold text-[var(--admin-on-surface)]">Settings &rsaquo; Locations</span>.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      <AdminConfirmDialog
        open={step === "confirm"}
        title="Change currency?"
        icon={Coins}
        tone="danger"
        confirmLabel="Yes, change"
        cancelLabel="Cancel"
        description={
          <>
            <span className="block">
              1. You will view all transactional reports in the new currency, while the amount stays
              the same. For instance, an amount of 100 keeps its value, only the symbol changes.
            </span>
            <span className="mt-3 block">
              2. You will be billed in your platform billing currency if you switch away from your
              default currency.
            </span>
            <span className="mt-3 block">
              3. If the home currency differs from the &ldquo;Rest of the world&rdquo; currency,
              product prices are shown in the &ldquo;Rest of the world&rdquo; currency, while
              statistics use the home currency.
            </span>
            <span className="mt-4 block font-semibold text-[var(--admin-on-surface)]">
              Please confirm you want to update the currency.
            </span>
          </>
        }
        onConfirm={() => {
          setStep("select");
        }}
        onCancel={() => {
          setStep("idle");
        }}
      />

      <CurrencySelectModal
        open={step === "select"}
        currentCode={savedCode}
        busy={saving}
        onSave={(code) => void onSaveCurrency(code)}
        onCancel={() => {
          if (!saving) setStep("idle");
        }}
      />
    </div>
  );
}
