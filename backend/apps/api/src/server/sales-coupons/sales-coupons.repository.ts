import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type CouponRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  discount_type: string;
  discount_value: number;
  max_discount_cents: number | null;
  currency: string;
  starts_at: Date | null;
  ends_at: Date | null;
  total_usage_limit: number | null;
  per_learner_limit: number;
  min_purchase_cents: number | null;
  visibility: string;
  device_type: string;
  applies_to_all_courses: boolean;
  created_by_membership_id: string;
  activated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  redemption_count?: bigint | number | null;
  course_count?: bigint | number | null;
};

export type CouponInsertInput = {
  code: string;
  name: string;
  discountType: string;
  discountValue: number;
  maxDiscountCents: number | null;
  currency: string;
  startsAt: Date | null;
  endsAt: Date | null;
  totalUsageLimit: number | null;
  perLearnerLimit: number;
  minPurchaseCents: number | null;
  visibility: string;
  deviceType: string;
  appliesToAllCourses: boolean;
  createdByMembershipId: string;
};

export type RedemptionInsertInput = {
  couponId: string;
  membershipId: string;
  courseId: string | null;
  paymentOrderId: string | null;
  discountCents: number;
  originalAmountCents: number;
  finalAmountCents: number;
  currency: string;
  codeSnapshot: string;
};

export type CouponPerformanceRow = {
  coupon_id: string;
  code: string;
  name: string;
  status: string;
  currency: string;
  redemption_count: bigint | number;
  total_discount_cents: bigint | number;
  total_revenue_cents: bigint | number;
};

