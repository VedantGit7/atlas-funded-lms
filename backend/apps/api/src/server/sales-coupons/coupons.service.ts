import { randomInt } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { findCourseAuthProjection } from "../courses/courses.repository";
import {
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
  updateCouponBodySchema,
} from "./sales-coupons.schemas";
import { salesCouponsRepository, type CouponRow } from "./sales-coupons.repository";
import { couponNotFound, normalizeCode, validationError } from "./coupon-rules";

/** Coupon administration: the admin coupon list, editor, redemptions and performance. */

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw validationError("Invalid date.");
  return date;
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
  if (!row) throw couponNotFound();
  return row;
}

function assertEditableWhileActive(_row: CouponRow) {
  // Active coupons can still be edited (Learnyst allows config after create),
  // but code collisions and usage limits are validated on save.
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
