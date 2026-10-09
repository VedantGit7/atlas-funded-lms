import { randomUUID } from "node:crypto";
import { auditWriter } from "@atlas/audit";
import { withTenantTx, type TenantTx } from "@atlas/db";
import type { z } from "zod";
import {
  PaymentProviderNotConfiguredError,
  resolvePaymentProvider,
} from "@atlas/domain/payments/payment-provider.registry";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { findActiveEnrollment } from "../enrollments/enrollments.repository";
import {
  checkoutPurchaseBodySchema,
  checkoutPurchaseResponseSchema,
} from "./sales-coupons.schemas";
import { assertTenantReturnUrl } from "./checkout-return-url";
import { validationError } from "./coupon-rules";
import {
  assertCouponHasFreeUse,
  resolveCheckoutDiscount,
  resolveCheckoutTax,
  resolveCoursePrice,
  toBreakdown,
} from "./checkout-pricing";
import {
  allocateInvoiceNumber,
  findPaymentOrderById,
  fulfillPaidCourseOrder,
  type CourseCheckoutMetadata,
} from "./order-fulfillment.service";
import { previewWalletSpend } from "../sales-wallet/sales-wallet.service";

/**
 * Buying a course: the purchase transaction records a priced order (or fulfils
 * a $0 one), then the gateway session is created once that has committed.
 */

async function auditCheckoutOrder(
  tx: TenantTx,
  ctx: ServiceCtx,
  order: {
    paymentOrderId: string;
    metadata: CourseCheckoutMetadata;
    currency: string;
    gatewayKey: string | null;
  },
): Promise<void> {
  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "checkout.order.created",
      target: { type: "payment_order", id: order.paymentOrderId },
      before: null,
      after: {
        courseId: order.metadata.courseId,
        amountCents: order.metadata.finalAmountCents,
        currency: order.currency,
        gatewayKey: order.gatewayKey,
      },
      metadata: {
        originalAmountCents: order.metadata.originalAmountCents,
        couponCode: order.metadata.couponCode,
        affiliateCode: order.metadata.affiliateCode,
        walletCreditsApplied: order.metadata.walletCreditsApplied,
        taxAmountCents: order.metadata.taxAmountCents,
      },
    },
  );
}

type CheckoutPurchaseResponse = z.output<typeof checkoutPurchaseResponseSchema>;

type CheckoutSession = {
  checkoutUrl: string | null;
  clientCheckout: CheckoutPurchaseResponse["data"]["clientCheckout"] | null;
};

/**
 * The transaction half of a purchase, as plain data. It is what the route's
 * idempotency record stores and replays, so it carries no provider objects.
 */
export type CheckoutPurchasePlan =
  | { kind: "done"; response: CheckoutPurchaseResponse }
  | {
      kind: "gateway";
      paymentOrderId: string;
      gatewayKey: string;
      amountCents: number;
      currency: string;
      courseId: string;
      courseTitle: string;
      successUrl: string;
      cancelUrl: string;
      pricing: CheckoutPurchaseResponse["data"]["pricing"];
    };

/** An open checkout older than this is not reused (Stripe sessions last 24 hours). */
const REUSABLE_CHECKOUT_HOURS = 23;

/**
 * At most one open checkout per learner, course and price (audit M4).
 *
 * Serialised per learner and course, so two tabs or a retry with a new key
 * cannot both pass the "no open order" check. An open order for the same price
 * is reused rather than duplicated; a different price (another coupon, other
 * wallet credits) is a new order, and fulfilment guards against both being paid.
 */
async function lockCheckoutForCourse(tx: TenantTx, ctx: ServiceCtx, courseId: string) {
  await tx.$executeRawUnsafe(
    `select pg_advisory_xact_lock(hashtextextended($1::text, 0))`,
    `checkout:${ctx.tenantId}:${ctx.actorMembershipId}:${courseId}`,
  );
}

