import { auditWriter } from "@atlas/audit";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { structuredLogger } from "@atlas/observability/logger";
import {
  findActiveEnrollment,
  insertEnrollment,
  publishEnrollmentCreatedEvent,
} from "../enrollments/enrollments.repository";
import { salesCouponsRepository } from "./sales-coupons.repository";
import { validationError } from "./coupon-rules";
import { spendWalletCredits } from "../sales-wallet/sales-wallet.service";
import { applyReferralPurchaseCredits } from "../sales-referrals/sales-referrals.service";
import { applyAffiliateCommission } from "../sales-affiliates/sales-affiliates.service";

/**
 * Fulfilling a paid course order: marking it paid, applying its one-time
 * effects (wallet, coupon, referral, affiliate) and enrolling the learner,
 * whether paid through a gateway webhook or at $0 during checkout.
 */

export type CourseCheckoutMetadata = {
  kind: "course_checkout";
  courseId: string;
  courseTitle: string;
  productTitle: string;
  productType: "course";
  couponId: string | null;
  couponCode: string | null;
  affiliateId: string | null;
  affiliateCode: string | null;
  affiliateCommissionPct: number | null;
  originalAmountCents: number;
  discountCents: number;
  walletCreditsApplied: number;
  walletDiscountCents: number;
  taxAmountCents: number;
  amountAfterCouponCents: number;
  finalAmountCents: number;
  fulfillmentApplied?: boolean;
};

function asCheckoutMetadata(value: unknown): CourseCheckoutMetadata | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record["kind"] !== "course_checkout") return null;
  if (typeof record["courseId"] !== "string") return null;
  return {
    kind: "course_checkout",
    courseId: record["courseId"],
    courseTitle: typeof record["courseTitle"] === "string" ? record["courseTitle"] : "",
    productTitle: typeof record["productTitle"] === "string" ? record["productTitle"] : "",
    productType: "course",
    couponId: typeof record["couponId"] === "string" ? record["couponId"] : null,
    couponCode: typeof record["couponCode"] === "string" ? record["couponCode"] : null,
    affiliateId: typeof record["affiliateId"] === "string" ? record["affiliateId"] : null,
    affiliateCode: typeof record["affiliateCode"] === "string" ? record["affiliateCode"] : null,
    affiliateCommissionPct:
      typeof record["affiliateCommissionPct"] === "number"
        ? record["affiliateCommissionPct"]
        : null,
    originalAmountCents: Number(record["originalAmountCents"] ?? 0),
    discountCents: Number(record["discountCents"] ?? 0),
    walletCreditsApplied: Number(record["walletCreditsApplied"] ?? 0),
    walletDiscountCents: Number(record["walletDiscountCents"] ?? 0),
    taxAmountCents: Number(record["taxAmountCents"] ?? 0),
    amountAfterCouponCents: Number(
      record["amountAfterCouponCents"] ??
        Number(record["originalAmountCents"] ?? 0) - Number(record["discountCents"] ?? 0),
    ),
    finalAmountCents: Number(record["finalAmountCents"] ?? 0),
    fulfillmentApplied: record["fulfillmentApplied"] === true,
  };
}

export async function allocateInvoiceNumber(tx: TenantTx, paymentOrderId: string): Promise<string> {
  const invoiceRows = await tx.$queryRawUnsafe<
    Array<{ prefix: string | null; next_number: number | null }>
  >(
    `
    update learner_billing_config
    set
      invoice_next_number = coalesce(invoice_next_number, 1) + 1,
      updated_at = now()
    where tenant_id = app.current_tenant_id()
    returning
      invoice_prefix as prefix,
      (invoice_next_number - 1) as next_number
    `,
  );
  const invoiceRow = invoiceRows[0];
  const invoicePrefix =
    (invoiceRow?.prefix?.trim() || "INV").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) || "INV";
  return invoiceRow?.next_number != null
    ? `${invoicePrefix}-${String(invoiceRow.next_number).padStart(5, "0")}`
    : `INV-${paymentOrderId.slice(0, 8).toUpperCase()}`;
}

type PaymentOrderFulfillRow = {
  id: string;
  membership_id: string | null;
  external_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  metadata_json: unknown;
  invoice_number: string | null;
  tax_amount_cents: number | null;
  coupon_amount_cents: number | null;
};

export async function findPaymentOrderById(
  tx: TenantTx,
  paymentOrderId: string,
): Promise<PaymentOrderFulfillRow | null> {
  const rows = await tx.$queryRawUnsafe<PaymentOrderFulfillRow[]>(
    `
    select
      id::text,
      membership_id::text,
      external_id,
      amount_cents,
      currency,
      status,
      metadata_json,
      invoice_number,
      tax_amount_cents,
      coupon_amount_cents
    from payment_orders
    where id = $1::uuid
    limit 1
    `,
    paymentOrderId,
  );
  return rows[0] ?? null;
}

