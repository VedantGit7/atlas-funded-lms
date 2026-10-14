import type { TenantTx } from "@atlas/db";
import type { CouponRedemptionsQuery, CouponsListQuery } from "./sales-marketing-roster.dto";
import type { CouponRedemptionRow, CouponRow } from "./sales-marketing-roster.repository";
import { asUnknownString } from "./sales-marketing-roster.repository-helpers";

/**
 * Coupons: the list, summary, one coupon and its redemptions.
 * Part of salesMarketingRosterRepository.
 */
export const salesMarketingRosterCouponsRepository = {
  async countCoupons(tx: TenantTx, query: CouponsListQuery): Promise<number> {
    const view = query.view;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from sales_coupons c
      where c.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${query.status ?? null}::text is null or c.status = ${query.status ?? null})
        and (
          ${query.discountType ?? null}::text is null
          or c.discount_type = ${query.discountType ?? null}
        )
        and (
          ${query.q ?? null}::text is null
          or lower(c.code) like '%' || lower(${query.q ?? null}) || '%'
          or lower(c.name) like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${view} = 'all'
          or (${view} = 'active' and c.status = 'ACTIVE')
          or (${view} = 'inactive' and c.status = 'INACTIVE')
          or (
            ${view} = 'never_used'
            and not exists (
              select 1 from sales_coupon_redemptions r
              where r.coupon_id = c.id and r.tenant_id = c.tenant_id
            )
          )
          or (
            ${view} = 'expiring_soon'
            and c.status = 'ACTIVE'
            and c.ends_at is not null
            and c.ends_at >= now()
            and c.ends_at <= now() + interval '14 days'
          )
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listCoupons(tx: TenantTx, query: CouponsListQuery): Promise<CouponRow[]> {
    const skip = (query.page - 1) * query.limit;
    const view = query.view;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        c.id::text as id,
        c.code,
        c.name,
        c.status,
        c.discount_type,
        c.discount_value,
        c.currency,
        c.total_usage_limit,
        c.ends_at,
        c.starts_at,
        count(r.id)::int as redemption_count,
        coalesce(sum(r.discount_cents), 0)::int as total_discount_cents,
        coalesce(sum(coalesce(r.original_amount_cents, r.final_amount_cents + r.discount_cents)), 0)::int as total_revenue_cents,
        c.created_at
      from sales_coupons c
      left join sales_coupon_redemptions r on r.coupon_id = c.id and r.tenant_id = c.tenant_id
      where c.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${query.status ?? null}::text is null or c.status = ${query.status ?? null})
        and (
          ${query.discountType ?? null}::text is null
          or c.discount_type = ${query.discountType ?? null}
        )
        and (
          ${query.q ?? null}::text is null
          or lower(c.code) like '%' || lower(${query.q ?? null}) || '%'
          or lower(c.name) like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${view} = 'all'
          or (${view} = 'active' and c.status = 'ACTIVE')
          or (${view} = 'inactive' and c.status = 'INACTIVE')
          or (
            ${view} = 'never_used'
            and not exists (
              select 1 from sales_coupon_redemptions rx
              where rx.coupon_id = c.id and rx.tenant_id = c.tenant_id
            )
          )
          or (
            ${view} = 'expiring_soon'
            and c.status = 'ACTIVE'
            and c.ends_at is not null
            and c.ends_at >= now()
            and c.ends_at <= now() + interval '14 days'
          )
        )
      group by c.id
      order by
        case when ${query.sortBy} = 'revenue_cents' and ${query.sortDir} = 'asc'
          then coalesce(sum(coalesce(r.original_amount_cents, r.final_amount_cents + r.discount_cents)), 0) end asc nulls last,
        case when ${query.sortBy} = 'revenue_cents' and ${query.sortDir} = 'desc'
          then coalesce(sum(coalesce(r.original_amount_cents, r.final_amount_cents + r.discount_cents)), 0) end desc nulls last,
        case when ${query.sortBy} = 'discount_cents' and ${query.sortDir} = 'asc'
          then coalesce(sum(r.discount_cents), 0) end asc nulls last,
        case when ${query.sortBy} = 'discount_cents' and ${query.sortDir} = 'desc'
          then coalesce(sum(r.discount_cents), 0) end desc nulls last,
        case when ${query.sortBy} = 'redemption_count' and ${query.sortDir} = 'asc'
          then count(r.id) end asc nulls last,
        case when ${query.sortBy} = 'redemption_count' and ${query.sortDir} = 'desc'
          then count(r.id) end desc nulls last,
        case when ${query.sortBy} = 'net_cents' and ${query.sortDir} = 'asc'
          then coalesce(sum(coalesce(r.original_amount_cents, r.final_amount_cents + r.discount_cents)), 0) - coalesce(sum(r.discount_cents), 0) end asc nulls last,
        case when ${query.sortBy} = 'net_cents' and ${query.sortDir} = 'desc'
          then coalesce(sum(coalesce(r.original_amount_cents, r.final_amount_cents + r.discount_cents)), 0) - coalesce(sum(r.discount_cents), 0) end desc nulls last,
        case when ${query.sortBy} = 'created_at' and ${query.sortDir} = 'asc'
          then c.created_at end asc nulls last,
        case when ${query.sortBy} = 'created_at' and ${query.sortDir} = 'desc'
          then c.created_at end desc nulls last,
        case when ${query.sortBy} = 'code' and ${query.sortDir} = 'asc'
          then c.code end asc nulls last,
        case when ${query.sortBy} = 'code' and ${query.sortDir} = 'desc'
          then c.code end desc nulls last,
        coalesce(sum(coalesce(r.original_amount_cents, r.final_amount_cents + r.discount_cents)), 0) desc,
        c.created_at desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map((row) => ({
      id: asUnknownString(row["id"]),
      code: asUnknownString(row["code"]),
      name: asUnknownString(row["name"]),
      status: asUnknownString(row["status"]),
      discount_type: asUnknownString(row["discount_type"]),
      discount_value: Number(row["discount_value"]),
      currency: asUnknownString(row["currency"]),
      redemption_count: Number(row["redemption_count"] ?? 0),
      total_discount_cents: Number(row["total_discount_cents"] ?? 0),
      total_revenue_cents: Number(row["total_revenue_cents"] ?? 0),
      total_usage_limit: row["total_usage_limit"] == null ? null : Number(row["total_usage_limit"]),
      ends_at: (row["ends_at"] as Date | null) ?? null,
      starts_at: (row["starts_at"] as Date | null) ?? null,
      created_at: row["created_at"] as Date,
    }));
  },

  async getCouponsSummary(
    tx: TenantTx,
    query: Pick<CouponsListQuery, "q" | "status" | "discountType" | "view">,
  ): Promise<{
    total_revenue_cents: number;
    total_discount_cents: number;
    total_redemptions: number;
    coupon_count: number;
    active_coupon_count: number;
    currency: string;
  }> {
    const view = query.view;
    const rows = await tx.$queryRaw<
      Array<{
        total_revenue_cents: bigint;
        total_discount_cents: bigint;
        total_redemptions: bigint;
        coupon_count: bigint;
        active_coupon_count: bigint;
        currency: string | null;
      }>
    >`
      with filtered as (
        select c.id, c.status, c.currency
        from sales_coupons c
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${query.status ?? null}::text is null or c.status = ${query.status ?? null})
          and (
            ${query.discountType ?? null}::text is null
            or c.discount_type = ${query.discountType ?? null}
          )
          and (
            ${query.q ?? null}::text is null
            or lower(c.code) like '%' || lower(${query.q ?? null}) || '%'
            or lower(c.name) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${view} = 'all'
            or (${view} = 'active' and c.status = 'ACTIVE')
            or (${view} = 'inactive' and c.status = 'INACTIVE')
            or (
              ${view} = 'never_used'
              and not exists (
                select 1 from sales_coupon_redemptions r
                where r.coupon_id = c.id and r.tenant_id = c.tenant_id
              )
            )
            or (
              ${view} = 'expiring_soon'
              and c.status = 'ACTIVE'
              and c.ends_at is not null
              and c.ends_at >= now()
              and c.ends_at <= now() + interval '14 days'
            )
          )
      )
      select
        coalesce(sum(coalesce(r.original_amount_cents, r.final_amount_cents + r.discount_cents)), 0)::bigint as total_revenue_cents,
        coalesce(sum(r.discount_cents), 0)::bigint as total_discount_cents,
        count(r.id)::bigint as total_redemptions,
        (select count(*)::bigint from filtered) as coupon_count,
        (select count(*)::bigint from filtered where status = 'ACTIVE') as active_coupon_count,
        coalesce(
          (
            select f.currency from filtered f
            join sales_coupon_redemptions rx on rx.coupon_id = f.id
            group by f.currency
            order by count(*) desc
            limit 1
          ),
          (select currency from filtered limit 1),
          'INR'
        ) as currency
      from filtered f
      left join sales_coupon_redemptions r
        on r.coupon_id = f.id and r.tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
    const row = rows[0];
    return {
      total_revenue_cents: Number(row?.total_revenue_cents ?? 0),
      total_discount_cents: Number(row?.total_discount_cents ?? 0),
      total_redemptions: Number(row?.total_redemptions ?? 0),
      coupon_count: Number(row?.coupon_count ?? 0),
      active_coupon_count: Number(row?.active_coupon_count ?? 0),
      currency: row?.currency ?? "INR",
    };
  },

  async findCoupon(tx: TenantTx, couponId: string): Promise<CouponRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        c.id::text as id,
        c.code,
        c.name,
        c.status,
        c.discount_type,
        c.discount_value,
        c.currency,
        c.total_usage_limit,
        c.ends_at,
        c.starts_at,
        count(r.id)::int as redemption_count,
        coalesce(sum(r.discount_cents), 0)::int as total_discount_cents,
        coalesce(sum(coalesce(r.original_amount_cents, r.final_amount_cents + r.discount_cents)), 0)::int as total_revenue_cents,
        c.created_at
      from sales_coupons c
      left join sales_coupon_redemptions r on r.coupon_id = c.id and r.tenant_id = c.tenant_id
      where c.id = ${couponId}::uuid
      group by c.id
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: asUnknownString(row["id"]),
      code: asUnknownString(row["code"]),
      name: asUnknownString(row["name"]),
      status: asUnknownString(row["status"]),
      discount_type: asUnknownString(row["discount_type"]),
      discount_value: Number(row["discount_value"]),
      currency: asUnknownString(row["currency"]),
      redemption_count: Number(row["redemption_count"] ?? 0),
      total_discount_cents: Number(row["total_discount_cents"] ?? 0),
      total_revenue_cents: Number(row["total_revenue_cents"] ?? 0),
      total_usage_limit: row["total_usage_limit"] == null ? null : Number(row["total_usage_limit"]),
      ends_at: (row["ends_at"] as Date | null) ?? null,
      starts_at: (row["starts_at"] as Date | null) ?? null,
      created_at: row["created_at"] as Date,
    };
  },

  async countRedemptions(
    tx: TenantTx,
    couponId: string,
    query: CouponRedemptionsQuery,
  ): Promise<number> {
    const learnerQ = query.q ?? query.learnerName ?? null;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from sales_coupon_redemptions r
      join memberships m on m.id = r.membership_id and m.tenant_id = r.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where r.coupon_id = ${couponId}::uuid
        and (
          ${learnerQ}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${learnerQ}) || '%'
        )
        and (${query.courseId ?? null}::uuid is null or r.course_id = ${query.courseId ?? null}::uuid)
        and (
          ${query.appliedFrom ?? null}::timestamptz is null
          or r.created_at >= ${query.appliedFrom ?? null}::timestamptz
        )
        and (
          ${query.appliedTo ?? null}::timestamptz is null
          or r.created_at <= ${query.appliedTo ?? null}::timestamptz
        )
        and (
          ${query.minFinalAmountCents ?? null}::int is null
          or r.final_amount_cents >= ${query.minFinalAmountCents ?? null}::int
        )
        and (
          ${query.maxFinalAmountCents ?? null}::int is null
          or r.final_amount_cents <= ${query.maxFinalAmountCents ?? null}::int
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listRedemptions(
    tx: TenantTx,
    couponId: string,
    query: CouponRedemptionsQuery,
  ): Promise<CouponRedemptionRow[]> {
    const skip = (query.page - 1) * query.limit;
    const learnerQ = query.q ?? query.learnerName ?? null;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        r.id::text as id,
        r.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        co.title as product_title,
        r.course_id::text as course_id,
        r.discount_cents,
        coalesce(r.original_amount_cents, r.final_amount_cents + r.discount_cents)::int as original_amount_cents,
        r.final_amount_cents,
        r.currency,
        r.payment_order_id::text as payment_order_id,
        po.invoice_number,
        r.created_at as applied_at
      from sales_coupon_redemptions r
      join memberships m on m.id = r.membership_id and m.tenant_id = r.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join courses co on co.id = r.course_id and co.tenant_id = r.tenant_id
      left join payment_orders po on po.id = r.payment_order_id and po.tenant_id = r.tenant_id
      where r.coupon_id = ${couponId}::uuid
        and (
          ${learnerQ}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${learnerQ}) || '%'
        )
        and (${query.courseId ?? null}::uuid is null or r.course_id = ${query.courseId ?? null}::uuid)
        and (
          ${query.appliedFrom ?? null}::timestamptz is null
          or r.created_at >= ${query.appliedFrom ?? null}::timestamptz
        )
        and (
          ${query.appliedTo ?? null}::timestamptz is null
          or r.created_at <= ${query.appliedTo ?? null}::timestamptz
        )
        and (
          ${query.minFinalAmountCents ?? null}::int is null
          or r.final_amount_cents >= ${query.minFinalAmountCents ?? null}::int
        )
        and (
          ${query.maxFinalAmountCents ?? null}::int is null
          or r.final_amount_cents <= ${query.maxFinalAmountCents ?? null}::int
        )
      order by
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then coalesce(mp.display_name, ap.email) end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then coalesce(mp.display_name, ap.email) end desc nulls last,
        case when ${query.sortBy} = 'discount_cents' and ${query.sortDir} = 'asc' then r.discount_cents end asc,
        case when ${query.sortBy} = 'discount_cents' and ${query.sortDir} = 'desc' then r.discount_cents end desc,
        case when ${query.sortBy} = 'final_amount_cents' and ${query.sortDir} = 'asc' then r.final_amount_cents end asc,
        case when ${query.sortBy} = 'final_amount_cents' and ${query.sortDir} = 'desc' then r.final_amount_cents end desc,
        case when ${query.sortBy} = 'applied_at' and ${query.sortDir} = 'asc' then r.created_at end asc,
        case when ${query.sortBy} = 'applied_at' and ${query.sortDir} = 'desc' then r.created_at end desc,
        r.created_at desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map((row) => ({
      id: asUnknownString(row["id"]),
      membership_id: asUnknownString(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      product_title: typeof row["product_title"] === "string" ? row["product_title"] : null,
      course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
      discount_cents: Number(row["discount_cents"] ?? 0),
      original_amount_cents: Number(row["original_amount_cents"] ?? 0),
      final_amount_cents: Number(row["final_amount_cents"] ?? 0),
      currency: asUnknownString(row["currency"]),
      payment_order_id:
        typeof row["payment_order_id"] === "string" ? row["payment_order_id"] : null,
      invoice_number: typeof row["invoice_number"] === "string" ? row["invoice_number"] : null,
      applied_at: row["applied_at"] as Date,
    }));
  },

  async listCouponRedeemerMembershipIds(
    tx: TenantTx,
    couponId: string,
    query: {
      learnerName?: string;
      q?: string;
      courseId?: string;
      appliedFrom?: string;
      appliedTo?: string;
      minFinalAmountCents?: number;
      maxFinalAmountCents?: number;
    },
  ): Promise<string[]> {
    const learnerQ = query.q ?? query.learnerName ?? null;
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select distinct r.membership_id::text as membership_id
      from sales_coupon_redemptions r
      join memberships m on m.id = r.membership_id and m.tenant_id = r.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where r.coupon_id = ${couponId}::uuid
        and (
          ${learnerQ}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${learnerQ}) || '%'
        )
        and (${query.courseId ?? null}::uuid is null or r.course_id = ${query.courseId ?? null}::uuid)
        and (
          ${query.appliedFrom ?? null}::timestamptz is null
          or r.created_at >= ${query.appliedFrom ?? null}::timestamptz
        )
        and (
          ${query.appliedTo ?? null}::timestamptz is null
          or r.created_at <= ${query.appliedTo ?? null}::timestamptz
        )
        and (
          ${query.minFinalAmountCents ?? null}::int is null
          or r.final_amount_cents >= ${query.minFinalAmountCents ?? null}::int
        )
        and (
          ${query.maxFinalAmountCents ?? null}::int is null
          or r.final_amount_cents <= ${query.maxFinalAmountCents ?? null}::int
        )
      order by membership_id
      limit 2000
    `;
    return rows.map((r) => r.membership_id);
  },

  async listCouponRedemptionProducts(
    tx: TenantTx,
    couponId: string,
  ): Promise<
    Array<{
      course_id: string | null;
      product_title: string;
      redemption_count: number;
      revenue_cents: number;
      discount_cents: number;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        r.course_id::text as course_id,
        coalesce(co.title, 'Unknown product') as product_title,
        count(*)::int as redemption_count,
        coalesce(sum(coalesce(r.original_amount_cents, r.final_amount_cents + r.discount_cents)), 0)::int as revenue_cents,
        coalesce(sum(r.discount_cents), 0)::int as discount_cents
      from sales_coupon_redemptions r
      left join courses co on co.id = r.course_id and co.tenant_id = r.tenant_id
      where r.coupon_id = ${couponId}::uuid
      group by r.course_id, co.title
      order by redemption_count desc, revenue_cents desc
      limit 12
    `;
    return rows.map((row) => ({
      course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
      product_title: asUnknownString(row["product_title"], "Unknown product"),
      redemption_count: Number(row["redemption_count"] ?? 0),
      revenue_cents: Number(row["revenue_cents"] ?? 0),
      discount_cents: Number(row["discount_cents"] ?? 0),
    }));
  },

  async listCouponRedemptionTrend(
    tx: TenantTx,
    couponId: string,
  ): Promise<
    Array<{
      date: string;
      redemption_count: number;
      revenue_cents: number;
      discount_cents: number;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        to_char(date_trunc('day', r.created_at), 'YYYY-MM-DD') as date,
        count(*)::int as redemption_count,
        coalesce(sum(coalesce(r.original_amount_cents, r.final_amount_cents + r.discount_cents)), 0)::int as revenue_cents,
        coalesce(sum(r.discount_cents), 0)::int as discount_cents
      from sales_coupon_redemptions r
      where r.coupon_id = ${couponId}::uuid
        and r.created_at >= now() - interval '90 days'
      group by 1
      order by 1 asc
    `;
    return rows.map((row) => ({
      date: asUnknownString(row["date"]),
      redemption_count: Number(row["redemption_count"] ?? 0),
      revenue_cents: Number(row["revenue_cents"] ?? 0),
      discount_cents: Number(row["discount_cents"] ?? 0),
    }));
  },

  async countCouponFirstTimeBuyers(tx: TenantTx, couponId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from sales_coupon_redemptions r
      where r.coupon_id = ${couponId}::uuid
        and not exists (
          select 1
          from payment_orders po
          where po.membership_id = r.membership_id
            and po.tenant_id = r.tenant_id
            and po.status = 'paid'
            and po.paid_at is not null
            and (
              r.payment_order_id is null
              or po.id <> r.payment_order_id
            )
            and (
              r.created_at is null
              or po.paid_at < r.created_at
            )
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },
};