async function findReusableCheckoutOrder(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    metadata: CourseCheckoutMetadata;
    currency: string;
    gatewayKey: string;
  },
): Promise<string | null> {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `
    select id::text
    from payment_orders
    where membership_id = $1::uuid
      and status = 'pending'
      and gateway_key = $2::text
      and amount_cents = $3::int
      and upper(currency) = upper($4::text)
      and metadata_json->>'kind' = 'course_checkout'
      and metadata_json->>'courseId' = $5::text
      and coalesce(metadata_json->>'couponId', '') = coalesce($6::text, '')
      and coalesce(metadata_json->>'affiliateCode', '') = coalesce($7::text, '')
      and coalesce((metadata_json->>'walletCreditsApplied')::int, 0) = $8::int
      and created_at > now() - make_interval(hours => $9::int)
    order by created_at desc
    limit 1
    `,
    ctx.actorMembershipId,
    args.gatewayKey,
    args.metadata.finalAmountCents,
    args.currency,
    args.metadata.courseId,
    args.metadata.couponId,
    args.metadata.affiliateCode,
    args.metadata.walletCreditsApplied,
    REUSABLE_CHECKOUT_HOURS,
  );
  return rows[0]?.id ?? null;
}

/**
 * Transaction half of a course purchase: prices the order, records it, and for
 * a $0 order fulfils it. The payment gateway is never called here; a paid order
 * gets its gateway session in completeCheckoutPurchase, after this commits.
 */