/**
 * Up to two orders carrying `externalId`. Two means the reference is ambiguous (manually
 * recorded payments may reuse a reference), which the caller must treat as "no match".
 */
async function findPaymentOrdersByExternalId(
  tx: TenantTx,
  externalId: string,
): Promise<PaymentOrderFulfillRow[]> {
  return await tx.$queryRawUnsafe<PaymentOrderFulfillRow[]>(
    `
    select
      id::text,
      membership_id::text,
      external_id,
      amount_cents,
      currency,
      status,
      metadata_json,
      invoice_number,
      tax_amount_cents,
      coupon_amount_cents
    from payment_orders
    where external_id = $1
    limit 2
    `,
    externalId,
  );
}

/**
 * A paid order for a course the learner already holds. The money was taken,
 * so the order stays paid; it is marked for refund, audited, and logged at
 * error level so it reaches whoever handles refunds. Refunding it through the
 * normal refund flow does not revoke access unless the operator asks.
 */
async function flagDuplicatePayment(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: { order: PaymentOrderFulfillRow; enrollmentId: string },
): Promise<void> {
  await tx.$executeRawUnsafe(
    `
    update payment_orders
    set metadata_json = coalesce(metadata_json, '{}'::jsonb)
          || jsonb_build_object(
            'duplicatePayment',
            jsonb_build_object('existingEnrollmentId', $2::text, 'refundRequired', true, 'detectedAt', now())
          ),
        updated_at = now()
    where id = $1::uuid
    `,
    args.order.id,
    args.enrollmentId,
  );

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "checkout.order.duplicate_payment",
      target: { type: "payment_order", id: args.order.id },
      before: null,
      after: { refundRequired: true, existingEnrollmentId: args.enrollmentId },
      reason: "Paid for a course the learner already holds; refund required.",
      metadata: {
        amountCents: args.order.amount_cents,
        currency: args.order.currency,
        membershipId: args.order.membership_id,
      },
    },
  );

  structuredLogger.error({
    message: "Duplicate course payment received; order marked for refund.",
    module: "payments.fulfilment",
    eventType: "payment.duplicate_detected",
    errorCode: "PAYMENT_DUPLICATE",
    paymentOrderId: args.order.id,
    amountCents: args.order.amount_cents,
    currency: args.order.currency,
  });
}

/**
 * Records the coupon on a paid order (audit M1).
 *
 * This used to re-check the coupon's limits here and throw, after the learner
 * had paid: the webhook failed, the gateway retried forever, and the learner
 * was charged the discounted price with no course. Limits are now enforced
 * when the order is created (a coupon's open checkouts hold its uses), so a
 * paid order always keeps the price it was sold at. Going over a limit is
 * still possible (an open order paid after its reservation lapsed, or orders
 * from before reservations), so that is recorded for review, never refused.
 */
