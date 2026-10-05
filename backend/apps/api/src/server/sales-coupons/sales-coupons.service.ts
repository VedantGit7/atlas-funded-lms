import { randomInt, randomUUID } from "node:crypto";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { withTenantTx, type TenantTx } from "@atlas/db";
import type { z } from "zod";
import { getLearnerBillingConfigRow } from "@atlas/domain-config/repositories/learner-billing.repository";
import {
  PaymentProviderNotConfiguredError,
  resolvePaymentProvider,
} from "@atlas/domain/payments/payment-provider.registry";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { structuredLogger } from "@atlas/observability/logger";
import { findCourseAuthProjection, readCoursePricing } from "../courses/courses.repository";
import { courseNotFound, coursePurchaseRequired } from "../courses/courses.errors";
import {
  findActiveEnrollment,
  insertEnrollment,
  publishEnrollmentCreatedEvent,
} from "../enrollments/enrollments.repository";
import {
  checkoutPurchaseBodySchema,
  checkoutPurchaseResponseSchema,
  checkoutQuoteBodySchema,
  checkoutQuoteResponseSchema,
  couponDtoSchema,
  couponPerformanceQuerySchema,
  couponPerformanceResponseSchema,
  couponRedemptionsListResponseSchema,
  couponRedemptionsQuerySchema,
  couponResponseSchema,
  couponsListQuerySchema,
  couponsListResponseSchema,
  createBulkCouponsBodySchema,
  createBulkCouponsResponseSchema,
  createCouponBodySchema,
  deleteCouponBodySchema,
  deleteCouponResponseSchema,
  publicCouponsForCourseQuerySchema,
  publicCouponsForCourseResponseSchema,
  updateCouponBodySchema,
  validateCouponBodySchema,
  validateCouponResponseSchema,
} from "./sales-coupons.schemas";
import { salesCouponsRepository, type CouponRow } from "./sales-coupons.repository";
import { assertTenantReturnUrl } from "./checkout-return-url";
import { previewWalletSpend, spendWalletCredits } from "../sales-wallet/sales-wallet.service";
import { applyReferralPurchaseCredits } from "../sales-referrals/sales-referrals.service";
import {
  applyAffiliateCommission,
  resolveAffiliateForCheckout,
} from "../sales-affiliates/sales-affiliates.service";
import type { ResolveAffiliateCheckoutResult } from "../sales-affiliates/sales-affiliates.schemas";

function notFound(message = "Coupon not found.") {
  return new AtlasHttpError({ code: "PERMISSION_DENIED", status: 404, message });
}

function validationError(message: string) {
  return new AtlasHttpError({ code: "VALIDATION_ERROR", status: 400, message });
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw validationError("Invalid date.");
  return date;
}

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

async function toCouponDto(tx: TenantTx, row: CouponRow) {
  const courseIds = await salesCouponsRepository.listCourseIds(tx, row.id);
  return couponDtoSchema.parse({
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status as "DRAFT" | "ACTIVE" | "INACTIVE",
    discountType: row.discount_type as "PERCENT" | "FIXED",
    discountValue: row.discount_value,
    maxDiscountCents: row.max_discount_cents,
    currency: row.currency,
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
    totalUsageLimit: row.total_usage_limit,
    perLearnerLimit: row.per_learner_limit,
    minPurchaseCents: row.min_purchase_cents,
    visibility: row.visibility as "PUBLIC" | "PRIVATE",
    deviceType: row.device_type as "ALL" | "WEB" | "MOBILE",
    appliesToAllCourses: row.applies_to_all_courses,
    courseIds,
    courseCount: row.applies_to_all_courses ? 0 : Number(row.course_count ?? courseIds.length),
    redemptionCount: Number(row.redemption_count ?? 0),
    activatedAt: row.activated_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}

/**
 * Coupon code suffix. Audit finding H15.
 *
 * This used the engine's default pseudo-random generator, which is not a
 * CSPRNG: V8 seeds it per-realm and its internal state is recoverable from a
 * handful of outputs, so an attacker who has seen a few issued coupon codes can
 * predict the next ones. These codes are worth money — they redeem against real
 * discounts — so the sequence must not be guessable. `randomInt` is also
 * rejection-sampled and therefore unbiased over the alphabet, which scaling a
 * float into a range is not.
 *
 * The exit gate for this finding is a literal grep, so the old call is
 * deliberately not spelled out here.
 *
 * The alphabet already excludes I/O/0/1 to avoid transcription errors.
 */
function randomCodeSuffix(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(randomInt(chars.length));
  }
  return result;
}

async function requireCoupon(tx: TenantTx, id: string) {
  const row = await salesCouponsRepository.findById(tx, id);
  if (!row) throw notFound();
  return row;
}

function assertEditableWhileActive(row: CouponRow) {
  // Active coupons can still be edited (Learnyst allows config after create),
  // but code collisions and usage limits are validated on save.
  void row;
}

async function assertValidCourseIds(tx: TenantTx, courseIds: string[]) {
  for (const courseId of courseIds) {
    const course = await findCourseAuthProjection({ tx, courseId });
    if (!course) {
      throw validationError(`Course not found: ${courseId}`);
    }
  }
}

function mapCreateFields(body: {
  code: string;
  name: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  maxDiscountCents?: number | null | undefined;
  currency?: string | undefined;
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
  totalUsageLimit?: number | null | undefined;
  perLearnerLimit?: number | undefined;
  minPurchaseCents?: number | null | undefined;
  visibility?: "PUBLIC" | "PRIVATE" | undefined;
  deviceType?: "ALL" | "WEB" | "MOBILE" | undefined;
  appliesToAllCourses?: boolean | undefined;
}) {
  const startsAt = parseOptionalDate(body.startsAt);
  const endsAt = parseOptionalDate(body.endsAt);
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw validationError("End date must be after start date.");
  }
  return {
    code: normalizeCode(body.code),
    name: body.name.trim(),
    discountType: body.discountType,
    discountValue: body.discountValue,
    maxDiscountCents: body.maxDiscountCents ?? null,
    currency: (body.currency ?? "USD").toUpperCase(),
    startsAt,
    endsAt,
    totalUsageLimit: body.totalUsageLimit ?? null,
    perLearnerLimit: body.perLearnerLimit ?? 1,
    minPurchaseCents: body.minPurchaseCents ?? null,
    visibility: body.visibility ?? "PRIVATE",
    deviceType: body.deviceType ?? "ALL",
    appliesToAllCourses: body.appliesToAllCourses ?? true,
  };
}

