import type { TenantTx } from "@atlas/db";
import { getLearnerBillingConfigRow } from "@atlas/domain-config/repositories/learner-billing.repository";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { findCourseAuthProjection, readCoursePricing } from "../courses/courses.repository";
import { courseNotFound } from "../courses/courses.errors";
import { findActiveEnrollment } from "../enrollments/enrollments.repository";
import {
  checkoutQuoteBodySchema,
  checkoutQuoteResponseSchema,
  publicCouponsForCourseQuerySchema,
  publicCouponsForCourseResponseSchema,
  validateCouponBodySchema,
  validateCouponResponseSchema,
} from "./sales-coupons.schemas";
import { salesCouponsRepository, type CouponRow } from "./sales-coupons.repository";
import { normalizeCode, validationError } from "./coupon-rules";
import { previewWalletSpend } from "../sales-wallet/sales-wallet.service";
import { resolveAffiliateForCheckout } from "../sales-affiliates/sales-affiliates.service";
import type { ResolveAffiliateCheckoutResult } from "../sales-affiliates/sales-affiliates.schemas";

/**
 * Pricing a course checkout: the course price, coupon or affiliate discount,
 * wallet credits and tax. Shared by the quote, the coupon check and the purchase.
 */

function computeDiscountCents(args: {
  originalAmountCents: number;
  discountType: string;
  discountValue: number;
  maxDiscountCents: number | null;
}): number {
  let discount =
    args.discountType === "PERCENT"
      ? Math.floor((args.originalAmountCents * args.discountValue) / 100)
      : args.discountValue;

  if (args.maxDiscountCents != null) {
    discount = Math.min(discount, args.maxDiscountCents);
  }
  discount = Math.max(0, Math.min(discount, args.originalAmountCents));
  return discount;
}

type ApplyCouponResult = {
  coupon: CouponRow;
  discountCents: number;
  originalAmountCents: number;
  finalAmountCents: number;
  currency: string;
};

export async function resolveCoursePrice(tx: TenantTx, courseId: string) {
  const course = await findCourseAuthProjection({ tx, courseId });
  if (!course) throw courseNotFound();
  if (course.status !== "PUBLISHED") {
    throw validationError("Course is not available for purchase.");
  }
  const pricing = readCoursePricing(course.metadataJson);
  if (pricing.accessTier !== "PAID") {
    throw validationError("This course is free and does not require checkout.");
  }
  if (pricing.priceCents == null || pricing.priceCents < 0) {
    throw validationError("Course price is not configured.");
  }
  const currency = (pricing.currency ?? "USD").toUpperCase();
  return {
    course,
    originalAmountCents: pricing.priceCents,
    currency,
  };
}

/**
 * How long an open checkout holds a use of its coupon (audit M1). Matches the
 * lifetime of a Stripe Checkout session; an order paid later than this is
 * still honoured at fulfilment, and recorded if it takes the coupon over.
 */
const COUPON_RESERVATION_HOURS = 24;

/**
 * Refuses a coupon whose uses are all redeemed or held by open checkouts.
 * With `lock` the coupon row stays locked until the transaction ends, so the
 * order created next is counted by any checkout that runs after it.
 */
export async function assertCouponHasFreeUse(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: { couponId: string; courseId: string; lock: boolean },
): Promise<void> {
  const uses = await salesCouponsRepository.countCouponUses(tx, {
    couponId: args.couponId,
    membershipId: ctx.actorMembershipId,
    courseId: args.courseId,
    reservationHours: COUPON_RESERVATION_HOURS,
    lock: args.lock,
  });
  if (!uses) {
    throw validationError("Invalid or inactive coupon code.");
  }
  if (uses.totalUsageLimit != null && uses.totalUses >= uses.totalUsageLimit) {
    throw validationError("This coupon has reached its usage limit.");
  }
  if (uses.memberUses >= uses.perLearnerLimit) {
    throw validationError("You have already used this coupon the maximum number of times.");
  }
}

