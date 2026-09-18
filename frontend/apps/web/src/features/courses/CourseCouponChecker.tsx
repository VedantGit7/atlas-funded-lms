"use client";

import { useState } from "react";
import { TicketPercent } from "lucide-react";
import { ClientApiError, clientApi } from "../../lib/client-api";

type PriceBreakdown = {
  courseId: string;
  courseTitle: string;
  currency: string;
  originalAmountCents: number;
  discountCents: number;
  finalAmountCents: number;
  coupon: {
    id: string;
    code: string;
    name: string;
    discountType: string;
    discountValue: number;
  } | null;
};

function money(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    // An unrecognised currency code must not blank the result.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Check a coupon against this course before starting checkout.
 *
 * Distinct from `POST /api/v1/checkout/quote`, which the enrol dialog calls:
 * quote prices a whole intended purchase (coupon + wallet credits + affiliate +
 * tax) and belongs inside the buying flow. This answers the narrower question a
 * visitor asks first — "is this code I was given actually valid here, and what
 * would it save me?" — without committing them to the dialog.
 *
 * `enrollment.create` is the permission, so this appears for a signed-in learner
 * who could enrol; the error from the API is surfaced verbatim because "expired",
 * "usage limit reached" and "not valid for this course" are genuinely different
 * answers and a generic failure message would hide which one applies.
 */
export function CourseCouponChecker({ courseId }: { courseId: string }) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck(event: React.SyntheticEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setChecking(true);
    setError(null);
    setBreakdown(null);
    try {
      const response = await clientApi.post<{ data: PriceBreakdown }>(
        "/api/v1/coupons/validate",
        { code: trimmed, courseId, deviceType: "WEB" },
        `coupon-validate-${courseId}`,
      );
      setBreakdown(response.data);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "That code could not be checked.",
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <TicketPercent className="h-4 w-4 shrink-0" aria-hidden="true" />
        Have a coupon?
      </h3>

      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => void handleCheck(e)}>
        <label className="block text-sm">
          <span className="sr-only">Coupon code</span>
          <input
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground uppercase outline-none focus:border-primary"
            placeholder="CODE"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
            }}
            required
          />
        </label>
        <button
          type="submit"
          disabled={checking}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          {checking ? "Checking…" : "Check code"}
        </button>
      </form>

      {error === null ? null : (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {breakdown === null ? null : (
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted-foreground)]">Price</dt>
            <dd className="tabular-nums text-foreground">
              {money(breakdown.originalAmountCents, breakdown.currency)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted-foreground)]">
              Discount{breakdown.coupon === null ? "" : ` (${breakdown.coupon.code})`}
            </dt>
            <dd className="tabular-nums text-foreground">
              −{money(breakdown.discountCents, breakdown.currency)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-1">
            <dt className="font-semibold text-foreground">You pay</dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {money(breakdown.finalAmountCents, breakdown.currency)}
            </dd>
          </div>
          <p className="pt-2 text-xs text-[var(--muted-foreground)]">
            Wallet credits and any affiliate discount are applied at checkout.
          </p>
        </dl>
      )}
    </section>
  );
}
