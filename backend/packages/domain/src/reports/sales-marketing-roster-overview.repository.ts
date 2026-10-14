import type { TenantTx } from "@atlas/db";
import type { SalesMarketingOverviewGrain } from "./sales-marketing-roster.dto";
import type { SalesMarketingOverviewFilter } from "./sales-marketing-roster.repository";
import { asUnknownString } from "./sales-marketing-roster.repository-helpers";

/**
 * The sales and marketing overview: totals, attribution, trend and top lists.
 * Part of salesMarketingRosterRepository.
 */
export const salesMarketingRosterOverviewRepository = {
  async getOverviewSummary(
    tx: TenantTx,
    filter: SalesMarketingOverviewFilter,
  ): Promise<{
    attributed_revenue_cents: number;
    discount_given_cents: number;
    commission_earned_cents: number;
    referral_credit: number;
    order_count: number;
    currencies: string[];
  }> {
    const [revenueRows, discountRows, commissionRows, creditRows] = await Promise.all([
      tx.$queryRaw<
        Array<{
          attributed_revenue_cents: bigint;
          order_count: bigint;
          currencies: string[] | null;
        }>
      >`
        select
          coalesce(sum(po.amount_cents), 0)::bigint as attributed_revenue_cents,
          count(*)::bigint as order_count,
          array_agg(distinct po.currency) as currencies
        from payment_orders po
        where po.tenant_id = current_setting('app.tenant_id', true)::uuid
          and po.status = 'paid'
          and coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom}::timestamptz
          and coalesce(po.paid_at, po.created_at) <= ${filter.paidTo}::timestamptz
          and (
            ${filter.currency ?? null}::text is null
            or upper(po.currency) = upper(${filter.currency ?? null})
          )
      `,
      tx.$queryRaw<Array<{ discount_given_cents: bigint }>>`
        select coalesce(sum(r.discount_cents), 0)::bigint as discount_given_cents
        from sales_coupon_redemptions r
        where r.tenant_id = current_setting('app.tenant_id', true)::uuid
          and r.created_at >= ${filter.paidFrom}::timestamptz
          and r.created_at <= ${filter.paidTo}::timestamptz
          and (
            ${filter.currency ?? null}::text is null
            or upper(r.currency) = upper(${filter.currency ?? null})
          )
      `,
      tx.$queryRaw<Array<{ commission_earned_cents: bigint }>>`
        select coalesce(sum(c.commission_cents), 0)::bigint as commission_earned_cents
        from sales_affiliate_commissions c
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.created_at >= ${filter.paidFrom}::timestamptz
          and c.created_at <= ${filter.paidTo}::timestamptz
          and (
            ${filter.currency ?? null}::text is null
            or upper(c.currency) = upper(${filter.currency ?? null})
          )
      `,
      tx.$queryRaw<Array<{ referral_credit: bigint }>>`
        select coalesce(sum(t.credits), 0)::bigint as referral_credit
        from sales_wallet_transactions t
        where t.tenant_id = current_setting('app.tenant_id', true)::uuid
          and t.direction = 'CREDIT'
          and t.reason in ('REFERRAL_SIGNUP', 'REFERRAL_PURCHASE')
          and t.created_at >= ${filter.paidFrom}::timestamptz
          and t.created_at <= ${filter.paidTo}::timestamptz
      `,
    ]);

    const revenue = revenueRows[0];
    return {
      attributed_revenue_cents: Number(revenue?.attributed_revenue_cents ?? 0),
      discount_given_cents: Number(discountRows[0]?.discount_given_cents ?? 0),
      commission_earned_cents: Number(commissionRows[0]?.commission_earned_cents ?? 0),
      referral_credit: Number(creditRows[0]?.referral_credit ?? 0),
      order_count: Number(revenue?.order_count ?? 0),
      currencies: (revenue?.currencies ?? []).filter(Boolean),
    };
  },

  async getOverviewCollectedInWindow(
    tx: TenantTx,
    filter: SalesMarketingOverviewFilter,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ attributed_revenue_cents: bigint }>>`
      select coalesce(sum(po.amount_cents), 0)::bigint as attributed_revenue_cents
      from payment_orders po
      where po.tenant_id = current_setting('app.tenant_id', true)::uuid
        and po.status = 'paid'
        and coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom}::timestamptz
        and coalesce(po.paid_at, po.created_at) <= ${filter.paidTo}::timestamptz
        and (
          ${filter.currency ?? null}::text is null
          or upper(po.currency) = upper(${filter.currency ?? null})
        )
    `;
    return Number(rows[0]?.attributed_revenue_cents ?? 0);
  },

  async getOverviewAttribution(
    tx: TenantTx,
    filter: SalesMarketingOverviewFilter,
  ): Promise<{
    direct_cents: number;
    coupon_cents: number;
    referral_cents: number;
    affiliate_cents: number;
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        direct_cents: bigint;
        coupon_cents: bigint;
        referral_cents: bigint;
        affiliate_cents: bigint;
      }>
    >`
      with paid as (
        select
          po.id,
          po.amount_cents,
          exists (
            select 1 from sales_affiliate_commissions ac
            where ac.payment_order_id = po.id and ac.tenant_id = po.tenant_id
          ) as is_affiliate,
          exists (
            select 1 from sales_referral_purchase_credits rpc
            where rpc.payment_order_id = po.id and rpc.tenant_id = po.tenant_id
          ) as is_referral,
          exists (
            select 1 from sales_coupon_redemptions r
            where r.payment_order_id = po.id and r.tenant_id = po.tenant_id
          ) as is_coupon
        from payment_orders po
        where po.tenant_id = current_setting('app.tenant_id', true)::uuid
          and po.status = 'paid'
          and coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom}::timestamptz
          and coalesce(po.paid_at, po.created_at) <= ${filter.paidTo}::timestamptz
          and (
            ${filter.currency ?? null}::text is null
            or upper(po.currency) = upper(${filter.currency ?? null})
          )
      )
      select
        coalesce(sum(case
          when is_affiliate then 0
          when is_referral then 0
          when is_coupon then 0
          else amount_cents
        end), 0)::bigint as direct_cents,
        coalesce(sum(case
          when is_affiliate then 0
          when is_referral then 0
          when is_coupon then amount_cents
          else 0
        end), 0)::bigint as coupon_cents,
        coalesce(sum(case
          when is_affiliate then 0
          when is_referral then amount_cents
          else 0
        end), 0)::bigint as referral_cents,
        coalesce(sum(case when is_affiliate then amount_cents else 0 end), 0)::bigint as affiliate_cents
      from paid
    `;
    const row = rows[0];
    return {
      direct_cents: Number(row?.direct_cents ?? 0),
      coupon_cents: Number(row?.coupon_cents ?? 0),
      referral_cents: Number(row?.referral_cents ?? 0),
      affiliate_cents: Number(row?.affiliate_cents ?? 0),
    };
  },

  async getOverviewRevenueTrend(
    tx: TenantTx,
    filter: SalesMarketingOverviewFilter,
    grain: SalesMarketingOverviewGrain,
  ): Promise<
    Array<{
      date: string;
      direct_cents: number;
      coupon_cents: number;
      referral_cents: number;
      affiliate_cents: number;
      total_cents: number;
      order_count: number;
    }>
  > {
    const trunc = grain === "month" ? "month" : grain === "day" ? "day" : "week";
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with paid as (
        select
          date_trunc(${trunc}, coalesce(po.paid_at, po.created_at)) as bucket,
          po.amount_cents,
          exists (
            select 1 from sales_affiliate_commissions ac
            where ac.payment_order_id = po.id and ac.tenant_id = po.tenant_id
          ) as is_affiliate,
          exists (
            select 1 from sales_referral_purchase_credits rpc
            where rpc.payment_order_id = po.id and rpc.tenant_id = po.tenant_id
          ) as is_referral,
          exists (
            select 1 from sales_coupon_redemptions r
            where r.payment_order_id = po.id and r.tenant_id = po.tenant_id
          ) as is_coupon
        from payment_orders po
        where po.tenant_id = current_setting('app.tenant_id', true)::uuid
          and po.status = 'paid'
          and coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom}::timestamptz
          and coalesce(po.paid_at, po.created_at) <= ${filter.paidTo}::timestamptz
          and (
            ${filter.currency ?? null}::text is null
            or upper(po.currency) = upper(${filter.currency ?? null})
          )
      )
      select
        to_char(bucket at time zone 'UTC', 'YYYY-MM-DD') as date,
        coalesce(sum(case
          when is_affiliate then 0
          when is_referral then 0
          when is_coupon then 0
          else amount_cents
        end), 0)::int as direct_cents,
        coalesce(sum(case
          when is_affiliate then 0
          when is_referral then 0
          when is_coupon then amount_cents
          else 0
        end), 0)::int as coupon_cents,
        coalesce(sum(case
          when is_affiliate then 0
          when is_referral then amount_cents
          else 0
        end), 0)::int as referral_cents,
        coalesce(sum(case when is_affiliate then amount_cents else 0 end), 0)::int as affiliate_cents,
        coalesce(sum(amount_cents), 0)::int as total_cents,
        count(*)::int as order_count
      from paid
      group by bucket
      order by bucket asc
    `;
    return rows.map((row) => ({
      date: asUnknownString(row["date"], ""),
      direct_cents: Number(row["direct_cents"] ?? 0),
      coupon_cents: Number(row["coupon_cents"] ?? 0),
      referral_cents: Number(row["referral_cents"] ?? 0),
      affiliate_cents: Number(row["affiliate_cents"] ?? 0),
      total_cents: Number(row["total_cents"] ?? 0),
      order_count: Number(row["order_count"] ?? 0),
    }));
  },

  async getOverviewTopProducts(
    tx: TenantTx,
    filter: SalesMarketingOverviewFilter,
  ): Promise<
    Array<{
      course_id: string | null;
      product_title: string;
      product_type: string;
      purchaser_count: number;
      revenue_cents: number;
      discount_cents: number;
      net_cents: number;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        nullif(po.metadata_json->>'courseId', '') as course_id,
        coalesce(nullif(po.product_title, ''), 'Untitled product') as product_title,
        coalesce(nullif(po.product_type, ''), 'course') as product_type,
        count(distinct po.membership_id)::int as purchaser_count,
        coalesce(sum(po.amount_cents), 0)::int as revenue_cents,
        coalesce(sum(coalesce(po.coupon_amount_cents, 0)), 0)::int as discount_cents,
        coalesce(sum(po.amount_cents - coalesce(po.coupon_amount_cents, 0)), 0)::int as net_cents
      from payment_orders po
      where po.tenant_id = current_setting('app.tenant_id', true)::uuid
        and po.status = 'paid'
        and coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom}::timestamptz
        and coalesce(po.paid_at, po.created_at) <= ${filter.paidTo}::timestamptz
        and (
          ${filter.currency ?? null}::text is null
          or upper(po.currency) = upper(${filter.currency ?? null})
        )
      group by 1, 2, 3
      order by revenue_cents desc
      limit 5
    `;
    return rows.map((row) => {
      const courseId = row["course_id"];
      return {
        course_id: typeof courseId === "string" && courseId.length > 0 ? courseId : null,
        product_title: asUnknownString(row["product_title"], "Untitled product"),
        product_type: asUnknownString(row["product_type"], "course"),
        purchaser_count: Number(row["purchaser_count"] ?? 0),
        revenue_cents: Number(row["revenue_cents"] ?? 0),
        discount_cents: Number(row["discount_cents"] ?? 0),
        net_cents: Math.max(0, Number(row["net_cents"] ?? 0)),
      };
    });
  },

  async getOverviewTopCoupons(
    tx: TenantTx,
    filter: SalesMarketingOverviewFilter,
  ): Promise<Array<{ id: string; code: string; uses: number; generated_cents: number }>> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        c.id::text as id,
        c.code,
        count(r.id)::int as uses,
        coalesce(sum(r.final_amount_cents), 0)::int as generated_cents
      from sales_coupons c
      inner join sales_coupon_redemptions r
        on r.coupon_id = c.id and r.tenant_id = c.tenant_id
      where c.tenant_id = current_setting('app.tenant_id', true)::uuid
        and r.created_at >= ${filter.paidFrom}::timestamptz
        and r.created_at <= ${filter.paidTo}::timestamptz
        and (
          ${filter.currency ?? null}::text is null
          or upper(r.currency) = upper(${filter.currency ?? null})
        )
      group by c.id
      order by generated_cents desc, uses desc
      limit 5
    `;
    return rows.map((row) => ({
      id: asUnknownString(row["id"]),
      code: asUnknownString(row["code"], ""),
      uses: Number(row["uses"] ?? 0),
      generated_cents: Number(row["generated_cents"] ?? 0),
    }));
  },

  async getOverviewTopAffiliates(
    tx: TenantTx,
    filter: SalesMarketingOverviewFilter,
  ): Promise<
    Array<{
      affiliate_id: string;
      name: string;
      commission_cents: number;
      unpaid_cents: number;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        a.id::text as affiliate_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized, a.coupon_code) as name,
        coalesce(sum(c.commission_cents), 0)::int as commission_cents,
        coalesce(sum(case when c.status = 'UNPAID' then c.commission_cents else 0 end), 0)::int as unpaid_cents
      from sales_affiliates a
      inner join sales_affiliate_commissions c
        on c.affiliate_id = a.id and c.tenant_id = a.tenant_id
      left join memberships m on m.id = a.membership_id and m.tenant_id = a.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where a.tenant_id = current_setting('app.tenant_id', true)::uuid
        and c.created_at >= ${filter.paidFrom}::timestamptz
        and c.created_at <= ${filter.paidTo}::timestamptz
        and (
          ${filter.currency ?? null}::text is null
          or upper(c.currency) = upper(${filter.currency ?? null})
        )
      group by a.id, mp.display_name, ap.email, m.invited_email_normalized, a.coupon_code
      order by commission_cents desc
      limit 5
    `;
    return rows.map((row) => ({
      affiliate_id: asUnknownString(row["affiliate_id"]),
      name: asUnknownString(row["name"], "Affiliate"),
      commission_cents: Number(row["commission_cents"] ?? 0),
      unpaid_cents: Number(row["unpaid_cents"] ?? 0),
    }));
  },

  async getOverviewAttention(tx: TenantTx): Promise<{
    unpaid_commission_count: number;
    over_limit_coupon_count: number;
    pending_affiliate_request_count: number;
    pending_referral_count: number;
  }> {
    const [unpaid, overLimit, pendingAff, pendingRef] = await Promise.all([
      tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from sales_affiliate_commissions c
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.status = 'UNPAID'
      `,
      tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from sales_coupons c
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.total_usage_limit is not null
          and (
            select count(*) from sales_coupon_redemptions r
            where r.coupon_id = c.id and r.tenant_id = c.tenant_id
          ) > c.total_usage_limit
      `,
      tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from sales_affiliate_requests r
        where r.tenant_id = current_setting('app.tenant_id', true)::uuid
          and r.status = 'PENDING'
      `,
      tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from sales_referral_pending p
        where p.tenant_id = current_setting('app.tenant_id', true)::uuid
          and p.expires_at > now()
      `,
    ]);
    return {
      unpaid_commission_count: Number(unpaid[0]?.count ?? 0),
      over_limit_coupon_count: Number(overLimit[0]?.count ?? 0),
      pending_affiliate_request_count: Number(pendingAff[0]?.count ?? 0),
      pending_referral_count: Number(pendingRef[0]?.count ?? 0),
    };
  },
};
