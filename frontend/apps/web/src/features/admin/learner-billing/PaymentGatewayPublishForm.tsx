"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type {
  PaymentGatewayResponse,
  PaymentGatewayView,
} from "@atlas/domain-config/schemas/payment-gateway";
import { ClientApiError, clientApi } from "../../../lib/client-api";

const OPTIONS: ReadonlyArray<{ value: boolean; label: string; description: string }> = [
  {
    value: true,
    label: "Publish",
    description: "Activate and make the payment gateway available for transactions.",
  },
  {
    value: false,
    label: "Unpublish",
    description: "Deactivate and disable the payment gateway from processing transactions.",
  },
];

export function PaymentGatewayPublishForm({ gateway }: { gateway: PaymentGatewayView }) {
  const router = useRouter();
  const [published, setPublished] = useState(gateway.isPublished);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = published !== gateway.isPublished;

  async function onSave() {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      await clientApi.put<PaymentGatewayResponse>(
        `/api/v1/learner-billing/payment-gateways/${gateway.id}/publish`,
        { published },
        "publish-payment-gateway",
        { successMessage: published ? "Payment gateway published." : "Payment gateway unpublished." },
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not update the status. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
          Publish Payment Gateway
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Publish or unpublish {gateway.displayName} for your school.
        </p>
      </header>

      <div role="radiogroup" aria-label="Publish status" className="max-w-2xl space-y-3">
        {OPTIONS.map((option) => {
          const active = published === option.value;
          const danger = !option.value;
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setPublished(option.value);
              }}
              className={`flex w-full items-start gap-3 rounded-2xl border p-5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] ${
                active
                  ? danger
                    ? "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))]"
                    : "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_8%,var(--admin-surface))]"
                  : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-primary)]"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  active
                    ? danger
                      ? "border-[var(--admin-danger)]"
                      : "border-[var(--admin-success)]"
                    : "border-[var(--admin-outline)]"
                }`}
              >
                {active ? (
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${danger ? "bg-[var(--admin-danger)]" : "bg-[var(--admin-success)]"}`}
                  />
                ) : null}
              </span>
              <span>
                <span className="block text-sm font-bold text-[var(--admin-on-surface)]">
                  {option.label}
                </span>
                <span className="block text-sm text-[var(--admin-on-surface-variant)]">
                  {option.description}
                </span>
              </span>
            </button>
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
          disabled={saving}
          onClick={() => {
            router.push("/admin/learner-billing/payment-gateway");
          }}
          className="rounded-lg border border-[var(--admin-border)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
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
