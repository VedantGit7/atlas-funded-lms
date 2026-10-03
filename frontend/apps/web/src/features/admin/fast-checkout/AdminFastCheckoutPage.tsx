"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { fastCheckoutPageClassName } from "./fast-checkout-admin-shared";

const bannerClassName =
  "rounded-lg border px-4 py-3 text-sm motion-safe:animate-[admin-banner-in_0.25s_ease-out]";

export function AdminFastCheckoutPage({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saved, setSaved] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = enabled !== saved;

  async function onSave() {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      await clientApi.put<{ data: { enabled: boolean } }>(
        "/api/v1/tenant-settings/fast-checkout",
        { enabled },
        "fast-checkout-update",
      );
      setSaved(enabled);
      setStatus(enabled ? "Fast Checkout is enabled." : "Fast Checkout is disabled.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not save your changes. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    setEnabled(saved);
    setStatus(null);
    setError(null);
  }

  return (
    <>
      <div className={`${fastCheckoutPageClassName} pb-28`}>
        <Link href="/admin/settings" prefetch={false} className={generalSettingsBackLinkClassName}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Settings
        </Link>

        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
            Fast Checkout
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            Allow learners to buy your products with a quick and easy checkout process.
          </p>
        </header>

        {status ? (
          <p
            role="status"
            className={`${bannerClassName} border-[var(--admin-success)]/30 bg-[var(--admin-success)]/10 text-[var(--admin-success)]`}
          >
            {status}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className={`${bannerClassName} border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
          >
            {error}
          </p>
        ) : null}

        <label
          className={[
            "flex cursor-pointer items-start gap-3.5 rounded-xl border bg-[var(--admin-surface)] p-5 shadow-sm motion-safe:transition-[border-color,box-shadow] motion-safe:duration-200",
            enabled
              ? "border-[var(--admin-success)]/50 ring-1 ring-[var(--admin-success)]/25"
              : "border-[var(--admin-border)] hover:border-[var(--admin-outline)]",
          ].join(" ")}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked);
            }}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={[
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border motion-safe:transition-colors motion-safe:duration-200",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--admin-primary)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--admin-bg)]",
              enabled
                ? "border-[var(--admin-success)] bg-[var(--admin-success)] text-[var(--admin-on-success)]"
                : "border-[var(--admin-outline)] bg-[var(--admin-surface)]",
            ].join(" ")}
          >
            {enabled ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : null}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
              Fast Checkout
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
              Enable to allow learners to buy your products with a quick and easy checkout process.
            </span>
          </span>
        </label>
      </div>

      <footer className="admin-glass fixed inset-x-0 bottom-0 z-30 border-t border-[var(--admin-border)] px-4 py-4 motion-safe:animate-[admin-slide-up_0.35s_cubic-bezier(0.16,1,0.3,1)] md:px-8 lg:left-[280px]">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void onSave()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-high)] disabled:text-[var(--admin-on-surface-variant)] disabled:opacity-100 disabled:shadow-none"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Save
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={onCancel}
            className="rounded-lg border border-[var(--admin-border)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </footer>
    </>
  );
}
