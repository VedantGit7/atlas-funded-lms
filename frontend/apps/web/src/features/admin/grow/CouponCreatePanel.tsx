"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Info, Sparkles } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  COUPONS_LIST_HREF,
  couponHref,
  dollarInputToCents,
  generateCouponCode,
  type CouponDiscountType,
  type CouponDto,
} from "./coupons-shared";

type BulkResponse = {
  data: {
    createdCount: number;
    items: CouponDto[];
  };
};

function ToggleSwitch(props: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.ariaLabel}
      disabled={props.disabled}
      onClick={() => {
        props.onChange(!props.checked);
      }}
      className={[
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
        props.checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-[var(--admin-surface)] transition-transform duration-200",
          props.checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
        aria-hidden="true"
      />
    </button>
  );
}

export function CouponCreatePanel() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState(false);
  const [code, setCode] = useState("");
  const [prefix, setPrefix] = useState("");
  const [bulkCount, setBulkCount] = useState(10);
  const [discountType, setDiscountType] = useState<CouponDiscountType>("PERCENT");
  const [percentValue, setPercentValue] = useState("10");
  const [fixedDollars, setFixedDollars] = useState("10");
  const [busy, setBusy] = useState(false);

  async function onCreate() {
    if (!name.trim()) {
      toast.error("Internal campaign name is required.");
      return;
    }

    let discountValue: number;
    if (discountType === "PERCENT") {
      discountValue = Math.round(Number(percentValue));
      if (!Number.isFinite(discountValue) || discountValue < 1 || discountValue > 100) {
        toast.error("Enter a percentage between 1 and 100.");
        return;
      }
    } else {
      const cents = dollarInputToCents(fixedDollars);
      if (cents == null || cents < 1) {
        toast.error("Enter a valid fixed discount amount.");
        return;
      }
      discountValue = cents;
    }

    setBusy(true);
    try {
      if (bulk) {
        if (!prefix.trim()) {
          toast.error("Prefix is required for bulk generation.");
          setBusy(false);
          return;
        }
        const count = Math.min(100, Math.max(1, Math.round(bulkCount) || 1));
        const response = await clientApi.post<BulkResponse>(
          "/api/v1/sales/coupons/bulk",
          {
            name: name.trim(),
            prefix: prefix.trim().toUpperCase(),
            count,
            discountType,
            discountValue,
          },
          "coupon-bulk-create",
          { successMessage: `${count} draft coupons created.` },
        );
        const first = response.data.items[0];
        if (first) {
          router.push(couponHref(first.id));
        } else {
          router.push(COUPONS_LIST_HREF);
        }
        return;
      }

      if (!code.trim()) {
        toast.error("Coupon code is required.");
        setBusy(false);
        return;
      }

      const response = await clientApi.post<{ data: CouponDto }>(
        "/api/v1/sales/coupons",
        {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          discountType,
          discountValue,
          appliesToAllCourses: true,
          visibility: "PRIVATE",
          deviceType: "ALL",
          perLearnerLimit: 1,
        },
        "coupon-create",
        { successMessage: "Coupon created as draft." },
      );
      router.push(couponHref(response.data.id));
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not create coupon.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[640px] flex-col justify-center space-y-6 motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
      <Link href={COUPONS_LIST_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" />
        Back to Coupons
      </Link>

      <header>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
          Create Coupon
        </h1>
        <p className="mt-1 text-[16px] text-[var(--admin-on-surface-variant)]">
          Configure a new promotional code or a batch of unique identifiers.
        </p>
      </header>

      <section className="space-y-6 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm">
        <div>
          <label htmlFor="coupon-create-name" className={MESSENGER_WIZARD_LABEL_CLASS}>
            Internal campaign name
          </label>
          <input
            id="coupon-create-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11`}
            placeholder="e.g. Holiday Season 2026"
            maxLength={200}
            disabled={busy}
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
          <div>
            <p className="text-sm font-semibold text-[var(--admin-on-surface)]">Bulk generation</p>
            <p className="mt-0.5 text-[13px] text-[var(--admin-on-surface-variant)]">
              Create multiple unique codes with a shared prefix.
            </p>
          </div>
          <ToggleSwitch
            checked={bulk}
            disabled={busy}
            ariaLabel="Toggle bulk generation"
            onChange={setBulk}
          />
        </div>

        {!bulk ? (
          <div>
            <label htmlFor="coupon-create-code" className={MESSENGER_WIZARD_LABEL_CLASS}>
              Coupon code
            </label>
            <div className="flex gap-2">
              <input
                id="coupon-create-code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                }}
                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 flex-1 font-mono uppercase`}
                placeholder="SUMMER25"
                maxLength={64}
                disabled={busy}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setCode(generateCouponCode());
                }}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--admin-border)] px-4 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
              >
                <Sparkles className="h-4 w-4" />
                Generate
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="coupon-create-prefix" className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Prefix
                </label>
                <input
                  id="coupon-create-prefix"
                  value={prefix}
                  onChange={(event) => {
                    setPrefix(event.target.value.toUpperCase());
                  }}
                  className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 font-mono uppercase`}
                  placeholder="WINTER"
                  maxLength={24}
                  disabled={busy}
                />
              </div>
              <div>
                <label htmlFor="coupon-create-count" className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Number of codes
                </label>
                <input
                  id="coupon-create-count"
                  type="number"
                  min={1}
                  max={100}
                  value={bulkCount}
                  onChange={(event) => {
                    setBulkCount(Number(event.target.value) || 1);
                  }}
                  className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11`}
                  disabled={busy}
                />
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] p-3 text-[var(--admin-on-primary-container)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-[13px]">
                Generate up to 100 unique draft codes with this configuration. Open any code
                afterward to refine scheduling, limits, and course scope.
              </p>
            </div>
          </div>
        )}

        <div className="h-px w-full bg-[var(--admin-border)]" />

        <div className="space-y-4">
          <div>
            <p className={MESSENGER_WIZARD_LABEL_CLASS}>Discount type</p>
            <div className="inline-flex rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDiscountType("PERCENT");
                }}
                className={[
                  "rounded-lg px-5 py-1.5 text-sm font-semibold transition-all",
                  discountType === "PERCENT"
                    ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                    : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
              >
                Percentage
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDiscountType("FIXED");
                }}
                className={[
                  "rounded-lg px-5 py-1.5 text-sm font-semibold transition-all",
                  discountType === "FIXED"
                    ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                    : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
              >
                Fixed amount
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="coupon-create-value" className={MESSENGER_WIZARD_LABEL_CLASS}>
              Value
            </label>
            <div className="relative max-w-[200px]">
              <input
                id="coupon-create-value"
                type="number"
                min={discountType === "PERCENT" ? 1 : 0.01}
                max={discountType === "PERCENT" ? 100 : undefined}
                step={discountType === "PERCENT" ? 1 : 0.01}
                value={discountType === "PERCENT" ? percentValue : fixedDollars}
                onChange={(event) => {
                  if (discountType === "PERCENT") setPercentValue(event.target.value);
                  else setFixedDollars(event.target.value);
                }}
                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 pr-10`}
                disabled={busy}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--admin-on-surface-variant)]">
                {discountType === "PERCENT" ? "%" : "$"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={COUPONS_LIST_HREF}
          prefetch={false}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
        >
          Cancel
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onCreate()}
          className="rounded-lg bg-[var(--admin-primary)] px-7 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-[0_8px_24px_color-mix(in_srgb,var(--admin-primary)_18%,transparent)] transition-all hover:bg-[var(--admin-primary-strong)] active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create & continue"}
        </button>
      </div>
    </div>
  );
}