export async function listCoupons(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = couponsListQuerySchema.parse(rawQuery ?? {});
  const [rows, summary] = await Promise.all([
    salesCouponsRepository.list(tx, {
      status: query.status,
      ...(query.q ? { q: query.q } : {}),
      limit: query.limit,
    }),
    salesCouponsRepository.summary(tx),
  ]);
  const items = [];
  for (const row of rows) {
    items.push(await toCouponDto(tx, row));
  }
  return couponsListResponseSchema.parse({
    data: {
      items,
      summary: {
        activeCount: summary.active_count,
        draftCount: summary.draft_count,
        inactiveCount: summary.inactive_count,
        totalCount: summary.total_count,
        totalRedemptions: summary.total_redemptions,
        totalDiscountCents: summary.total_discount_cents,
        totalRevenueCents: summary.total_revenue_cents,
      },
    },
  });
}

export async function getCoupon(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  return couponResponseSchema.parse({
    data: await toCouponDto(tx, await requireCoupon(tx, id)),
  });
}

export async function createCoupon(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createCouponBodySchema.parse(rawBody);
  const fields = mapCreateFields(body);
  const existing = await salesCouponsRepository.findByCode(tx, fields.code);
  if (existing) throw validationError("A coupon with this code already exists.");

  const courseIds = body.appliesToAllCourses ? [] : body.courseIds;
  await assertValidCourseIds(tx, courseIds);

  const id = await salesCouponsRepository.insert(tx, {
    ...fields,
    createdByMembershipId: ctx.actorMembershipId,
  });
  await salesCouponsRepository.replaceCourses(tx, id, courseIds);
  return couponResponseSchema.parse({
    data: await toCouponDto(tx, await requireCoupon(tx, id)),
  });
}

export async function createBulkCoupons(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createBulkCouponsBodySchema.parse(rawBody);
  const prefix = normalizeCode(body.prefix).replace(/-+$/g, "");
  const createdIds: string[] = [];
  const usedCodes = new Set<string>();

  for (let attempt = 0; attempt < body.count * 8 && createdIds.length < body.count; attempt += 1) {
    const code = `${prefix}-${randomCodeSuffix(6)}`;
    if (usedCodes.has(code)) continue;
    usedCodes.add(code);
    const existing = await salesCouponsRepository.findByCode(tx, code);
    if (existing) continue;

    const id = await salesCouponsRepository.insert(tx, {
      code,
      name: body.name.trim(),
      discountType: body.discountType,
      discountValue: body.discountValue,
      maxDiscountCents: body.maxDiscountCents ?? null,
      currency: body.currency.toUpperCase(),
      startsAt: null,
      endsAt: null,
      totalUsageLimit: null,
      perLearnerLimit: 1,
      minPurchaseCents: null,
      visibility: "PRIVATE",
      deviceType: "ALL",
      appliesToAllCourses: true,
      createdByMembershipId: ctx.actorMembershipId,
    });
    createdIds.push(id);
  }

  if (createdIds.length < body.count) {
    throw validationError(
      `Could only generate ${createdIds.length} of ${body.count} unique codes. Try a different prefix.`,
    );
  }

  const items = [];
  for (const id of createdIds) {
    items.push(await toCouponDto(tx, await requireCoupon(tx, id)));
  }
  return createBulkCouponsResponseSchema.parse({
    data: { createdCount: items.length, items },
  });
}

