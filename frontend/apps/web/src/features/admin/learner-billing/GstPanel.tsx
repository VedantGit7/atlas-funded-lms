"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { LearnerBillingConfigResponse } from "@atlas/domain-config/schemas/learner-billing";
import { ClientApiError, clientApi } from "../../../lib/client-api";

const inputClassName =
  "w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-60";
const labelClassName = "block text-sm font-bold text-[var(--admin-on-surface)]";

type GstInitial = { enabled: boolean; number: string | null; percentage: number | null };

export function GstPanel({ initial }: { initial: GstInitial }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [number, setNumber] = useState(initial.number ?? "");
  const [percentage, setPercentage] = useState(
    initial.percentage != null ? String(initial.percentage) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const parsedPct = percentage.trim() ? Number(percentage) : null;
      await clientApi.put<LearnerBillingConfigResponse>(
        "/api/v1/learner-billing/gst",
        {
          enabled,
          number: number.trim() ? number.trim() : null,
          percentage: parsedPct != null && Number.isFinite(parsedPct) ? parsedPct : null,
        },
        "learner-billing-gst",
        { successMessage: "Tax settings saved." },
      );
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
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
          Goods &amp; Service Tax (GST)
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Apply GST to learner invoices and reports.
        </p>
      </header>

      <div className="max-w-xl space-y-5">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked);
            }}
            className="mt-0.5 h-4 w-4 accent-[var(--admin-primary)]"
          />
          <span>
            <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
              Enable GST
            </span>
            <span className="block text-sm text-[var(--admin-on-surface-variant)]">
              Add GST to learner pricing and invoices.
            </span>
          </span>
        </label>

        <div className="space-y-2">
          <label htmlFor="gst-number" className={labelClassName}>
            GSTIN
          </label>
          <input
            id="gst-number"
            value={number}
            disabled={!enabled}
            onChange={(event) => {
              setNumber(event.target.value);
            }}
            placeholder="e.g. 27ABCDE1234F1Z5"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="gst-percentage" className={labelClassName}>
            GST Percentage
          </label>
          <div className="relative">
            <input
              id="gst-percentage"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={percentage}
              disabled={!enabled}
              onChange={(event) => {
                setPercentage(event.target.value);
              }}
              placeholder="18"
              className={`${inputClassName} pr-9`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--admin-on-surface-variant)]">
              %
            </span>
          </div>
        </div>
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
          disabled={saving}
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