export async function planCheckoutPurchase(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
): Promise<CheckoutPurchasePlan> {
  const body = checkoutPurchaseBodySchema.parse(rawBody);
  // Checked before any order exists, so a bad redirect leaves nothing behind.
  const successUrl =
    body.successUrl != null ? await assertTenantReturnUrl(tx, body.successUrl, "successUrl") : null;
  const cancelUrl =
    body.cancelUrl != null ? await assertTenantReturnUrl(tx, body.cancelUrl, "cancelUrl") : null;
  const { course, originalAmountCents, currency } = await resolveCoursePrice(tx, body.courseId);

  await lockCheckoutForCourse(tx, ctx, course.id);

  const existing = await findActiveEnrollment({
    tx,
    courseId: body.courseId,
    membershipId: ctx.actorMembershipId,
  });
  if (existing) {
    throw validationError("You are already enrolled in this course.");
  }

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

  // Audit M1: the order about to be created holds one of the coupon's uses
  // until it is paid, fails or lapses. Checked under the coupon's row lock, so
  // two learners cannot both take its last use, and refused here, before
  // payment, rather than after it.
  if (coupon) {
    await assertCouponHasFreeUse(tx, ctx, { couponId: coupon.id, courseId: course.id, lock: true });
  }

  let walletCreditsApplied = 0;
  let walletDiscountCents = 0;
  const requestedWallet = body.walletCreditsToSpend ?? 0;
  if (requestedWallet > 0) {
    const preview = await previewWalletSpend(tx, {
      membershipId: ctx.actorMembershipId,
      creditsRequested: requestedWallet,
      maxSpendableMoneyCents: amountAfterCoupon,
    });
    if (!preview.enabled || preview.creditsApplied <= 0) {
      throw validationError("No wallet credits can be applied to this order.");
    }
    walletCreditsApplied = preview.creditsApplied;
    walletDiscountCents = preview.discountCents;
  }

  const amountAfterWallet = Math.max(0, amountAfterCoupon - walletDiscountCents);
  const { taxAmountCents, finalAmountCents } = await resolveCheckoutTax(tx, amountAfterWallet);

  const paymentOrderId = randomUUID();
  const metadata: CourseCheckoutMetadata = {
    kind: "course_checkout",
    courseId: course.id,
    courseTitle: course.title,
    productTitle: course.title,
    productType: "course",
    couponId: coupon?.id ?? null,
    couponCode: coupon?.code ?? null,
    affiliateId: affiliate?.affiliate.id ?? null,
    affiliateCode: affiliate?.affiliate.coupon_code ?? null,
    affiliateCommissionPct: affiliate?.commissionPct ?? null,
    originalAmountCents,
    discountCents,
    walletCreditsApplied,
    walletDiscountCents,
    taxAmountCents,
    amountAfterCouponCents: amountAfterCoupon,
    finalAmountCents,
  };

  const pricing = toBreakdown({
    courseId: course.id,
    courseTitle: course.title,
    currency,
    originalAmountCents,
    discountCents,
    walletCreditsApplied,
    walletDiscountCents,
    taxAmountCents,
    finalAmountCents,
    coupon,
    affiliateCode: affiliate?.affiliate.coupon_code ?? null,
  });

  // $0 due (full coupon/wallet coverage): fulfill immediately without a gateway.
  if (finalAmountCents === 0) {
    const invoiceNumber = await allocateInvoiceNumber(tx, paymentOrderId);
    await tx.$executeRawUnsafe(
      `
      insert into payment_orders (
        id, tenant_id, membership_id, external_id, amount_cents, currency, status,
        metadata_json, product_title, product_type, coupon_amount_cents, tax_amount_cents,
        invoice_number, paid_at, created_at, updated_at
      ) values (
        $1::uuid, app.current_tenant_id(), $2::uuid, $3, $4, $5, 'pending',
        $6::jsonb, $7, 'course', $8, $9,
        $10, null, now(), now()
      )
      `,
      paymentOrderId,
      ctx.actorMembershipId,
      `checkout_${paymentOrderId}`,
      finalAmountCents,
      currency,
      JSON.stringify(metadata),
      course.title,
      discountCents,
      taxAmountCents,
      invoiceNumber,
    );

    const order = await findPaymentOrderById(tx, paymentOrderId);
    if (!order) throw validationError("Failed to create payment order.");
    await auditCheckoutOrder(tx, ctx, { paymentOrderId, metadata, currency, gatewayKey: null });

    const fulfilled = await fulfillPaidCourseOrder(tx, ctx, order);
    return {
      kind: "done",
      response: checkoutPurchaseResponseSchema.parse({
        data: {
          enrollmentId: fulfilled.enrollmentId,
          paymentOrderId,
          created: fulfilled.created,
          checkoutUrl: null,
          clientCheckout: null,
          pricing,
        },
      }),
    };
  }

  // Amount due > $0: record a pending order. The gateway session is created
  // after this transaction commits (completeCheckoutPurchase).
  if (!successUrl || !cancelUrl) {
    throw validationError("successUrl and cancelUrl are required for paid checkout.");
  }

  let gatewayKey: string;
  try {
    gatewayKey = (await resolvePaymentProvider(tx)).gatewayKey;
  } catch (error) {
    if (error instanceof PaymentProviderNotConfiguredError) {
      throw validationError(
        "No published payment gateway is configured. Ask an admin to configure a payment gateway (Stripe or Razorpay).",
      );
    }
    throw error;
  }

  const gatewayPlan = (orderId: string): CheckoutPurchasePlan => ({
    kind: "gateway",
    paymentOrderId: orderId,
    gatewayKey,
    amountCents: finalAmountCents,
    currency,
    courseId: course.id,
    courseTitle: course.title,
    successUrl,
    cancelUrl,
    pricing,
  });

  const reusable = await findReusableCheckoutOrder(tx, ctx, { metadata, currency, gatewayKey });
  if (reusable) {
    return gatewayPlan(reusable);
  }

  await tx.$executeRawUnsafe(
    `
    insert into payment_orders (
      id, tenant_id, membership_id, external_id, amount_cents, currency, status,
      metadata_json, gateway_key, product_title, product_type, coupon_amount_cents,
      tax_amount_cents, invoice_number, paid_at, created_at, updated_at
    ) values (
      $1::uuid, app.current_tenant_id(), $2::uuid, $3, $4, $5, 'pending',
      $6::jsonb, $7, $8, 'course', $9,
      $10, null, null, now(), now()
    )
    `,
    paymentOrderId,
    ctx.actorMembershipId,
    `pending_${paymentOrderId}`,
    finalAmountCents,
    currency,
    JSON.stringify(metadata),
    gatewayKey,
    course.title,
    discountCents,
    taxAmountCents,
  );
  await auditCheckoutOrder(tx, ctx, { paymentOrderId, metadata, currency, gatewayKey });

  return gatewayPlan(paymentOrderId);
}

function readStoredSession(metadata: unknown): CheckoutSession | null {
  if (!metadata || typeof metadata !== "object") return null;
  const session = (metadata as Record<string, unknown>)["checkoutSession"];
  if (!session || typeof session !== "object") return null;
  const value = session as Record<string, unknown>;
  return {
    checkoutUrl: typeof value["checkoutUrl"] === "string" ? value["checkoutUrl"] : null,
    clientCheckout:
      value["clientCheckout"] && typeof value["clientCheckout"] === "object"
        ? (value["clientCheckout"] as CheckoutSession["clientCheckout"])
        : null,
  };
}

