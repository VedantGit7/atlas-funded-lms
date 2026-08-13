"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type {
  PaymentGatewayResponse,
  PaymentGatewayView,
} from "@atlas/domain-config/schemas/payment-gateway";
import { ClientApiError, clientApi } from "../../../lib/client-api";

const inputClassName =
  "w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";
const labelClassName = "block text-sm font-bold text-[var(--admin-on-surface)]";

export function PaymentGatewayConfigForm({ gateway }: { gateway: PaymentGatewayView }) {
  const router = useRouter();
  const isRazorpay = gateway.gatewayKey === "razorpay";
  const [userId, setUserId] = useState(gateway.userId ?? "");
  const [publishableKey, setPublishableKey] = useState(gateway.publishableKey ?? "");
  const [secretKey, setSecretKey] = useState("");
  const [isDefault, setIsDefault] = useState(gateway.isDefault);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const secretRequired = !gateway.hasSecret;
  const valid =
    userId.trim().length > 0 &&
    publishableKey.trim().length > 0 &&
    (!secretRequired || secretKey.trim().length > 0);

  async function onSave() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await clientApi.put<PaymentGatewayResponse>(
        `/api/v1/learner-billing/payment-gateways/${gateway.id}`,
        {
          userId: userId.trim(),
          publishableKey: publishableKey.trim(),
          ...(secretKey.trim() ? { secretKey: secretKey.trim() } : {}),
          isDefault,
        },
        "configure-payment-gateway",
        { successMessage: "Payment gateway configured." },
      );
      setSecretKey("");
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
          Configurations
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Configure your {gateway.displayName} settings and keys.
        </p>
      </header>

      <div className="max-w-xl space-y-5">
        <div className="space-y-2">
          <label htmlFor="pg-user-id" className={labelClassName}>
            User Id<span className="text-[var(--admin-danger)]">*</span>
          </label>
          <input
            id="pg-user-id"
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value);
            }}
            placeholder="Enter user id"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="pg-publishable-key" className={labelClassName}>
            {isRazorpay ? "Key ID" : "Publishable Key"}
            <span className="text-[var(--admin-danger)]">*</span>
          </label>
          <input
            id="pg-publishable-key"
            value={publishableKey}
            onChange={(event) => {
              setPublishableKey(event.target.value);
            }}
            placeholder={isRazorpay ? "Enter Razorpay Key ID" : "Enter publishable key"}
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="pg-secret-key" className={labelClassName}>
            {isRazorpay ? "Key Secret" : "Secret Key"}
            {secretRequired ? <span className="text-[var(--admin-danger)]">*</span> : null}
          </label>
          <input
            id="pg-secret-key"
            type="password"
            autoComplete="new-password"
            value={secretKey}
            onChange={(event) => {
              setSecretKey(event.target.value);
            }}
            placeholder={
              gateway.hasSecret
                ? `Saved securely, ends in ${gateway.secretLast4 ?? "••••"}`
                : isRazorpay
                  ? "Enter Razorpay Key Secret"
                  : "Enter client secret"
            }
            className={inputClassName}
          />
          <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
            {gateway.hasSecret
              ? "Leave blank to keep the current secret. It is encrypted and never shown."
              : "Stored encrypted and never returned to the browser."}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="pg-billing-address" className={labelClassName}>
            Link Billing Address
          </label>
          <select
            id="pg-billing-address"
            disabled
            className={`${inputClassName} cursor-not-allowed opacity-60`}
            defaultValue=""
          >
            <option value="">No billing addresses configured yet</option>
          </select>
          <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
            Add billing addresses under Learner Billing &rsaquo; Locations to link one here.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(event) => {
              setIsDefault(event.target.checked);
            }}
            className="mt-0.5 h-4 w-4 accent-[var(--admin-primary)]"
          />
          <span>
            <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
              Set as Default
            </span>
            <span className="block text-sm text-[var(--admin-on-surface-variant)]">
              Use this payment gateway as the default for learner billing.
            </span>
          </span>
        </label>
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
          disabled={!valid || saving}
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
