"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type {
  LearnerBillingConfigResponse,
  LearnerCheckoutConfig,
} from "@atlas/domain-config/schemas/learner-billing";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type OptionKey = keyof LearnerCheckoutConfig;

const OPTIONS: ReadonlyArray<{ key: OptionKey; label: string; description: string }> = [
  {
    key: "requestBillingAddress",
    label: "Request complete billing address",
    description:
      "When enabled, learners are asked for their complete billing address during payment checkout.",
  },
  {
    key: "requestShippingAddress",
    label: "Request shipping address",
    description:
      "When enabled, learners are asked for their complete shipping address during payment checkout.",
  },
  {
    key: "requestGstin",
    label: "Request GSTIN",
    description: "When enabled, learners can provide their GST details on their account page.",
  },
  {
    key: "requestMobile",
    label: "Request mobile number",
    description:
      "When enabled, learners are asked for their mobile number during payment checkout.",
  },
];

function sameConfig(a: LearnerCheckoutConfig, b: LearnerCheckoutConfig): boolean {
  return OPTIONS.every((option) => a[option.key] === b[option.key]);
}

export function LearnerConfigPanel({ initial }: { initial: LearnerCheckoutConfig }) {
  const router = useRouter();
  const [saved, setSaved] = useState<LearnerCheckoutConfig>(initial);
  const [values, setValues] = useState<LearnerCheckoutConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = !sameConfig(values, saved);

  async function onSave() {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      const response = await clientApi.put<LearnerBillingConfigResponse>(
        "/api/v1/learner-billing/learner-config",
        values,
        "learner-billing-learner-config",
        { successMessage: "Learner configurations saved." },
      );
      setSaved(response.data.learnerConfig);
      setValues(response.data.learnerConfig);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not save the configuration. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
          Learner Configurations
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Choose what learners are asked for during checkout.
        </p>
      </header>

      <div className="max-w-2xl space-y-3">
        {OPTIONS.map((option) => {
          const checked = values[option.key];
          return (
            <label
              key={option.key}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-5 transition-colors ${
                checked
                  ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                  : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-outline)]"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  setValues((current) => ({ ...current, [option.key]: event.target.checked }));
                }}
                className="mt-0.5 h-4 w-4 accent-[var(--admin-primary)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[var(--admin-on-surface)]">
                  {option.label}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface)_88%,transparent)] px-1 py-3 backdrop-blur">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => {
            setValues(saved);
            setError(null);
          }}
          className="rounded-lg border border-[var(--admin-border)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void onSave()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-sm font-bold text-[var(--admin-on-primary)] shadow-sm transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <RefreshCw
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
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