export const salesCouponsRepository = {
  async list(
    tx: TenantTx,
    args: { q?: string; status?: string; limit: number },
  ): Promise<CouponRow[]> {
    const q = args.q?.trim() ?? "";
    const status = args.status && args.status !== "ALL" ? args.status : null;
    return tx.$queryRawUnsafe<CouponRow[]>(
      `
      select
        c.id::text, c.code, c.name, c.status, c.discount_type, c.discount_value,
        c.max_discount_cents, c.currency, c.starts_at, c.ends_at,
        c.total_usage_limit, c.per_learner_limit, c.min_purchase_cents,
        c.visibility, c.device_type, c.applies_to_all_courses,
        c.created_by_membership_id::text, c.activated_at, c.created_at, c.updated_at,
        (select count(*)::bigint from sales_coupon_redemptions r where r.coupon_id = c.id) as redemption_count,
        (select count(*)::int from sales_coupon_courses sc where sc.coupon_id = c.id) as course_count
      from sales_coupons c
      where ($1::text is null or c.status = $1)
        and (
          $2 = ''
          or c.code ilike '%' || $2 || '%'
          or c.name ilike '%' || $2 || '%'
        )
      order by c.created_at desc
      limit $3
      `,
      status,
      q,
      args.limit,
    );
  },

  async summary(tx: TenantTx) {
    const rows = await tx.$queryRawUnsafe<
      Array<{
        active_count: number;
        draft_count: number;
        inactive_count: number;
        total_count: number;
        total_redemptions: number;
        total_discount_cents: number;
        total_revenue_cents: number;
      }>
    >(
      `
      select
        count(*) filter (where status = 'ACTIVE')::int as active_count,
        count(*) filter (where status = 'DRAFT')::int as draft_count,
        count(*) filter (where status = 'INACTIVE')::int as inactive_count,
        count(*)::int as total_count,
        coalesce((select count(*)::int from sales_coupon_redemptions), 0) as total_redemptions,
        coalesce((select sum(discount_cents)::int from sales_coupon_redemptions), 0) as total_discount_cents,
        coalesce((select sum(final_amount_cents)::int from sales_coupon_redemptions), 0) as total_revenue_cents
      from sales_coupons
      `,
    );
    return (
      rows[0] ?? {
        active_count: 0,
        draft_count: 0,
        inactive_count: 0,
        total_count: 0,
        total_redemptions: 0,
        total_discount_cents: 0,
        total_revenue_cents: 0,
      }
    );
  },

  async findById(tx: TenantTx, id: string): Promise<CouponRow | null> {
    const rows = await tx.$queryRawUnsafe<CouponRow[]>(
      `
      select
        c.id::text, c.code, c.name, c.status, c.discount_type, c.discount_value,
        c.max_discount_cents, c.currency, c.starts_at, c.ends_at,
        c.total_usage_limit, c.per_learner_limit, c.min_purchase_cents,
        c.visibility, c.device_type, c.applies_to_all_courses,
        c.created_by_membership_id::text, c.activated_at, c.created_at, c.updated_at,
        (select count(*)::bigint from sales_coupon_redemptions r where r.coupon_id = c.id) as redemption_count,
        (select count(*)::int from sales_coupon_courses sc where sc.coupon_id = c.id) as course_count
      from sales_coupons c
      where c.id = $1::uuid
      limit 1
      `,
      id,
    );
    return rows[0] ?? null;
  },

  async findByCode(tx: TenantTx, code: string): Promise<CouponRow | null> {
    const rows = await tx.$queryRawUnsafe<CouponRow[]>(
      `
      select
        c.id::text, c.code, c.name, c.status, c.discount_type, c.discount_value,
        c.max_discount_cents, c.currency, c.starts_at, c.ends_at,
        c.total_usage_limit, c.per_learner_limit, c.min_purchase_cents,
        c.visibility, c.device_type, c.applies_to_all_courses,
        c.created_by_membership_id::text, c.activated_at, c.created_at, c.updated_at,
        (select count(*)::bigint from sales_coupon_redemptions r where r.coupon_id = c.id) as redemption_count
      from sales_coupons c
      where c.code = $1
      limit 1
      `,
      code,
    );
    return rows[0] ?? null;
  },

  async listCourseIds(tx: TenantTx, couponId: string): Promise<string[]> {
    const rows = await tx.$queryRawUnsafe<Array<{ course_id: string }>>(
      `
      select course_id::text
      from sales_coupon_courses
      where coupon_id = $1::uuid
      order by created_at asc
      `,
      couponId,
    );
    return rows.map((row) => row.course_id);
  },

  async insert(tx: TenantTx, args: CouponInsertInput): Promise<string> {
    const id = randomUUID();
    await tx.$executeRawUnsafe(
      `
      insert into sales_coupons (
        id, tenant_id, code, name, status, discount_type, discount_value,
        max_discount_cents, currency, starts_at, ends_at, total_usage_limit,
        per_learner_limit, min_purchase_cents, visibility, device_type,
        applies_to_all_courses, created_by_membership_id
      ) values (
        $1::uuid, app.current_tenant_id(), $2, $3, 'DRAFT', $4, $5,
        $6, $7, $8::timestamptz, $9::timestamptz, $10,
        $11, $12, $13, $14,
        $15, $16::uuid
      )
      `,
      id,
      args.code,
      args.name,
      args.discountType,
      args.discountValue,
      args.maxDiscountCents,
      args.currency,
      args.startsAt,
      args.endsAt,
      args.totalUsageLimit,
      args.perLearnerLimit,
      args.minPurchaseCents,
      args.visibility,
      args.deviceType,
      args.appliesToAllCourses,
      args.createdByMembershipId,
    );
    return id;
  },

  async update(tx: TenantTx, id: string, args: Omit<CouponInsertInput, "createdByMembershipId">) {
    await tx.$executeRawUnsafe(
      `
      update sales_coupons
      set code = $2,
          name = $3,
          discount_type = $4,
          discount_value = $5,
          max_discount_cents = $6,
          currency = $7,
          starts_at = $8::timestamptz,
          ends_at = $9::timestamptz,
          total_usage_limit = $10,
          per_learner_limit = $11,
          min_purchase_cents = $12,
          visibility = $13,
          device_type = $14,
          applies_to_all_courses = $15,
          updated_at = now()
      where id = $1::uuid
      `,
      id,
      args.code,
      args.name,
      args.discountType,
      args.discountValue,
      args.maxDiscountCents,
      args.currency,
      args.startsAt,
      args.endsAt,
      args.totalUsageLimit,
      args.perLearnerLimit,
      args.minPurchaseCents,
      args.visibility,
      args.deviceType,
      args.appliesToAllCourses,
    );
  },

  async replaceCourses(tx: TenantTx, couponId: string, courseIds: string[]) {
    await tx.$executeRaw`delete from sales_coupon_courses where coupon_id = ${couponId}::uuid`;
    for (const courseId of courseIds) {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into sales_coupon_courses (id, tenant_id, coupon_id, course_id)
        values (${id}::uuid, app.current_tenant_id(), ${couponId}::uuid, ${courseId}::uuid)
      `;
    }
  },

  async setStatus(tx: TenantTx, id: string, status: "ACTIVE" | "INACTIVE" | "DRAFT") {
    if (status === "ACTIVE") {
      await tx.$executeRaw`
        update sales_coupons
        set status = 'ACTIVE',
            activated_at = coalesce(activated_at, now()),
            updated_at = now()
        where id = ${id}::uuid
      `;
      return;
    }
    await tx.$executeRaw`
      update sales_coupons
      set status = ${status},
          updated_at = now()
      where id = ${id}::uuid
    `;
  },

  async delete(tx: TenantTx, id: string) {
    await tx.$executeRaw`delete from sales_coupon_redemptions where coupon_id = ${id}::uuid`;
    await tx.$executeRaw`delete from sales_coupon_courses where coupon_id = ${id}::uuid`;
    await tx.$executeRaw`delete from sales_coupons where id = ${id}::uuid`;
  },

  async countRedemptionsForMembership(
    tx: TenantTx,
    args: { couponId: string; membershipId: string },
  ): Promise<number> {
    const rows = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `
      select count(*)::bigint as count
      from sales_coupon_redemptions
      where coupon_id = $1::uuid and membership_id = $2::uuid
      `,
      args.couponId,
      args.membershipId,
    );
    return Number(rows[0]?.count ?? 0);
  },

  async couponAppliesToCourse(
    tx: TenantTx,
    args: { couponId: string; courseId: string; appliesToAll: boolean },
  ): Promise<boolean> {
    if (args.appliesToAll) return true;
    const rows = await tx.$queryRawUnsafe<Array<{ ok: number }>>(
      `
      select 1 as ok
      from sales_coupon_courses
      where coupon_id = $1::uuid and course_id = $2::uuid
      limit 1
      `,
      args.couponId,
      args.courseId,
    );
    return Boolean(rows[0]);
  },

  async listPublicForCourse(tx: TenantTx, courseId: string): Promise<CouponRow[]> {
    return tx.$queryRawUnsafe<CouponRow[]>(
      `
      select
        c.id::text, c.code, c.name, c.status, c.discount_type, c.discount_value,
        c.max_discount_cents, c.currency, c.starts_at, c.ends_at,
        c.total_usage_limit, c.per_learner_limit, c.min_purchase_cents,
        c.visibility, c.device_type, c.applies_to_all_courses,
        c.created_by_membership_id::text, c.activated_at, c.created_at, c.updated_at,
        (select count(*)::bigint from sales_coupon_redemptions r where r.coupon_id = c.id) as redemption_count
      from sales_coupons c
      where c.status = 'ACTIVE'
        and c.visibility = 'PUBLIC'
        and (c.starts_at is null or c.starts_at <= now())
        and (c.ends_at is null or c.ends_at >= now())
        and (
          c.applies_to_all_courses = true
          or exists (
            select 1 from sales_coupon_courses sc
            where sc.coupon_id = c.id and sc.course_id = $1::uuid
          )
        )
        and (c.total_usage_limit is null or (
          select count(*) from sales_coupon_redemptions r where r.coupon_id = c.id
        ) < c.total_usage_limit)
      order by c.created_at desc
      limit 20
      `,
      courseId,
    );
  },

  async insertRedemption(tx: TenantTx, args: RedemptionInsertInput): Promise<string> {
    const id = randomUUID();
    await tx.$executeRawUnsafe(
      `
      insert into sales_coupon_redemptions (
        id, tenant_id, coupon_id, membership_id, course_id, payment_order_id,
        discount_cents, original_amount_cents, final_amount_cents, currency, code_snapshot
      ) values (
        $1::uuid, app.current_tenant_id(), $2::uuid, $3::uuid, $4::uuid, $5::uuid,
        $6, $7, $8, $9, $10
      )
      `,
      id,
      args.couponId,
      args.membershipId,
      args.courseId,
      args.paymentOrderId,
      args.discountCents,
      args.originalAmountCents,
      args.finalAmountCents,
      args.currency,
      args.codeSnapshot,
    );
    return id;
  },

  async listPerformance(
    tx: TenantTx,
    args: { couponId?: string; limit: number },
  ): Promise<CouponPerformanceRow[]> {
    return tx.$queryRawUnsafe<CouponPerformanceRow[]>(
      `
      select
        c.id::text as coupon_id,
        c.code,
        c.name,
        c.status,
        c.currency,
        count(r.id)::bigint as redemption_count,
        coalesce(sum(r.discount_cents), 0)::bigint as total_discount_cents,
        coalesce(sum(r.final_amount_cents), 0)::bigint as total_revenue_cents
      from sales_coupons c
      left join sales_coupon_redemptions r on r.coupon_id = c.id
      where ($1::uuid is null or c.id = $1::uuid)
      group by c.id, c.code, c.name, c.status, c.currency
      order by redemption_count desc, c.created_at desc
      limit $2
      `,
      args.couponId ?? null,
      args.limit,
    );
  },

  async listRedemptions(
    tx: TenantTx,
    args: { couponId: string; limit: number },
  ) {
    return tx.$queryRawUnsafe<
      Array<{
        id: string;
        learner_name: string;
        course_title: string | null;
        discount_cents: number;
        original_amount_cents: number;
        final_amount_cents: number;
        currency: string;
        created_at: Date;
      }>
    >(
      `
      select
        r.id::text,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized, 'Learner') as learner_name,
        co.title as course_title,
        r.discount_cents,
        r.original_amount_cents,
        r.final_amount_cents,
        r.currency,
        r.created_at
      from sales_coupon_redemptions r
      left join memberships m on m.id = r.membership_id
      left join member_profiles mp on mp.membership_id = m.id
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join courses co on co.id = r.course_id
      where r.coupon_id = $1::uuid
      order by r.created_at desc
      limit $2
      `,
      args.couponId,
      args.limit,
    );
  },

  async countRedemptions(tx: TenantTx, couponId: string) {
    const rows = await tx.$queryRawUnsafe<Array<{ count: number }>>(
      `
      select count(*)::int as count
      from sales_coupon_redemptions
      where coupon_id = $1::uuid
      `,
      couponId,
    );
    return rows[0]?.count ?? 0;
  },
};