async function applyCouponToPrice(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    code: string;
    courseId: string;
    originalAmountCents: number;
    currency: string;
    deviceType: "ALL" | "WEB" | "MOBILE";
  },
): Promise<ApplyCouponResult> {
  const code = normalizeCode(args.code);
  const coupon = await salesCouponsRepository.findByCode(tx, code);
  if (!coupon || coupon.status !== "ACTIVE") {
    throw validationError("Invalid or inactive coupon code.");
  }

  const now = new Date();
  if (coupon.starts_at && coupon.starts_at > now) {
    throw validationError("This coupon is not active yet.");
  }
  if (coupon.ends_at && coupon.ends_at < now) {
    throw validationError("This coupon has expired.");
  }

  if (coupon.device_type !== "ALL" && coupon.device_type !== args.deviceType) {
    throw validationError("This coupon cannot be used on this device.");
  }

  if (coupon.currency.toUpperCase() !== args.currency.toUpperCase()) {
    throw validationError("This coupon does not apply to this currency.");
  }

  if (coupon.min_purchase_cents != null && args.originalAmountCents < coupon.min_purchase_cents) {
    throw validationError("Order total is below the coupon minimum purchase.");
  }

  const applies = await salesCouponsRepository.couponAppliesToCourse(tx, {
    couponId: coupon.id,
    courseId: args.courseId,
    appliesToAll: coupon.applies_to_all_courses,
  });
  if (!applies) {
    throw validationError("This coupon does not apply to this course.");
  }

  // Advisory here; planCheckoutPurchase repeats it under the coupon's lock.
  await assertCouponHasFreeUse(tx, ctx, {
    couponId: coupon.id,
    courseId: args.courseId,
    lock: false,
  });

  const discountCents = computeDiscountCents({
    originalAmountCents: args.originalAmountCents,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    maxDiscountCents: coupon.max_discount_cents,
  });

  return {
    coupon,
    discountCents,
    originalAmountCents: args.originalAmountCents,
    finalAmountCents: args.originalAmountCents - discountCents,
    currency: args.currency,
  };
}

function computeTaxCents(args: {
  amountCents: number;
  gstEnabled: boolean;
  gstPercentage: number | null;
}): number {
  if (!args.gstEnabled || args.gstPercentage == null || args.gstPercentage <= 0) {
    return 0;
  }
  return Math.max(0, Math.round((args.amountCents * args.gstPercentage) / 100));
}

export async function resolveCheckoutTax(tx: TenantTx, amountAfterDiscountsCents: number) {
  const billing = await getLearnerBillingConfigRow(tx);
  const taxAmountCents = computeTaxCents({
    amountCents: amountAfterDiscountsCents,
    gstEnabled: billing?.gst_enabled ?? false,
    gstPercentage: billing?.gst_percentage ?? null,
  });
  return {
    taxAmountCents,
    finalAmountCents: Math.max(0, amountAfterDiscountsCents + taxAmountCents),
  };
}

export function toBreakdown(args: {
  courseId: string;
  courseTitle: string;
  currency: string;
  originalAmountCents: number;
  discountCents: number;
  walletCreditsApplied?: number;
  walletDiscountCents?: number;
  taxAmountCents?: number;
  finalAmountCents: number;
  coupon: CouponRow | null;
  affiliateCode?: string | null;
}) {
  return {
    courseId: args.courseId,
    courseTitle: args.courseTitle,
    currency: args.currency,
    originalAmountCents: args.originalAmountCents,
    discountCents: args.discountCents,
    walletCreditsApplied: args.walletCreditsApplied ?? 0,
    walletDiscountCents: args.walletDiscountCents ?? 0,
    taxAmountCents: args.taxAmountCents ?? 0,
    finalAmountCents: args.finalAmountCents,
    affiliateCode: args.affiliateCode ?? null,
    coupon: args.coupon
      ? {
          id: args.coupon.id,
          code: args.coupon.code,
          name: args.coupon.name,
          discountType: args.coupon.discount_type as "PERCENT" | "FIXED",
          discountValue: args.coupon.discount_value,
        }
      : null,
  };
}

type CheckoutDiscountResult = {
  discountCents: number;
  amountAfterDiscount: number;
  coupon: CouponRow | null;
  affiliate: ResolveAffiliateCheckoutResult | null;
};

