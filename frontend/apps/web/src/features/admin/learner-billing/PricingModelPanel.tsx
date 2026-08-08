"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Coins,
  FileText,
  Gift,
  Landmark,
  MapPin,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";
import type {
  LearnerBillingConfigResponse,
  PricingModel,
} from "@atlas/domain-config/schemas/learner-billing";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { currencyName } from "./currency-options";

type PricingModelOption = {
  key: PricingModel;
  label: string;
  description: string;
  icon: LucideIcon;
};

const PRICING_MODELS: readonly PricingModelOption[] = [
  {
    key: "pay_per_course",
    label: "Pay-per-course",
    description: "Learners pay a one-time fee for each individual course they enroll in.",
    icon: ShoppingCart,
  },
  {
    key: "subscription",
    label: "Learner subscription",
    description: "Recurring access to your entire catalog for a weekly, monthly, or yearly fee.",
    icon: RefreshCw,
  },
  {
    key: "cohort",
    label: "Cohort-based",
    description: "Group-based pricing for specific intake periods or live sessions.",
    icon: Users,
  },
  {
    key: "free",
    label: "Free access",
    description: "All learning content is provided to learners at no cost.",
    icon: Gift,
  },
];

const SETUP_STEP_DEFS: ReadonlyArray<{
  key: "home_currency" | "payment_gateway" | "gst" | "invoice" | "locations";
  label: string;
  icon: LucideIcon;
  href: string;
}> = [
  { key: "home_currency", label: "Home Currency", icon: Coins, href: "/admin/learner-billing/home-currency" },
  { key: "payment_gateway", label: "Payment Gateway", icon: Landmark, href: "/admin/learner-billing/payment-gateway" },
  { key: "gst", label: "Tax / GST", icon: ReceiptText, href: "/admin/learner-billing/gst" },
  { key: "invoice", label: "Invoice Configuration", icon: FileText, href: "/admin/learner-billing/invoice-config" },
  { key: "locations", label: "Billing Locations", icon: MapPin, href: "/admin/learner-billing/locations" },
];

function labelFor(model: PricingModel | null): string | null {
  return PRICING_MODELS.find((option) => option.key === model)?.label ?? null;
}

export function PricingModelPanel({
  initialModel,
  homeCurrency,
  paymentGatewayReady,
  gstConfigured,
  invoiceConfigured,
  locationsConfigured,
}: {
  initialModel: PricingModel | null;
  homeCurrency: string | null;
  paymentGatewayReady: boolean;
  gstConfigured: boolean;
  invoiceConfigured: boolean;
  locationsConfigured: boolean;
}) {
  const [saved, setSaved] = useState<PricingModel | null>(initialModel);
  const [selected, setSelected] = useState<PricingModel | null>(initialModel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const dirty = selected !== saved;
  const savedLabel = labelFor(saved);

  function stepStatus(key: (typeof SETUP_STEP_DEFS)[number]["key"]): {
    configured: boolean;
    label: string;
  } {
    if (key === "home_currency") {
      const name = currencyName(homeCurrency);
      return { configured: Boolean(homeCurrency), label: name ?? "Not configured yet" };
    }
    if (key === "payment_gateway") {
      return {
        configured: paymentGatewayReady,
        label: paymentGatewayReady ? "Configured" : "Not configured yet",
      };
    }
    const flag =
      key === "gst" ? gstConfigured : key === "invoice" ? invoiceConfigured : locationsConfigured;
    return { configured: flag, label: flag ? "Configured" : "Not configured yet" };
  }

  function focusCard(index: number) {
    const clamped = (index + PRICING_MODELS.length) % PRICING_MODELS.length;
    const option = PRICING_MODELS[clamped];
    if (option) {
      setSelected(option.key);
      cardRefs.current[clamped]?.focus();
    }
  }

  function onGroupKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusCard(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusCard(index - 1);
    }
  }

  async function onSave() {
    if (!selected || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      const response = await clientApi.put<LearnerBillingConfigResponse>(
        "/api/v1/learner-billing/config",
        { pricingModel: selected },
        "learner-billing-pricing-model",
        { successMessage: "Pricing model saved." },
      );
      setSaved(response.data.pricingModel);
      setSelected(response.data.pricingModel);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not save the pricing model. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
            Pricing Model
          </h1>
          {savedLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--admin-success)]">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {savedLabel}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--admin-warning)_18%,var(--admin-surface))] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--admin-warning)]">
              Not configured yet
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Pick a pricing model for your school.
        </p>
      </header>

      <div
        role="radiogroup"
        aria-label="Pricing model"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {PRICING_MODELS.map((option, index) => {
          const Icon = option.icon;
          const active = selected === option.key;
          const isSaved = saved === option.key;
          return (
            <button
              key={option.key}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active || (selected === null && index === 0) ? 0 : -1}
              onClick={() => {
                setSelected(option.key);
              }}
              onKeyDown={(event) => {
                onGroupKeyDown(event, index);
              }}
              className={`group relative flex h-full flex-col rounded-2xl border p-5 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 ${
                active
                  ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] shadow-md"
                  : "border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm hover:border-[var(--admin-primary)] hover:shadow-md"
              }`}
            >
              {active ? (
                <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-sm">
                  <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                </span>
              ) : null}
              <span
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                  active
                    ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                    : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)] group-hover:bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] group-hover:text-[var(--admin-primary)]"
                }`}
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span
                className={`text-base font-bold ${active ? "text-[var(--admin-primary)]" : "text-[var(--admin-on-surface)]"}`}
              >
                {option.label}
              </span>
              <span className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                {option.description}
              </span>
              {isSaved ? (
                <span className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-success)]">
                  Current selection
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <section
        aria-labelledby="pricing-setup-heading"
        className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5"
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]">
            <Check className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 id="pricing-setup-heading" className="text-base font-bold text-[var(--admin-on-surface)]">
            Complete your setup
          </h2>
        </div>
        <div className="space-y-1">
          {SETUP_STEP_DEFS.map((step) => {
            const StepIcon = step.icon;
            const status = stepStatus(step.key);
            return (
              <div
                key={step.href}
                className="flex items-center justify-between rounded-xl bg-[var(--admin-surface)] px-4 py-3 transition-colors hover:bg-[var(--admin-surface-high)]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                      status.configured
                        ? "border-[color-mix(in_srgb,var(--admin-success)_40%,var(--admin-border))] text-[var(--admin-success)]"
                        : "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)]"
                    }`}
                  >
                    <StepIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--admin-on-surface)]">{step.label}</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${status.configured ? "bg-[var(--admin-success)]" : "bg-[var(--admin-warning)]"}`}
                        aria-hidden="true"
                      />
                      {status.label}
                    </p>
                  </div>
                </div>
                <Link
                  href={step.href}
                  prefetch={false}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] hover:underline"
                >
                  {status.configured ? "Edit" : "Configure"}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

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
            setSelected(saved);
            setError(null);
          }}
          className="rounded-lg border border-[var(--admin-border)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!dirty || saving || !selected}
          onClick={() => void onSave()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-sm font-bold text-[var(--admin-on-primary)] shadow-sm transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Saving
            </>
          ) : (
            "Save pricing model"
          )}
        </button>
      </div>
    </div>
  );
}