async function redeemCouponForPaidOrder(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    order: PaymentOrderFulfillRow;
    metadata: CourseCheckoutMetadata & { couponId: string; couponCode: string };
    membershipId: string;
  },
): Promise<void> {
  const { order, metadata, membershipId } = args;
  const audit = {
    tenantId: ctx.tenantId,
    actorMembershipId: ctx.actorMembershipId,
    platformPrincipalId: null,
    requestId: ctx.requestId,
  };

  // The row lock serialises redemptions of the coupon, so the counts are exact.
  const limits = await salesCouponsRepository.lockCouponForRedemption(tx, {
    couponId: metadata.couponId,
    membershipId,
  });

  if (!limits) {
    // Deleted after the order was priced. There is nothing to attach a
    // redemption to; the order keeps its discount.
    await auditWriter.write(tx, audit, {
      action: "coupon.redemption_skipped",
      target: { type: "payment_order", id: order.id },
      before: null,
      after: { couponId: metadata.couponId, couponCode: metadata.couponCode },
      reason: "Coupon was deleted before the order was paid; discount honoured.",
      metadata: { discountCents: metadata.discountCents, membershipId },
    });
    structuredLogger.warn({
      message: "Paid order used a coupon that no longer exists; discount honoured.",
      module: "payments.fulfilment",
      eventType: "coupon.redemption_skipped",
      requestId: ctx.requestId,
      paymentOrderId: order.id,
      couponId: metadata.couponId,
    });
    return;
  }

  await salesCouponsRepository.insertRedemption(tx, {
    couponId: metadata.couponId,
    membershipId,
    courseId: metadata.courseId,
    paymentOrderId: order.id,
    discountCents: metadata.discountCents,
    originalAmountCents: metadata.originalAmountCents,
    finalAmountCents: metadata.finalAmountCents,
    currency: order.currency,
    codeSnapshot: metadata.couponCode,
  });

  const overTotal =
    limits.totalUsageLimit != null && limits.totalRedemptions >= limits.totalUsageLimit;
  const overLearner = limits.memberRedemptions >= limits.perLearnerLimit;
  if (!overTotal && !overLearner) return;

  const exceeded = [overTotal ? "total" : null, overLearner ? "per_learner" : null].filter(
    (value): value is string => value !== null,
  );
  await auditWriter.write(tx, audit, {
    action: "coupon.redeemed_over_limit",
    target: { type: "sales_coupon", id: metadata.couponId },
    before: {
      totalRedemptions: limits.totalRedemptions,
      memberRedemptions: limits.memberRedemptions,
    },
    after: {
      totalRedemptions: limits.totalRedemptions + 1,
      memberRedemptions: limits.memberRedemptions + 1,
    },
    reason: "Paid order honoured although the coupon was over its limit.",
    metadata: {
      paymentOrderId: order.id,
      membershipId,
      exceeded,
      totalUsageLimit: limits.totalUsageLimit,
      perLearnerLimit: limits.perLearnerLimit,
      discountCents: metadata.discountCents,
    },
  });
  structuredLogger.warn({
    message: "Coupon redeemed over its limit by a paid order; discount honoured.",
    module: "payments.fulfilment",
    eventType: "coupon.redeemed_over_limit",
    requestId: ctx.requestId,
    paymentOrderId: order.id,
    couponId: metadata.couponId,
    exceeded,
  });
}

/**
 * Marks a course PaymentOrder paid and enrolls the learner.
 * Idempotent on already-paid orders / existing enrollments.
 */
export async function fulfillPaidCourseOrder(
  tx: TenantTx,
  ctx: ServiceCtx,
  order: PaymentOrderFulfillRow,
): Promise<{ enrollmentId: string; created: boolean; paymentOrderId: string }> {
  const metadata = asCheckoutMetadata(order.metadata_json);
  if (!metadata) {
    throw validationError("Payment order is missing course checkout metadata.");
  }
  if (!order.membership_id) {
    throw validationError("Payment order has no buyer membership.");
  }

  const membershipId = order.membership_id;
  const alreadyPaid = order.status === "paid" || metadata.fulfillmentApplied === true;

  if (!alreadyPaid) {
    const invoiceNumber = order.invoice_number ?? (await allocateInvoiceNumber(tx, order.id));

    const claimed = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `
      update payment_orders
      set
        status = 'paid',
        paid_at = coalesce(paid_at, now()),
        invoice_number = coalesce(invoice_number, $2),
        metadata_json = coalesce(metadata_json, '{}'::jsonb) || $3::jsonb,
        updated_at = now()
      where id = $1::uuid
        and status <> 'paid'
      returning id::text
      `,
      order.id,
      invoiceNumber,
      JSON.stringify({ fulfillmentApplied: true }),
    );

    // Only the winner of the claim applies one-time side effects (wallet/coupon/affiliates).
    if (claimed.length > 0) {
      // Audit M4: a learner who is already enrolled bought nothing with this
      // payment (two open orders, both paid; or access granted another way).
      // Record it for a refund rather than spending wallet credits, redeeming
      // the coupon and paying commission a second time.
      const enrolled = await findActiveEnrollment({
        tx,
        courseId: metadata.courseId,
        membershipId,
      });
      if (enrolled) {
        await flagDuplicatePayment(tx, ctx, { order, enrollmentId: enrolled.id });
        return { enrollmentId: enrolled.id, created: false, paymentOrderId: order.id };
      }

      if (metadata.walletCreditsApplied > 0) {
        await spendWalletCredits(tx, {
          membershipId,
          credits: metadata.walletCreditsApplied,
          maxSpendableMoneyCents: metadata.amountAfterCouponCents,
          paymentOrderId: order.id,
          courseId: metadata.courseId,
        });
      }

      if (metadata.couponId && metadata.couponCode) {
        const existingRedemption = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `
          select id::text
          from sales_coupon_redemptions
          where payment_order_id = $1::uuid
          limit 1
          `,
          order.id,
        );
        if (existingRedemption.length === 0) {
          await redeemCouponForPaidOrder(tx, ctx, {
            order,
            metadata: { ...metadata, couponId: metadata.couponId, couponCode: metadata.couponCode },
            membershipId,
          });
        }
      }

      await applyReferralPurchaseCredits(tx, {
        refereeMembershipId: membershipId,
        paymentOrderId: order.id,
      });

      if (metadata.affiliateCode) {
        await applyAffiliateCommission(tx, {
          paymentOrderId: order.id,
          buyerMembershipId: membershipId,
          courseId: metadata.courseId,
          code: metadata.affiliateCode,
          orderAmountCents: metadata.amountAfterCouponCents,
          discountCents: metadata.discountCents,
          currency: order.currency,
        });
      }
    }
  }

  const created = await insertEnrollment({
    tx,
    tenantId: ctx.tenantId,
    courseId: metadata.courseId,
    membershipId,
    enrolledType: "paid",
  });

  if (created.created) {
    await publishEnrollmentCreatedEvent({
      tx,
      ctx: {
        ...ctx,
        actorMembershipId: membershipId,
      },
      enrollmentId: created.id,
      courseId: metadata.courseId,
      membershipId,
    });
  }

  return {
    enrollmentId: created.id,
    created: created.created,
    paymentOrderId: order.id,
  };
}