export async function resolveCheckoutDiscount(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    courseId: string;
    originalAmountCents: number;
    currency: string;
    deviceType: "ALL" | "WEB" | "MOBILE";
    couponCode?: string | null;
    affiliateCode?: string | null;
  },
): Promise<CheckoutDiscountResult> {
  const effectiveCode = args.affiliateCode ?? args.couponCode ?? null;
  let discountCents = 0;
  let amountAfterDiscount = args.originalAmountCents;
  let coupon: CouponRow | null = null;

  if (effectiveCode) {
    const affiliate = await resolveAffiliateForCheckout(tx, {
      code: effectiveCode,
      courseId: args.courseId,
      buyerMembershipId: ctx.actorMembershipId,
      originalAmountCents: args.originalAmountCents,
    });

    if (affiliate) {
      return {
        discountCents: affiliate.discountCents,
        amountAfterDiscount: args.originalAmountCents - affiliate.discountCents,
        coupon: null,
        affiliate,
      };
    }

    // Explicit affiliateCode that did not resolve (inactive / wrong product).
    if (args.affiliateCode) {
      throw validationError("This affiliate code is invalid or cannot be used for this product.");
    }

    if (args.couponCode) {
      const applied = await applyCouponToPrice(tx, ctx, {
        code: args.couponCode,
        courseId: args.courseId,
        originalAmountCents: args.originalAmountCents,
        currency: args.currency,
        deviceType: args.deviceType,
      });
      discountCents = applied.discountCents;
      amountAfterDiscount = applied.finalAmountCents;
      coupon = applied.coupon;
    }
  }

  return { discountCents, amountAfterDiscount, coupon, affiliate: null };
}

export async function validateCouponForLearner(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = validateCouponBodySchema.parse(rawBody);
  const { course, originalAmountCents, currency } = await resolveCoursePrice(tx, body.courseId);
  const applied = await applyCouponToPrice(tx, ctx, {
    code: body.code,
    courseId: body.courseId,
    originalAmountCents,
    currency,
    deviceType: body.deviceType,
  });
  return validateCouponResponseSchema.parse({
    data: toBreakdown({
      courseId: course.id,
      courseTitle: course.title,
      currency,
      originalAmountCents: applied.originalAmountCents,
      discountCents: applied.discountCents,
      finalAmountCents: applied.finalAmountCents,
      coupon: applied.coupon,
    }),
  });
}

export async function listPublicCouponsForCourse(
  tx: TenantTx,
  _ctx: ServiceCtx,
  rawQuery: unknown,
) {
  const query = publicCouponsForCourseQuerySchema.parse(rawQuery);
  const course = await findCourseAuthProjection({ tx, courseId: query.courseId });
  if (!course) throw courseNotFound();
  const rows = await salesCouponsRepository.listPublicForCourse(tx, query.courseId);
  return publicCouponsForCourseResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        discountType: row.discount_type as "PERCENT" | "FIXED",
        discountValue: row.discount_value,
        maxDiscountCents: row.max_discount_cents,
        currency: row.currency,
      })),
    },
  });
}

export async function quoteCheckout(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = checkoutQuoteBodySchema.parse(rawBody);
  const { course, originalAmountCents, currency } = await resolveCoursePrice(tx, body.courseId);

  const existing = await findActiveEnrollment({
    tx,
    courseId: body.courseId,
    membershipId: ctx.actorMembershipId,
  });

  const {
    discountCents,
    amountAfterDiscount: amountAfterCoupon,
    coupon,
    affiliate,
  } = await resolveCheckoutDiscount(tx, ctx, {
    courseId: body.courseId,
    originalAmountCents,
    currency,
    deviceType: body.deviceType,
    ...(body.couponCode != null ? { couponCode: body.couponCode } : {}),
    ...(body.affiliateCode != null ? { affiliateCode: body.affiliateCode } : {}),
  });

  const walletPreview = await previewWalletSpend(tx, {
    membershipId: ctx.actorMembershipId,
    creditsRequested: body.walletCreditsToSpend ?? 0,
    maxSpendableMoneyCents: amountAfterCoupon,
  });

  const amountAfterWallet = Math.max(0, amountAfterCoupon - walletPreview.discountCents);
  const { taxAmountCents, finalAmountCents } = await resolveCheckoutTax(tx, amountAfterWallet);

  return checkoutQuoteResponseSchema.parse({
    data: {
      ...toBreakdown({
        courseId: course.id,
        courseTitle: course.title,
        currency,
        originalAmountCents,
        discountCents,
        walletCreditsApplied: walletPreview.creditsApplied,
        walletDiscountCents: walletPreview.discountCents,
        taxAmountCents,
        finalAmountCents,
        coupon,
        affiliateCode: affiliate?.affiliate.coupon_code ?? null,
      }),
      alreadyEnrolled: Boolean(existing),
      couponsAllowed: true,
      walletEnabled: walletPreview.enabled,
      walletAvailableBalance: walletPreview.availableBalance,
      walletCreditValueCents: walletPreview.creditValueCents,
      walletMaxCreditsPerOrder: walletPreview.maxCreditsPerOrder,
    },
  });
}
