"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ClientApiError, clientApi } from "../../lib/client-api";
import { sendAttributionEvent } from "../../lib/attribution/utm-storage";
import {
  formatMoney,
  type PriceBreakdown,
  type PublicCouponDto,
} from "../admin/grow/coupons-shared";

type EnrollCourseDialogProps = {
  courseId: string;
  courseTitle: string;
  /** When true, open checkout (paid) instead of free enroll. */
  isPaid?: boolean;
  priceCents?: number | null;
  currency?: string | null;
};

type QuoteResponse = {
  data: PriceBreakdown & {
    alreadyEnrolled: boolean;
    couponsAllowed: boolean;
    walletEnabled: boolean;
    walletAvailableBalance: number;
    walletCreditValueCents: number;
    walletMaxCreditsPerOrder: number | null;
  };
};

type PurchaseResponse = {
  data: {
    enrollmentId: string;
    paymentOrderId: string;
    created: boolean;
    pricing: PriceBreakdown;
  };
};

export function EnrollCourseDialog({
  courseId,
  courseTitle,
  isPaid = false,
  priceCents = null,
  currency = "USD",
}: EnrollCourseDialogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const affiliateFromUrl = searchParams.get("affiliate")?.trim().toUpperCase() || null;
  const refFromUrl = searchParams.get("ref")?.trim().toUpperCase() || null;
  const urlPrefillCode = affiliateFromUrl ?? refFromUrl ?? "";
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState(urlPrefillCode);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [walletCreditsInput, setWalletCreditsInput] = useState(0);
  const [quote, setQuote] = useState<QuoteResponse["data"] | null>(null);
  const [publicCoupons, setPublicCoupons] = useState<PublicCouponDto[]>([]);
  const [quoting, setQuoting] = useState(false);

  const loadPublicCoupons = useCallback(async () => {
    try {
      const response = await clientApi.get<{ data: { items: PublicCouponDto[] } }>(
        `/api/v1/coupons/public?courseId=${encodeURIComponent(courseId)}`,
        "public-coupons",
      );
      setPublicCoupons(response.data.items);
    } catch {
      setPublicCoupons([]);
    }
  }, [courseId]);

  useEffect(() => {
    if (urlPrefillCode) {
      setCouponCode(urlPrefillCode);
    }
  }, [urlPrefillCode]);

  const refreshQuote = useCallback(
    async (code?: string | null, credits?: number | null) => {
      if (!isPaid) return;
      setQuoting(true);
      setError(null);
      try {
        const trimmedCode = code?.trim() ? code.trim() : null;
        const response = await clientApi.post<QuoteResponse>(
          "/api/v1/checkout/quote",
          {
            courseId,
            couponCode: trimmedCode,
            ...(affiliateFromUrl ? { affiliateCode: affiliateFromUrl } : {}),
            walletCreditsToSpend: credits && credits > 0 ? credits : null,
            deviceType: "WEB",
          },
          "checkout-quote",
        );
        setQuote(response.data);
        setAppliedCode(response.data.coupon?.code ?? null);
        if (response.data.walletEnabled && walletCreditsInput === 0) {
          const max =
            response.data.walletMaxCreditsPerOrder != null
              ? Math.min(
                  response.data.walletAvailableBalance,
                  response.data.walletMaxCreditsPerOrder,
                )
              : response.data.walletAvailableBalance;
          setWalletCreditsInput(max);
        }
      } catch (err) {
        setQuote(null);
        setAppliedCode(null);
        if (err instanceof ClientApiError) {
          setError(err.message);
        } else {
          setError("Unable to price this course.");
        }
      } finally {
        setQuoting(false);
      }
    },
    [affiliateFromUrl, courseId, isPaid, walletCreditsInput],
  );

  useEffect(() => {
    if (!open || !isPaid) return;
    void loadPublicCoupons();
    const initialCode = urlPrefillCode || null;
    void refreshQuote(initialCode, useWallet ? walletCreditsInput : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once
  }, [open, isPaid, loadPublicCoupons]);

  async function handleFreeEnroll() {
    setSubmitting(true);
    setError(null);
    try {
      await clientApi.post("/api/v1/enrollments", { courseId }, "enrollment-create");
      void sendAttributionEvent({ eventType: "enrolled", clearAfterSend: true });
      setOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError) {
        setError(
          err.code === "PAYMENT_REQUIRED"
            ? "This is a paid course. Use checkout to purchase."
            : err.message,
        );
      } else {
        setError("Unable to enroll right now.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePurchase() {
    setSubmitting(true);
    setError(null);
    try {
      await clientApi.post<PurchaseResponse>(
        "/api/v1/checkout/purchase",
        {
          courseId,
          couponCode: appliedCode,
          ...(affiliateFromUrl ? { affiliateCode: affiliateFromUrl } : {}),
          walletCreditsToSpend: useWallet ? walletCreditsInput : null,
          deviceType: "WEB",
        },
        "checkout-purchase",
        { successMessage: "Purchase complete. You are enrolled." },
      );
      void sendAttributionEvent({ eventType: "enrolled", clearAfterSend: true });
      setOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError) {
        setError(err.message);
      } else {
        setError("Unable to complete purchase.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApplyCoupon() {
    await refreshQuote(couponCode, useWallet ? walletCreditsInput : 0);
  }

  function selectPublicCoupon(code: string) {
    setCouponCode(code);
    void refreshQuote(code, useWallet ? walletCreditsInput : 0);
  }

  const displayCurrency = quote?.currency ?? currency ?? "USD";
  const original =
    quote?.originalAmountCents ?? (typeof priceCents === "number" ? priceCents : null);
  const final = quote?.finalAmountCents ?? original;
  const discount = quote?.discountCents ?? 0;
  const walletDiscount = quote?.walletDiscountCents ?? 0;
  const walletCreditsApplied = quote?.walletCreditsApplied ?? 0;

  return (
    <>
      <button
        type="button"
        className="rounded-md border px-4 py-2 text-sm font-medium"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
      >
        {isPaid ? "Buy now" : "Enroll"}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => {
            if (!submitting) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="enroll-course-title"
            className="w-full max-w-md rounded-lg border bg-white p-6 shadow-lg"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2 id="enroll-course-title" className="text-lg font-semibold">
              {isPaid ? "Checkout" : "Confirm enrollment"}
            </h2>
            <p className="mt-2 text-sm opacity-80">
              {isPaid ? (
                <>
                  Purchase <strong>{courseTitle}</strong>
                </>
              ) : (
                <>
                  Enroll in <strong>{courseTitle}</strong>?
                </>
              )}
            </p>

            {isPaid ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-md border bg-slate-50 p-3 text-sm">
                  {quoting && !quote ? (
                    <p>Loading price…</p>
                  ) : (
                    <>
                      {original != null ? (
                        <div className="flex justify-between gap-3">
                          <span>Price</span>
                          <span
                            className={
                              discount > 0 || walletDiscount > 0
                                ? "line-through opacity-60"
                                : "font-medium"
                            }
                          >
                            {formatMoney(original, displayCurrency)}
                          </span>
                        </div>
                      ) : null}
                      {discount > 0 ? (
                        <div className="mt-1 flex justify-between gap-3 text-emerald-700">
                          <span>Coupon{appliedCode ? ` (${appliedCode})` : ""}</span>
                          <span>-{formatMoney(discount, displayCurrency)}</span>
                        </div>
                      ) : null}
                      {walletDiscount > 0 ? (
                        <div className="mt-1 flex justify-between gap-3 text-emerald-700">
                          <span>Wallet ({walletCreditsApplied} credits)</span>
                          <span>-{formatMoney(walletDiscount, displayCurrency)}</span>
                        </div>
                      ) : null}
                      {final != null ? (
                        <div className="mt-2 flex justify-between gap-3 border-t pt-2 font-semibold">
                          <span>Total</span>
                          <span>{formatMoney(final, displayCurrency)}</span>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                {publicCoupons.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                      Available coupons
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {publicCoupons.map((coupon) => (
                        <button
                          key={coupon.id}
                          type="button"
                          className="rounded border px-2 py-1 text-xs font-medium hover:bg-slate-50"
                          onClick={() => selectPublicCoupon(coupon.code)}
                        >
                          {coupon.code}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                    placeholder="Coupon code"
                    className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm font-mono"
                    maxLength={64}
                  />
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm"
                    disabled={quoting || submitting}
                    onClick={() => {
                      void handleApplyCoupon();
                    }}
                  >
                    Apply
                  </button>
                </div>
                {appliedCode ? (
                  <button
                    type="button"
                    className="text-xs underline opacity-70"
                    onClick={() => {
                      setCouponCode("");
                      void refreshQuote(null, useWallet ? walletCreditsInput : 0);
                    }}
                  >
                    Remove coupon
                  </button>
                ) : null}

                {quote?.walletEnabled && quote.walletAvailableBalance > 0 ? (
                  <div className="space-y-2 rounded-md border p-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={useWallet}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setUseWallet(next);
                          void refreshQuote(
                            appliedCode,
                            next ? walletCreditsInput : 0,
                          );
                        }}
                      />
                      Use wallet credits ({quote.walletAvailableBalance} available)
                    </label>
                    {useWallet ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={quote.walletAvailableBalance}
                          value={walletCreditsInput}
                          onChange={(e) => setWalletCreditsInput(Number(e.target.value) || 0)}
                          className="w-28 rounded-md border px-2 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          className="rounded-md border px-2 py-1.5 text-xs"
                          disabled={quoting}
                          onClick={() => {
                            void refreshQuote(appliedCode, walletCreditsInput);
                          }}
                        >
                          Update
                        </button>
                        <span className="text-xs opacity-70">
                          1 credit ={" "}
                          {formatMoney(quote.walletCreditValueCents, quote.currency)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm"
                disabled={submitting}
                onClick={() => {
                  setOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm font-medium"
                disabled={submitting || (isPaid && quoting)}
                onClick={() => {
                  if (isPaid) {
                    void handlePurchase();
                  } else {
                    void handleFreeEnroll();
                  }
                }}
              >
                {submitting
                  ? isPaid
                    ? "Purchasing..."
                    : "Enrolling..."
                  : isPaid
                    ? "Pay & enroll"
                    : "Confirm enrollment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