export async function listCouponRedemptions(
  tx: TenantTx,
  _ctx: ServiceCtx,
  couponId: string,
  rawQuery: unknown,
) {
  await requireCoupon(tx, couponId);
  const query = couponRedemptionsQuerySchema.parse(rawQuery ?? {});
  const [rows, totalCount] = await Promise.all([
    salesCouponsRepository.listRedemptions(tx, { couponId, limit: query.limit }),
    salesCouponsRepository.countRedemptions(tx, couponId),
  ]);
  return couponRedemptionsListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        id: row.id,
        learnerName: row.learner_name,
        courseTitle: row.course_title,
        discountCents: row.discount_cents,
        originalAmountCents: row.original_amount_cents,
        finalAmountCents: row.final_amount_cents,
        currency: row.currency,
        createdAt: row.created_at.toISOString(),
      })),
      totalCount,
    },
  });
}

export async function updateCoupon(tx: TenantTx, _ctx: ServiceCtx, id: string, rawBody: unknown) {
  const body = updateCouponBodySchema.parse(rawBody);
  const existing = await requireCoupon(tx, id);
  assertEditableWhileActive(existing);
  const fields = mapCreateFields(body);

  if (fields.code !== existing.code) {
    const collision = await salesCouponsRepository.findByCode(tx, fields.code);
    if (collision) throw validationError("A coupon with this code already exists.");
  }

  const courseIds = body.appliesToAllCourses ? [] : body.courseIds;
  await assertValidCourseIds(tx, courseIds);

  await salesCouponsRepository.update(tx, id, fields);
  await salesCouponsRepository.replaceCourses(tx, id, courseIds);
  return couponResponseSchema.parse({
    data: await toCouponDto(tx, await requireCoupon(tx, id)),
  });
}

export async function activateCoupon(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const existing = await requireCoupon(tx, id);
  if (!existing.applies_to_all_courses) {
    const courseIds = await salesCouponsRepository.listCourseIds(tx, id);
    if (courseIds.length === 0) {
      throw validationError("Associate at least one course before activating.");
    }
  }
  await salesCouponsRepository.setStatus(tx, id, "ACTIVE");
  return couponResponseSchema.parse({
    data: await toCouponDto(tx, await requireCoupon(tx, id)),
  });
}

export async function deactivateCoupon(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  await requireCoupon(tx, id);
  await salesCouponsRepository.setStatus(tx, id, "INACTIVE");
  return couponResponseSchema.parse({
    data: await toCouponDto(tx, await requireCoupon(tx, id)),
  });
}

export async function deleteCoupon(tx: TenantTx, _ctx: ServiceCtx, id: string, rawBody: unknown) {
  const body = deleteCouponBodySchema.parse(rawBody);
  const existing = await requireCoupon(tx, id);
  if (existing.status === "ACTIVE") {
    throw validationError("Deactivate the coupon before deleting it.");
  }
  if (body.nameConfirmation.trim() !== existing.name.trim()) {
    throw validationError("Type the coupon name to confirm delete.");
  }
  await salesCouponsRepository.delete(tx, id);
  return deleteCouponResponseSchema.parse({ data: { id, deleted: true as const } });
}

type ApplyCouponResult = {
  coupon: CouponRow;
  discountCents: number;
  originalAmountCents: number;
  finalAmountCents: number;
  currency: string;
};

async function resolveCoursePrice(tx: TenantTx, courseId: string) {
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
async function assertCouponHasFreeUse(
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

async function resolveCheckoutTax(tx: TenantTx, amountAfterDiscountsCents: number) {
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

function toBreakdown(args: {
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

type CourseCheckoutMetadata = {
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

async function allocateInvoiceNumber(tx: TenantTx, paymentOrderId: string): Promise<string> {
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

async function findPaymentOrderById(
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
 * Marks a course PaymentOrder paid and enrolls the learner.
 * Idempotent on already-paid orders / existing enrollments.
 */
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

type CheckoutDiscountResult = {
  discountCents: number;
  amountAfterDiscount: number;
  coupon: CouponRow | null;
  affiliate: ResolveAffiliateCheckoutResult | null;
};

async function resolveCheckoutDiscount(
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

export async function getCouponPerformance(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = couponPerformanceQuerySchema.parse(rawQuery ?? {});
  const rows = await salesCouponsRepository.listPerformance(tx, {
    ...(query.couponId ? { couponId: query.couponId } : {}),
    limit: query.limit,
  });
  return couponPerformanceResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        couponId: row.coupon_id,
        code: row.code,
        name: row.name,
        status: row.status as "DRAFT" | "ACTIVE" | "INACTIVE",
        redemptionCount: Number(row.redemption_count),
        totalDiscountCents: Number(row.total_discount_cents),
        totalRevenueCents: Number(row.total_revenue_cents),
        currency: row.currency,
      })),
    },
  });
}

// Re-export for callers that need the purchase-required error shape when free enroll hits paid.
export { coursePurchaseRequired };