function gatewayResponse(
  plan: Extract<CheckoutPurchasePlan, { kind: "gateway" }>,
  session: CheckoutSession,
): CheckoutPurchaseResponse {
  return checkoutPurchaseResponseSchema.parse({
    data: {
      enrollmentId: null,
      paymentOrderId: plan.paymentOrderId,
      created: false,
      checkoutUrl: session.checkoutUrl,
      clientCheckout: session.clientCheckout,
      pricing: plan.pricing,
    },
  });
}

/**
 * After the purchase transaction commits: create (or find) the order's gateway
 * session with no pooled connection held, then record it in a short
 * transaction. Runs again on an idempotent replay and for a reused order, so it
 * is idempotent itself: a session already recorded on the order is returned,
 * Stripe receives an idempotency key per order, and a concurrent second
 * session never replaces the first recorded one.
 */
export async function completeCheckoutPurchase(
  plan: CheckoutPurchasePlan,
  ctx: ServiceCtx,
): Promise<CheckoutPurchaseResponse> {
  if (plan.kind === "done") return plan.response;

  const txCtx = {
    tenantId: ctx.tenantId,
    requestId: ctx.requestId,
    actorMembershipId: ctx.actorMembershipId,
  };

  const prepared = await withTenantTx(txCtx, async (tx) => {
    const rows = await tx.$queryRawUnsafe<
      Array<{ status: string; gateway_key: string | null; metadata_json: unknown }>
    >(
      `select status, gateway_key, metadata_json from payment_orders where id = $1::uuid limit 1`,
      plan.paymentOrderId,
    );
    const order = rows[0];
    if (!order) throw validationError("Payment order not found.");
    const stored = readStoredSession(order.metadata_json);
    if (stored) return { stored };
    if (order.status !== "pending") {
      throw validationError("This order is no longer awaiting payment.");
    }
    const { provider } = await resolvePaymentProvider(tx, {
      gatewayKey: order.gateway_key ?? plan.gatewayKey,
    });
    return { provider };
  });

  if ("stored" in prepared) return gatewayResponse(plan, prepared.stored);

  const checkout = await prepared.provider.createCheckout({
    tenantId: ctx.tenantId,
    paymentOrderId: plan.paymentOrderId,
    amountCents: plan.amountCents,
    currency: plan.currency,
    courseTitle: plan.courseTitle,
    successUrl: plan.successUrl,
    cancelUrl: plan.cancelUrl,
    metadata: {
      courseId: plan.courseId,
      membershipId: ctx.actorMembershipId,
    },
    idempotencyKey: `atlas-checkout-${plan.paymentOrderId}`,
  });
  const session: CheckoutSession = {
    checkoutUrl: checkout.checkoutUrl ?? null,
    clientCheckout: checkout.clientCheckout ?? null,
  };

  const recorded = await withTenantTx(txCtx, async (tx) => {
    // Only the first session is recorded; webhooks match on this external id.
    const updated = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `
      update payment_orders
      set external_id = $2,
          metadata_json = coalesce(metadata_json, '{}'::jsonb)
            || jsonb_build_object('checkoutSession', $3::jsonb),
          updated_at = now()
      where id = $1::uuid
        and external_id = 'pending_' || id::text
      returning id::text
      `,
      plan.paymentOrderId,
      checkout.externalId,
      JSON.stringify(session),
    );
    if (updated[0]) return session;
    const rows = await tx.$queryRawUnsafe<Array<{ metadata_json: unknown }>>(
      `select metadata_json from payment_orders where id = $1::uuid limit 1`,
      plan.paymentOrderId,
    );
    return readStoredSession(rows[0]?.metadata_json) ?? session;
  });

  return gatewayResponse(plan, recorded);
}

/** Both halves in sequence, for callers outside a route (the route runs them around its commit). */
export async function purchaseCheckout(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  return completeCheckoutPurchase(await planCheckoutPurchase(tx, ctx, rawBody), ctx);
}