/** What a signature-verified gateway webhook says was actually captured. */
export type VerifiedGatewayPayment = {
  /** The gateway reference the server stored on the order at checkout. */
  externalId: string;
  /** Captured amount in minor units, as reported by the gateway. */
  amountCents: number | null | undefined;
  /** Captured currency, as reported by the gateway. */
  currency: string | null | undefined;
};

function describePaymentMismatch(
  order: PaymentOrderFulfillRow,
  payment: VerifiedGatewayPayment,
): string | null {
  if (payment.amountCents == null || !payment.currency) {
    return "gateway did not report the captured amount and currency";
  }
  if (payment.amountCents !== order.amount_cents) {
    return "captured amount differs from the order amount";
  }
  if (payment.currency.toUpperCase() !== order.currency.toUpperCase()) {
    return "captured currency differs from the order currency";
  }
  return null;
}

/**
 * Fulfils the course order that a signature-verified gateway webhook paid for.
 *
 * Audit finding C1: this used to select the order by a `paymentOrderId` carried in the webhook,
 * which on Razorpay came from Checkout.js notes that the browser controls, and then re-bound that
 * order to the paid gateway reference. Paying for a cheap order could therefore fulfil an
 * expensive one.
 *
 * Now the order is selected only by the gateway reference the server stored at checkout, the
 * reference is never rewritten, and the captured amount and currency must equal what the order
 * charged. Anything else is left unfulfilled, recorded on the order, and logged for
 * reconciliation. It returns null rather than throwing so the gateway does not retry forever.
 */
export async function fulfillPaidCourseOrderByExternalId(
  tx: TenantTx,
  ctx: ServiceCtx,
  payment: VerifiedGatewayPayment,
): Promise<{ enrollmentId: string; created: boolean; paymentOrderId: string } | null> {
  const matches = await findPaymentOrdersByExternalId(tx, payment.externalId);

  if (matches.length > 1) {
    structuredLogger.error({
      message: "Paid webhook reference matches more than one payment order; not fulfilled.",
      module: "payments.fulfilment",
      errorCode: "PAYMENT_REFERENCE_AMBIGUOUS",
      requestId: ctx.requestId,
      externalId: payment.externalId,
    });
    return null;
  }

  const order = matches[0];
  if (!order) return null;

  const mismatch = describePaymentMismatch(order, payment);
  if (mismatch) {
    await tx.$executeRawUnsafe(
      `
      update payment_orders
      set
        metadata_json = coalesce(metadata_json, '{}'::jsonb)
          || jsonb_build_object('paymentMismatch', $2::jsonb),
        updated_at = now()
      where id = $1::uuid
      `,
      order.id,
      JSON.stringify({
        reason: mismatch,
        externalId: payment.externalId,
        capturedAmountCents: payment.amountCents ?? null,
        capturedCurrency: payment.currency ?? null,
        detectedAt: new Date().toISOString(),
      }),
    );
    structuredLogger.error({
      message: `Paid webhook not fulfilled: ${mismatch}.`,
      module: "payments.fulfilment",
      errorCode: "PAYMENT_AMOUNT_MISMATCH",
      requestId: ctx.requestId,
      paymentOrderId: order.id,
      externalId: payment.externalId,
      orderAmountCents: order.amount_cents,
      orderCurrency: order.currency,
      capturedAmountCents: payment.amountCents ?? null,
      capturedCurrency: payment.currency ?? null,
    });
    return null;
  }

  return fulfillPaidCourseOrder(tx, ctx, order);
}
