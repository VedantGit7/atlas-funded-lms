import type { TenantTx } from "@atlas/db";
import type {
  AffiliateProductsQuery,
  AffiliatesQuery,
  CouponRedemptionsQuery,
  CouponsListQuery,
  ReferralWalletQuery,
  SalesMarketingOverviewGrain,
  SalesProductsQuery,
  SalesPurchasersQuery,
} from "./sales-marketing-roster.dto";

function asUnknownString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return fallback;
  return fallback;
}

export type SalesProductRow = {
  course_id: string;
  product_title: string;
  product_type: string;
  product_status: string;
  revenue_cents: number;
  discount_cents: number;
  net_cents: number;
  currency: string;
  units_sold: number;
  paid_learner_count: number;
  trial_learner_count: number;
  purchaser_count: number;
  discounted_order_count: number;
  avg_unit_price_cents: number;
};

export type SalesPurchaserRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  amount_cents: number;
  discount_cents: number;
  currency: string;
  enrolled_type: string | null;
  coupon_code: string | null;
  purchased_at: Date;
  payment_order_id: string | null;
  invoice_number: string | null;
};

export type CouponRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  discount_type: string;
  discount_value: number;
  currency: string;
  redemption_count: number;
  total_discount_cents: number;
  total_revenue_cents: number;
  total_usage_limit: number | null;
  ends_at: Date | null;
  starts_at: Date | null;
  created_at: Date;
};

export type CouponRedemptionRow = {
  id: string;
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  product_title: string | null;
  course_id: string | null;
  discount_cents: number;
  original_amount_cents: number;
  final_amount_cents: number;
  currency: string;
  payment_order_id: string | null;
  invoice_number: string | null;
  applied_at: Date;
};

export type ReferralWalletRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  referral_code: string | null;
  successful_referrals: number;
  credit_earned: number;
  wallet_balance: number;
  referred_revenue_cents: number;
  signed_up_at: Date | null;
};

export type AffiliateProductRow = {
  course_id: string;
  product_title: string;
  product_type: string;
  enabled: boolean;
  commission_rate_pct: number;
  inherits_default_rate: boolean;
  tenant_default_commission_pct: number;
  order_count: number;
  revenue_cents: number;
  commission_cents: number;
  net_cents: number;
  effective_rate_pct: number;
  active_affiliate_count: number;
  unpaid_commission_cents: number;
  published_at: Date | null;
  currency: string;
};

export type AffiliateRow = {
  affiliate_id: string;
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  tier: string;
  status: string;
  coupon_code: string;
  revenue_contribution_cents: number;
  commission_earned_cents: number;
  unpaid_cents: number;
  paid_cents: number;
  signed_up_at: Date;
  currency: string;
};

export type PurchaserFilter = {
  courseId: string;
  learnerName?: string;
  email?: string;
  q?: string;
  enrolledType?: string;
  purchasedFrom?: string;
  purchasedTo?: string;
};

export type SalesMarketingOverviewFilter = {
  paidFrom: string;
  paidTo: string;
  currency?: string;
};

export const salesMarketingRosterRepository = {
  async countSalesProducts(tx: TenantTx, query: SalesProductsQuery): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from courses c
      where c.tenant_id = current_setting('app.tenant_id', true)::uuid
        and c.deleted_at is null
        and exists (
          select 1 from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
            and (
              ${query.paidFrom ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz
            )
            and (
              ${query.paidTo ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz
            )
            and (
              ${query.currency ?? null}::text is null
              or upper(po.currency) = upper(${query.currency ?? null})
            )
            and (
              ${query.productType ?? null}::text is null
              or lower(coalesce(po.product_type, 'course')) = lower(${query.productType ?? null})
            )
        )
        and (
          ${query.q ?? null}::text is null
          or lower(c.title) like '%' || lower(${query.q ?? null}) || '%'
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listSalesProducts(tx: TenantTx, query: SalesProductsQuery): Promise<SalesProductRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        c.id::text as course_id,
        c.title as product_title,
        c.status::text as product_status,
        coalesce((
          select lower(coalesce(po.product_type, 'course'))
          from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
            and (
              ${query.paidFrom ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz
            )
            and (
              ${query.paidTo ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz
            )
          group by lower(coalesce(po.product_type, 'course'))
          order by count(*) desc
          limit 1
        ), 'course') as product_type,
        coalesce((
          select sum(po.amount_cents)::int
          from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
            and (
              ${query.paidFrom ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz
            )
            and (
              ${query.paidTo ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz
            )
            and (
              ${query.currency ?? null}::text is null
              or upper(po.currency) = upper(${query.currency ?? null})
            )
            and (
              ${query.productType ?? null}::text is null
              or lower(coalesce(po.product_type, 'course')) = lower(${query.productType ?? null})
            )
        ), 0) as revenue_cents,
        coalesce((
          select sum(coalesce(po.coupon_amount_cents, 0))::int
          from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
            and (
              ${query.paidFrom ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz
            )
            and (
              ${query.paidTo ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz
            )
            and (
              ${query.currency ?? null}::text is null
              or upper(po.currency) = upper(${query.currency ?? null})
            )
            and (
              ${query.productType ?? null}::text is null
              or lower(coalesce(po.product_type, 'course')) = lower(${query.productType ?? null})
            )
        ), 0) as discount_cents,
        coalesce((
          select po.currency
          from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
            and (
              ${query.paidFrom ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz
            )
            and (
              ${query.paidTo ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz
            )
          order by po.paid_at desc nulls last
          limit 1
        ), 'INR') as currency,
        coalesce((
          select count(*)::int
          from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
            and (
              ${query.paidFrom ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz
            )
            and (
              ${query.paidTo ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz
            )
            and (
              ${query.currency ?? null}::text is null
              or upper(po.currency) = upper(${query.currency ?? null})
            )
            and (
              ${query.productType ?? null}::text is null
              or lower(coalesce(po.product_type, 'course')) = lower(${query.productType ?? null})
            )
        ), 0) as units_sold,
        (
          select count(distinct e.membership_id)::int
          from enrollments e
          where e.course_id = c.id and e.tenant_id = c.tenant_id and e.enrolled_type = 'paid'
        ) as paid_learner_count,
        (
          select count(distinct e.membership_id)::int
          from enrollments e
          where e.course_id = c.id and e.tenant_id = c.tenant_id and e.enrolled_type = 'trial'
        ) as trial_learner_count,
        (
          select count(distinct po.membership_id)::int
          from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and po.membership_id is not null
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
            and (
              ${query.paidFrom ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz
            )
            and (
              ${query.paidTo ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz
            )
            and (
              ${query.currency ?? null}::text is null
              or upper(po.currency) = upper(${query.currency ?? null})
            )
            and (
              ${query.productType ?? null}::text is null
              or lower(coalesce(po.product_type, 'course')) = lower(${query.productType ?? null})
            )
        ) as purchaser_count
      from courses c
      where c.tenant_id = current_setting('app.tenant_id', true)::uuid
        and c.deleted_at is null
        and exists (
          select 1 from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
            and (
              ${query.paidFrom ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz
            )
            and (
              ${query.paidTo ?? null}::timestamptz is null
              or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz
            )
            and (
              ${query.currency ?? null}::text is null
              or upper(po.currency) = upper(${query.currency ?? null})
            )
            and (
              ${query.productType ?? null}::text is null
              or lower(coalesce(po.product_type, 'course')) = lower(${query.productType ?? null})
            )
        )
        and (
          ${query.q ?? null}::text is null
          or lower(c.title) like '%' || lower(${query.q ?? null}) || '%'
        )
      order by
        case when ${query.sortBy} = 'revenue_cents' and ${query.sortDir} = 'asc' then coalesce((
          select sum(po.amount_cents)::int from payment_orders po
          where po.tenant_id = c.tenant_id and po.status = 'paid'
            and ((po.metadata_json->>'courseId') = c.id::text or po.product_title = c.title)
            and (${query.paidFrom ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz)
            and (${query.paidTo ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz)
            and (${query.currency ?? null}::text is null or upper(po.currency) = upper(${query.currency ?? null}))
            and (${query.productType ?? null}::text is null or lower(coalesce(po.product_type, 'course')) = lower(${query.productType ?? null}))
        ), 0) end asc nulls last,
        case when ${query.sortBy} = 'revenue_cents' and ${query.sortDir} = 'desc' then coalesce((
          select sum(po.amount_cents)::int from payment_orders po
          where po.tenant_id = c.tenant_id and po.status = 'paid'
            and ((po.metadata_json->>'courseId') = c.id::text or po.product_title = c.title)
            and (${query.paidFrom ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz)
            and (${query.paidTo ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz)
            and (${query.currency ?? null}::text is null or upper(po.currency) = upper(${query.currency ?? null}))
            and (${query.productType ?? null}::text is null or lower(coalesce(po.product_type, 'course')) = lower(${query.productType ?? null}))
        ), 0) end desc nulls last,
        case when ${query.sortBy} = 'purchaser_count' and ${query.sortDir} = 'asc' then coalesce((
          select count(*)::int from payment_orders po
          where po.tenant_id = c.tenant_id and po.status = 'paid'
            and ((po.metadata_json->>'courseId') = c.id::text or po.product_title = c.title)
            and (${query.paidFrom ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz)
            and (${query.paidTo ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz)
        ), 0) end asc nulls last,
        case when ${query.sortBy} = 'purchaser_count' and ${query.sortDir} = 'desc' then coalesce((
          select count(*)::int from payment_orders po
          where po.tenant_id = c.tenant_id and po.status = 'paid'
            and ((po.metadata_json->>'courseId') = c.id::text or po.product_title = c.title)
            and (${query.paidFrom ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz)
            and (${query.paidTo ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz)
        ), 0) end desc nulls last,
        case when ${query.sortBy} = 'discount_cents' and ${query.sortDir} = 'asc' then coalesce((
          select sum(coalesce(po.coupon_amount_cents, 0))::int from payment_orders po
          where po.tenant_id = c.tenant_id and po.status = 'paid'
            and ((po.metadata_json->>'courseId') = c.id::text or po.product_title = c.title)
            and (${query.paidFrom ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz)
            and (${query.paidTo ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz)
        ), 0) end asc nulls last,
        case when ${query.sortBy} = 'discount_cents' and ${query.sortDir} = 'desc' then coalesce((
          select sum(coalesce(po.coupon_amount_cents, 0))::int from payment_orders po
          where po.tenant_id = c.tenant_id and po.status = 'paid'
            and ((po.metadata_json->>'courseId') = c.id::text or po.product_title = c.title)
            and (${query.paidFrom ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz)
            and (${query.paidTo ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz)
        ), 0) end desc nulls last,
        case when ${query.sortBy} = 'net_cents' and ${query.sortDir} = 'asc' then coalesce((
          select sum(po.amount_cents - coalesce(po.coupon_amount_cents, 0))::int from payment_orders po
          where po.tenant_id = c.tenant_id and po.status = 'paid'
            and ((po.metadata_json->>'courseId') = c.id::text or po.product_title = c.title)
            and (${query.paidFrom ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz)
            and (${query.paidTo ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz)
        ), 0) end asc nulls last,
        case when ${query.sortBy} = 'net_cents' and ${query.sortDir} = 'desc' then coalesce((
          select sum(po.amount_cents - coalesce(po.coupon_amount_cents, 0))::int from payment_orders po
          where po.tenant_id = c.tenant_id and po.status = 'paid'
            and ((po.metadata_json->>'courseId') = c.id::text or po.product_title = c.title)
            and (${query.paidFrom ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz)
            and (${query.paidTo ?? null}::timestamptz is null or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz)
        ), 0) end desc nulls last,
        case when ${query.sortBy} = 'product_title' and ${query.sortDir} = 'asc' then c.title end asc nulls last,
        case when ${query.sortBy} = 'product_title' and ${query.sortDir} = 'desc' then c.title end desc nulls last,
        c.title asc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => {
      const revenue = Number(row["revenue_cents"] ?? 0);
      const discount = Number(row["discount_cents"] ?? 0);
      const units = Number(row["units_sold"] ?? 0);
      return {
        course_id: asUnknownString(row["course_id"]),
        product_title: asUnknownString(row["product_title"]),
        product_type: asUnknownString(row["product_type"], "course"),
        product_status: asUnknownString(row["product_status"], "DRAFT"),
        revenue_cents: revenue,
        discount_cents: discount,
        net_cents: Math.max(0, revenue - discount),
        currency: asUnknownString(row["currency"], "INR"),
        units_sold: units,
        paid_learner_count: Number(row["paid_learner_count"] ?? 0),
        trial_learner_count: Number(row["trial_learner_count"] ?? 0),
        purchaser_count: Number(row["purchaser_count"] ?? 0),
        discounted_order_count: Number(row["discounted_order_count"] ?? 0),
        avg_unit_price_cents: units === 0 ? 0 : Math.round(revenue / units),
      };
    });
  },

  async getSalesProductsSummary(
    tx: TenantTx,
    query: Pick<SalesProductsQuery, "q" | "paidFrom" | "paidTo" | "productType" | "currency">,
  ): Promise<{
    total_revenue_cents: number;
    total_discount_cents: number;
    total_units_sold: number;
    product_count: number;
    currencies: string[];
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        total_revenue_cents: bigint;
        total_discount_cents: bigint;
        total_units_sold: bigint;
        product_count: bigint;
        currencies: string[] | null;
      }>
    >`
      select
        coalesce(sum(po.amount_cents), 0)::bigint as total_revenue_cents,
        coalesce(sum(coalesce(po.coupon_amount_cents, 0)), 0)::bigint as total_discount_cents,
        count(*)::bigint as total_units_sold,
        count(distinct coalesce(po.metadata_json->>'courseId', po.product_title))::bigint as product_count,
        array_agg(distinct po.currency) as currencies
      from payment_orders po
      where po.tenant_id = current_setting('app.tenant_id', true)::uuid
        and po.status = 'paid'
        and (
          ${query.paidFrom ?? null}::timestamptz is null
          or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz
        )
        and (
          ${query.paidTo ?? null}::timestamptz is null
          or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz
        )
        and (
          ${query.currency ?? null}::text is null
          or upper(po.currency) = upper(${query.currency ?? null})
        )
        and (
          ${query.productType ?? null}::text is null
          or lower(coalesce(po.product_type, 'course')) = lower(${query.productType ?? null})
        )
        and (
          ${query.q ?? null}::text is null
          or lower(coalesce(po.product_title, '')) like '%' || lower(${query.q ?? null}) || '%'
          or exists (
            select 1 from courses c
            where c.tenant_id = po.tenant_id
              and c.deleted_at is null
              and (po.metadata_json->>'courseId') = c.id::text
              and lower(c.title) like '%' || lower(${query.q ?? null}) || '%'
          )
        )
    `;
    const row = rows[0];
    return {
      total_revenue_cents: Number(row?.total_revenue_cents ?? 0),
      total_discount_cents: Number(row?.total_discount_cents ?? 0),
      total_units_sold: Number(row?.total_units_sold ?? 0),
      product_count: Number(row?.product_count ?? 0),
      currencies: (row?.currencies ?? []).filter(Boolean),
    };
  },

  async listSalesProductTypes(
    tx: TenantTx,
    query: Pick<SalesProductsQuery, "paidFrom" | "paidTo" | "currency">,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ product_type: string }>>`
      select distinct lower(coalesce(po.product_type, 'course')) as product_type
      from payment_orders po
      where po.tenant_id = current_setting('app.tenant_id', true)::uuid
        and po.status = 'paid'
        and (
          ${query.paidFrom ?? null}::timestamptz is null
          or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz
        )
        and (
          ${query.paidTo ?? null}::timestamptz is null
          or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz
        )
        and (
          ${query.currency ?? null}::text is null
          or upper(po.currency) = upper(${query.currency ?? null})
        )
      order by product_type asc
    `;
    return rows.map((row) => row.product_type);
  },

  async findSalesProduct(tx: TenantTx, courseId: string): Promise<SalesProductRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        c.id::text as course_id,
        c.title as product_title,
        c.status::text as product_status,
        coalesce((
          select lower(coalesce(po.product_type, 'course'))
          from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
          group by lower(coalesce(po.product_type, 'course'))
          order by count(*) desc
          limit 1
        ), 'course') as product_type,
        coalesce((
          select sum(po.amount_cents)::int
          from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
        ), 0) as revenue_cents,
        coalesce((
          select sum(coalesce(po.coupon_amount_cents, 0))::int
          from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
        ), 0) as discount_cents,
        coalesce((
          select po.currency
          from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
          order by po.paid_at desc nulls last
          limit 1
        ), 'INR') as currency,
        (
          select count(distinct e.membership_id)::int
          from enrollments e
          where e.course_id = c.id and e.tenant_id = c.tenant_id and e.enrolled_type = 'paid'
        ) as paid_learner_count,
        (
          select count(distinct e.membership_id)::int
          from enrollments e
          where e.course_id = c.id and e.tenant_id = c.tenant_id and e.enrolled_type = 'trial'
        ) as trial_learner_count,
        (
          select count(distinct po.membership_id)::int
          from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and po.membership_id is not null
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
        ) as purchaser_count,
        (
          select count(*)::int
          from payment_orders po
          where po.tenant_id = c.tenant_id
            and po.status = 'paid'
            and coalesce(po.coupon_amount_cents, 0) > 0
            and (
              (po.metadata_json->>'courseId') = c.id::text
              or po.product_title = c.title
            )
        ) as discounted_order_count
      from courses c
      where c.id = ${courseId}::uuid and c.deleted_at is null
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    const revenue = Number(row["revenue_cents"] ?? 0);
    const discount = Number(row["discount_cents"] ?? 0);
    const units = Number(row["purchaser_count"] ?? 0);
    return {
      course_id: asUnknownString(row["course_id"]),
      product_title: asUnknownString(row["product_title"]),
      product_type: asUnknownString(row["product_type"], "course"),
      product_status: asUnknownString(row["product_status"], "DRAFT"),
      revenue_cents: revenue,
      discount_cents: discount,
      net_cents: Math.max(0, revenue - discount),
      currency: asUnknownString(row["currency"], "INR"),
      units_sold: units,
      paid_learner_count: Number(row["paid_learner_count"] ?? 0),
      trial_learner_count: Number(row["trial_learner_count"] ?? 0),
      purchaser_count: units,
      discounted_order_count: Number(row["discounted_order_count"] ?? 0),
      avg_unit_price_cents: units === 0 ? 0 : Math.round(revenue / units),
    };
  },

  async countPurchasers(tx: TenantTx, filter: PurchaserFilter): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from (
        select distinct on (coalesce(po.membership_id, e.membership_id))
          coalesce(po.membership_id, e.membership_id) as membership_id
        from courses c
        left join payment_orders po
          on po.tenant_id = c.tenant_id
          and po.status = 'paid'
          and po.membership_id is not null
          and (
            (po.metadata_json->>'courseId') = c.id::text
            or po.product_title = c.title
          )
        left join enrollments e
          on e.course_id = c.id and e.tenant_id = c.tenant_id
          and e.enrolled_type in ('paid', 'trial', 'complimentary', 'manual', 'offline')
        left join memberships m
          on m.id = coalesce(po.membership_id, e.membership_id) and m.tenant_id = c.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where c.id = ${filter.courseId}::uuid
          and coalesce(po.membership_id, e.membership_id) is not null
          and (
            ${filter.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.learnerName ?? null}) || '%'
          )
          and (
            ${filter.email ?? null}::text is null
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.email ?? null}) || '%'
          )
          and (
            ${filter.q ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.q ?? null}) || '%'
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.q ?? null}) || '%'
          )
          and (
            ${filter.enrolledType ?? null}::text is null
            or lower(coalesce(e.enrolled_type, '')) = lower(${filter.enrolledType ?? null})
          )
          and (
            ${filter.purchasedFrom ?? null}::timestamptz is null
            or coalesce(po.paid_at, po.created_at, e.enrolled_at)
              >= ${filter.purchasedFrom ?? null}::timestamptz
          )
          and (
            ${filter.purchasedTo ?? null}::timestamptz is null
            or coalesce(po.paid_at, po.created_at, e.enrolled_at)
              <= ${filter.purchasedTo ?? null}::timestamptz
          )
      ) t
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listPurchasers(
    tx: TenantTx,
    courseId: string,
    query: SalesPurchasersQuery,
  ): Promise<SalesPurchaserRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from (
        select distinct on (coalesce(po.membership_id, e.membership_id))
          coalesce(po.membership_id, e.membership_id)::text as membership_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          coalesce(po.amount_cents, 0)::int as amount_cents,
          coalesce(po.coupon_amount_cents, 0)::int as discount_cents,
          coalesce(po.currency, 'INR') as currency,
          e.enrolled_type,
          (
            select r.code_snapshot
            from sales_coupon_redemptions r
            where r.tenant_id = c.tenant_id
              and (
                (po.id is not null and r.payment_order_id = po.id)
                or (
                  po.id is null
                  and r.membership_id = coalesce(po.membership_id, e.membership_id)
                  and r.course_id = c.id
                )
              )
            order by r.created_at desc
            limit 1
          ) as coupon_code,
          coalesce(po.paid_at, po.created_at, e.enrolled_at) as purchased_at,
          po.id::text as payment_order_id,
          po.invoice_number
        from courses c
        left join payment_orders po
          on po.tenant_id = c.tenant_id
          and po.status = 'paid'
          and po.membership_id is not null
          and (
            (po.metadata_json->>'courseId') = c.id::text
            or po.product_title = c.title
          )
        left join enrollments e
          on e.course_id = c.id and e.tenant_id = c.tenant_id
          and e.membership_id = coalesce(po.membership_id, e.membership_id)
        left join memberships m
          on m.id = coalesce(po.membership_id, e.membership_id) and m.tenant_id = c.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where c.id = ${courseId}::uuid
          and coalesce(po.membership_id, e.membership_id) is not null
          and (
            ${query.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.learnerName ?? null}) || '%'
          )
          and (
            ${query.email ?? null}::text is null
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.email ?? null}) || '%'
          )
          and (
            ${query.q ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.q ?? null}) || '%'
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${query.enrolledType ?? null}::text is null
            or lower(coalesce(e.enrolled_type, '')) = lower(${query.enrolledType ?? null})
          )
          and (
            ${query.purchasedFrom ?? null}::timestamptz is null
            or coalesce(po.paid_at, po.created_at, e.enrolled_at)
              >= ${query.purchasedFrom ?? null}::timestamptz
          )
          and (
            ${query.purchasedTo ?? null}::timestamptz is null
            or coalesce(po.paid_at, po.created_at, e.enrolled_at)
              <= ${query.purchasedTo ?? null}::timestamptz
          )
        order by coalesce(po.membership_id, e.membership_id),
          coalesce(po.paid_at, po.created_at, e.enrolled_at) desc
      ) ranked
      order by
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then ranked.learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then ranked.learner_name end desc nulls last,
        case when ${query.sortBy} = 'amount_cents' and ${query.sortDir} = 'asc' then ranked.amount_cents end asc,
        case when ${query.sortBy} = 'amount_cents' and ${query.sortDir} = 'desc' then ranked.amount_cents end desc,
        case when ${query.sortBy} = 'purchased_at' and ${query.sortDir} = 'asc' then ranked.purchased_at end asc,
        case when ${query.sortBy} = 'purchased_at' and ${query.sortDir} = 'desc' then ranked.purchased_at end desc,
        ranked.purchased_at desc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => ({
      membership_id: asUnknownString(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      amount_cents: Number(row["amount_cents"] ?? 0),
      discount_cents: Number(row["discount_cents"] ?? 0),
      currency: asUnknownString(row["currency"], "INR"),
      enrolled_type: typeof row["enrolled_type"] === "string" ? row["enrolled_type"] : null,
      coupon_code: typeof row["coupon_code"] === "string" ? row["coupon_code"] : null,
      purchased_at: row["purchased_at"] as Date,
      payment_order_id:
        typeof row["payment_order_id"] === "string" ? row["payment_order_id"] : null,
      invoice_number: typeof row["invoice_number"] === "string" ? row["invoice_number"] : null,
    }));
  },

  async listPurchaserMembershipIds(tx: TenantTx, filter: PurchaserFilter): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select distinct coalesce(po.membership_id, e.membership_id)::text as membership_id
      from courses c
      left join payment_orders po
        on po.tenant_id = c.tenant_id
        and po.status = 'paid'
        and po.membership_id is not null
        and (
          (po.metadata_json->>'courseId') = c.id::text
          or po.product_title = c.title
        )
      left join enrollments e
        on e.course_id = c.id and e.tenant_id = c.tenant_id
      left join memberships m
        on m.id = coalesce(po.membership_id, e.membership_id) and m.tenant_id = c.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where c.id = ${filter.courseId}::uuid
        and coalesce(po.membership_id, e.membership_id) is not null
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.email ?? null}) || '%'
        )
        and (
          ${filter.q ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.q ?? null}) || '%'
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.q ?? null}) || '%'
        )
        and (
          ${filter.enrolledType ?? null}::text is null
          or lower(coalesce(e.enrolled_type, '')) = lower(${filter.enrolledType ?? null})
        )
        and (
          ${filter.purchasedFrom ?? null}::timestamptz is null
          or coalesce(po.paid_at, po.created_at, e.enrolled_at)
            >= ${filter.purchasedFrom ?? null}::timestamptz
        )
        and (
          ${filter.purchasedTo ?? null}::timestamptz is null
          or coalesce(po.paid_at, po.created_at, e.enrolled_at)
            <= ${filter.purchasedTo ?? null}::timestamptz
        )
      limit 2000
    `;
    return rows.map((row) => row.membership_id);
  },

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

  async countReferralWallet(tx: TenantTx, query: ReferralWalletQuery): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from (
        select
          rc.membership_id,
          (
            select count(*)::int from sales_referral_attributions a
            where a.referrer_membership_id = rc.membership_id
              and a.signup_credited_at is not null
          ) as successful_referrals,
          (
            select coalesce(sum(t.credits), 0)::int
            from sales_wallet_transactions t
            where t.membership_id = rc.membership_id
              and t.direction = 'CREDIT'
              and t.reason in ('REFERRAL_SIGNUP', 'REFERRAL_PURCHASE')
          ) as credit_earned,
          coalesce(w.balance_credits, 0) as wallet_balance,
          coalesce(m.created_at, rc.created_at) as signed_up_at
        from sales_referral_codes rc
        left join sales_wallets w
          on w.membership_id = rc.membership_id and w.tenant_id = rc.tenant_id
        left join memberships m
          on m.id = rc.membership_id and m.tenant_id = rc.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where rc.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.q ?? null}::text is null
            or lower(coalesce(rc.code, '')) like '%' || lower(${query.q ?? null}) || '%'
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.q ?? null}) || '%'
          )
      ) ranked
      where (
          ${query.signedUpFrom ?? null}::timestamptz is null
          or ranked.signed_up_at >= ${query.signedUpFrom ?? null}::timestamptz
        )
        and (
          ${query.signedUpTo ?? null}::timestamptz is null
          or ranked.signed_up_at <= ${query.signedUpTo ?? null}::timestamptz
        )
        and (
          ${query.minCreditEarned ?? null}::int is null
          or ranked.credit_earned >= ${query.minCreditEarned ?? null}::int
        )
        and (
          ${query.minWalletBalance ?? null}::int is null
          or ranked.wallet_balance >= ${query.minWalletBalance ?? null}::int
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listReferralWallet(tx: TenantTx, query: ReferralWalletQuery): Promise<ReferralWalletRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from (
        select
          rc.membership_id::text as membership_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          rc.code as referral_code,
          (
            select count(*)::int from sales_referral_attributions a
            where a.referrer_membership_id = rc.membership_id
              and a.signup_credited_at is not null
          ) as successful_referrals,
          (
            select coalesce(sum(t.credits), 0)::int
            from sales_wallet_transactions t
            where t.membership_id = rc.membership_id
              and t.direction = 'CREDIT'
              and t.reason in ('REFERRAL_SIGNUP', 'REFERRAL_PURCHASE')
          ) as credit_earned,
          coalesce(w.balance_credits, 0)::int as wallet_balance,
          coalesce((
            select sum(po.amount_cents)::int
            from sales_referral_purchase_credits rpc
            join payment_orders po
              on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
            where rpc.referrer_membership_id = rc.membership_id
              and po.status = 'paid'
          ), 0)::int as referred_revenue_cents,
          coalesce(m.created_at, rc.created_at) as signed_up_at
        from sales_referral_codes rc
        left join sales_wallets w
          on w.membership_id = rc.membership_id and w.tenant_id = rc.tenant_id
        left join memberships m
          on m.id = rc.membership_id and m.tenant_id = rc.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where rc.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.q ?? null}::text is null
            or lower(coalesce(rc.code, '')) like '%' || lower(${query.q ?? null}) || '%'
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.q ?? null}) || '%'
          )
      ) ranked
      where (
          ${query.signedUpFrom ?? null}::timestamptz is null
          or ranked.signed_up_at >= ${query.signedUpFrom ?? null}::timestamptz
        )
        and (
          ${query.signedUpTo ?? null}::timestamptz is null
          or ranked.signed_up_at <= ${query.signedUpTo ?? null}::timestamptz
        )
        and (
          ${query.minCreditEarned ?? null}::int is null
          or ranked.credit_earned >= ${query.minCreditEarned ?? null}::int
        )
        and (
          ${query.minWalletBalance ?? null}::int is null
          or ranked.wallet_balance >= ${query.minWalletBalance ?? null}::int
        )
      order by
        case when ${query.sortBy} = 'successful_referrals' and ${query.sortDir} = 'asc' then ranked.successful_referrals end asc,
        case when ${query.sortBy} = 'successful_referrals' and ${query.sortDir} = 'desc' then ranked.successful_referrals end desc,
        case when ${query.sortBy} = 'credit_earned' and ${query.sortDir} = 'asc' then ranked.credit_earned end asc,
        case when ${query.sortBy} = 'credit_earned' and ${query.sortDir} = 'desc' then ranked.credit_earned end desc,
        case when ${query.sortBy} = 'wallet_balance' and ${query.sortDir} = 'asc' then ranked.wallet_balance end asc,
        case when ${query.sortBy} = 'wallet_balance' and ${query.sortDir} = 'desc' then ranked.wallet_balance end desc,
        case when ${query.sortBy} = 'referred_revenue_cents' and ${query.sortDir} = 'asc' then ranked.referred_revenue_cents end asc,
        case when ${query.sortBy} = 'referred_revenue_cents' and ${query.sortDir} = 'desc' then ranked.referred_revenue_cents end desc,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then ranked.learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then ranked.learner_name end desc nulls last,
        case when ${query.sortBy} = 'signed_up_at' and ${query.sortDir} = 'asc' then ranked.signed_up_at end asc nulls last,
        case when ${query.sortBy} = 'signed_up_at' and ${query.sortDir} = 'desc' then ranked.signed_up_at end desc nulls last,
        ranked.successful_referrals desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map((row) => ({
      membership_id: asUnknownString(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      referral_code: typeof row["referral_code"] === "string" ? row["referral_code"] : null,
      successful_referrals: Number(row["successful_referrals"] ?? 0),
      credit_earned: Number(row["credit_earned"] ?? 0),
      wallet_balance: Number(row["wallet_balance"] ?? 0),
      referred_revenue_cents: Number(row["referred_revenue_cents"] ?? 0),
      signed_up_at: row["signed_up_at"] instanceof Date ? row["signed_up_at"] : null,
    }));
  },

  async getReferralWalletSummary(
    tx: TenantTx,
    windowFrom: string,
    windowTo: string,
    previousFrom: string,
    previousTo: string,
  ): Promise<{
    successful_referrals: number;
    previous_successful_referrals: number;
    credit_earned: number;
    credit_outstanding: number;
    wallets_with_balance: number;
    referred_revenue_cents: number;
    referrer_count: number;
    total_learners: number;
    currency: string;
  }> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        (
          select count(*)::int
          from sales_referral_attributions a
          where a.tenant_id = current_setting('app.tenant_id', true)::uuid
            and a.signup_credited_at is not null
            and a.created_at >= ${windowFrom}::timestamptz
            and a.created_at <= ${windowTo}::timestamptz
        ) as successful_referrals,
        (
          select count(*)::int
          from sales_referral_attributions a
          where a.tenant_id = current_setting('app.tenant_id', true)::uuid
            and a.signup_credited_at is not null
            and a.created_at >= ${previousFrom}::timestamptz
            and a.created_at <= ${previousTo}::timestamptz
        ) as previous_successful_referrals,
        (
          select coalesce(sum(t.credits), 0)::int
          from sales_wallet_transactions t
          where t.tenant_id = current_setting('app.tenant_id', true)::uuid
            and t.direction = 'CREDIT'
            and t.reason in ('REFERRAL_SIGNUP', 'REFERRAL_PURCHASE')
            and t.created_at >= ${windowFrom}::timestamptz
            and t.created_at <= ${windowTo}::timestamptz
        ) as credit_earned,
        (
          select coalesce(sum(w.balance_credits), 0)::int
          from sales_wallets w
          where w.tenant_id = current_setting('app.tenant_id', true)::uuid
            and w.balance_credits > 0
        ) as credit_outstanding,
        (
          select count(*)::int
          from sales_wallets w
          where w.tenant_id = current_setting('app.tenant_id', true)::uuid
            and w.balance_credits > 0
        ) as wallets_with_balance,
        (
          select coalesce(sum(po.amount_cents), 0)::int
          from sales_referral_purchase_credits rpc
          join payment_orders po
            on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
          where rpc.tenant_id = current_setting('app.tenant_id', true)::uuid
            and po.status = 'paid'
            and coalesce(po.paid_at, po.created_at) >= ${windowFrom}::timestamptz
            and coalesce(po.paid_at, po.created_at) <= ${windowTo}::timestamptz
        ) as referred_revenue_cents,
        (
          select count(distinct a.referrer_membership_id)::int
          from sales_referral_attributions a
          where a.tenant_id = current_setting('app.tenant_id', true)::uuid
            and a.signup_credited_at is not null
            and a.created_at >= ${windowFrom}::timestamptz
            and a.created_at <= ${windowTo}::timestamptz
        ) as referrer_count,
        (
          select count(*)::int
          from memberships m
          where m.tenant_id = current_setting('app.tenant_id', true)::uuid
            and m.removed_at is null
            and m.archived_at is null
        ) as total_learners,
        (
          select coalesce(
            (
              select upper(po.currency)
              from sales_referral_purchase_credits rpc
              join payment_orders po
                on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
              where rpc.tenant_id = current_setting('app.tenant_id', true)::uuid
                and po.status = 'paid'
              order by coalesce(po.paid_at, po.created_at) desc
              limit 1
            ),
            'INR'
          )
        ) as currency
    `;
    const row = rows[0] ?? {};
    return {
      successful_referrals: Number(row["successful_referrals"] ?? 0),
      previous_successful_referrals: Number(row["previous_successful_referrals"] ?? 0),
      credit_earned: Number(row["credit_earned"] ?? 0),
      credit_outstanding: Number(row["credit_outstanding"] ?? 0),
      wallets_with_balance: Number(row["wallets_with_balance"] ?? 0),
      referred_revenue_cents: Number(row["referred_revenue_cents"] ?? 0),
      referrer_count: Number(row["referrer_count"] ?? 0),
      total_learners: Number(row["total_learners"] ?? 0),
      currency: asUnknownString(row["currency"], "INR"),
    };
  },

  async findReferrer(
    tx: TenantTx,
    membershipId: string,
  ): Promise<{
    membership_id: string;
    learner_name: string | null;
    email: string | null;
    referral_code: string | null;
  } | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        rc.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        rc.code as referral_code
      from sales_referral_codes rc
      left join memberships m
        on m.id = rc.membership_id and m.tenant_id = rc.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where rc.membership_id = ${membershipId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      membership_id: asUnknownString(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      referral_code: typeof row["referral_code"] === "string" ? row["referral_code"] : null,
    };
  },

  async countReferredLearners(tx: TenantTx, referrerMembershipId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from sales_referral_attributions a
      where a.referrer_membership_id = ${referrerMembershipId}::uuid
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listReferredLearners(
    tx: TenantTx,
    referrerMembershipId: string,
    query: { page: number; limit: number },
  ): Promise<
    Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      signed_up_at: Date;
      first_purchase_title: string | null;
      revenue_attributed_cents: number;
      credit_awarded: number;
      currency: string;
      status: "QUALIFIED" | "PENDING" | "DISQUALIFIED";
    }>
  > {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        a.referee_membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        a.created_at as signed_up_at,
        (
          select po.product_title
          from payment_orders po
          where po.membership_id = a.referee_membership_id
            and po.tenant_id = a.tenant_id
            and po.status = 'paid'
          order by coalesce(po.paid_at, po.created_at) asc
          limit 1
        ) as first_purchase_title,
        coalesce((
          select sum(po.amount_cents)::int
          from sales_referral_purchase_credits rpc
          join payment_orders po
            on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
          where rpc.attribution_id = a.id
            and po.status = 'paid'
        ), 0)::int as revenue_attributed_cents,
        coalesce((
          select sum(rpc.credits_applied)::int
          from sales_referral_purchase_credits rpc
          where rpc.attribution_id = a.id
        ), 0)::int as credit_awarded,
        coalesce((
          select upper(po.currency)
          from sales_referral_purchase_credits rpc
          join payment_orders po
            on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
          where rpc.attribution_id = a.id
            and po.status = 'paid'
          order by coalesce(po.paid_at, po.created_at) desc
          limit 1
        ), 'INR') as currency,
        case
          when not exists (
            select 1 from payment_orders po
            where po.membership_id = a.referee_membership_id
              and po.tenant_id = a.tenant_id
              and po.status = 'paid'
          ) then 'PENDING'
          when exists (
            select 1 from sales_referral_purchase_credits rpc
            where rpc.attribution_id = a.id and rpc.credits_applied > 0
          ) or a.signup_credited_at is not null then 'QUALIFIED'
          else 'DISQUALIFIED'
        end as status
      from sales_referral_attributions a
      join memberships m on m.id = a.referee_membership_id and m.tenant_id = a.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where a.referrer_membership_id = ${referrerMembershipId}::uuid
      order by a.created_at desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map((row) => {
      const statusRaw = asUnknownString(row["status"], "PENDING");
      const status =
        statusRaw === "QUALIFIED" || statusRaw === "DISQUALIFIED" ? statusRaw : "PENDING";
      return {
        membership_id: asUnknownString(row["membership_id"]),
        learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
        email: typeof row["email"] === "string" ? row["email"] : null,
        signed_up_at: row["signed_up_at"] as Date,
        first_purchase_title:
          typeof row["first_purchase_title"] === "string" ? row["first_purchase_title"] : null,
        revenue_attributed_cents: Number(row["revenue_attributed_cents"] ?? 0),
        credit_awarded: Number(row["credit_awarded"] ?? 0),
        currency: asUnknownString(row["currency"], "INR"),
        status,
      };
    });
  },

  async getReferrerDrilldownTotals(
    tx: TenantTx,
    referrerMembershipId: string,
  ): Promise<{ total_credit_awarded: number; total_revenue_cents: number; currency: string }> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        coalesce((
          select sum(rpc.credits_applied)::int
          from sales_referral_purchase_credits rpc
          where rpc.referrer_membership_id = ${referrerMembershipId}::uuid
        ), 0)::int as total_credit_awarded,
        coalesce((
          select sum(po.amount_cents)::int
          from sales_referral_purchase_credits rpc
          join payment_orders po
            on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
          where rpc.referrer_membership_id = ${referrerMembershipId}::uuid
            and po.status = 'paid'
        ), 0)::int as total_revenue_cents,
        coalesce((
          select upper(po.currency)
          from sales_referral_purchase_credits rpc
          join payment_orders po
            on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
          where rpc.referrer_membership_id = ${referrerMembershipId}::uuid
            and po.status = 'paid'
          order by coalesce(po.paid_at, po.created_at) desc
          limit 1
        ), 'INR') as currency
    `;
    const row = rows[0] ?? {};
    return {
      total_credit_awarded: Number(row["total_credit_awarded"] ?? 0),
      total_revenue_cents: Number(row["total_revenue_cents"] ?? 0),
      currency: asUnknownString(row["currency"], "INR"),
    };
  },

  async countAffiliateProducts(tx: TenantTx, query: AffiliateProductsQuery): Promise<number> {
    const enabledFilter = query.enabled === "all" ? null : query.enabled;
    const commissionBand = query.commissionBand === "any" ? null : query.commissionBand;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from sales_affiliate_products p
      left join courses c on c.id = p.course_id and c.tenant_id = p.tenant_id
      left join sales_affiliate_configs cfg on cfg.tenant_id = p.tenant_id
      where p.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ${query.q ?? null}::text is null
          or lower(coalesce(c.title, '')) like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${enabledFilter}::text is null
          or (${enabledFilter} = 'enabled' and p.enabled = true)
          or (${enabledFilter} = 'disabled' and p.enabled = false)
        )
        and (
          ${commissionBand}::text is null
          or (
            ${commissionBand} = 'below_10'
            and coalesce(p.standard_commission_pct, cfg.standard_commission_pct, 10) < 10
          )
          or (
            ${commissionBand} = '10_20'
            and coalesce(p.standard_commission_pct, cfg.standard_commission_pct, 10) >= 10
            and coalesce(p.standard_commission_pct, cfg.standard_commission_pct, 10) <= 20
          )
          or (
            ${commissionBand} = 'above_20'
            and coalesce(p.standard_commission_pct, cfg.standard_commission_pct, 10) > 20
          )
        )
        and (
          ${query.publishedFrom ?? null}::timestamptz is null
          or p.created_at >= ${query.publishedFrom ?? null}::timestamptz
        )
        and (
          ${query.publishedTo ?? null}::timestamptz is null
          or p.created_at <= ${query.publishedTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listAffiliateProducts(
    tx: TenantTx,
    query: AffiliateProductsQuery,
    activityFrom: string,
    activityTo: string,
  ): Promise<AffiliateProductRow[]> {
    const skip = (query.page - 1) * query.limit;
    const enabledFilter = query.enabled === "all" ? null : query.enabled;
    const commissionBand = query.commissionBand === "any" ? null : query.commissionBand;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        p.course_id::text as course_id,
        coalesce(c.title, 'Untitled product') as product_title,
        coalesce(
          (
            select po.product_type
            from payment_orders po
            where po.tenant_id = p.tenant_id
              and po.product_type is not null
              and exists (
                select 1 from sales_affiliate_commissions ac0
                where ac0.payment_order_id = po.id
                  and ac0.tenant_id = po.tenant_id
                  and ac0.course_id = p.course_id
              )
            order by coalesce(po.paid_at, po.created_at) desc
            limit 1
          ),
          'Course'
        ) as product_type,
        p.enabled,
        coalesce(p.standard_commission_pct, cfg.standard_commission_pct, 10)::float8 as commission_rate_pct,
        (p.standard_commission_pct is null) as inherits_default_rate,
        coalesce(cfg.standard_commission_pct, 10)::float8 as tenant_default_commission_pct,
        coalesce((
          select count(*)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
            and ac.created_at >= ${activityFrom}::timestamptz
            and ac.created_at <= ${activityTo}::timestamptz
        ), 0) as order_count,
        coalesce((
          select sum(ac.order_amount_cents)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
            and ac.created_at >= ${activityFrom}::timestamptz
            and ac.created_at <= ${activityTo}::timestamptz
        ), 0) as revenue_cents,
        coalesce((
          select sum(ac.commission_cents)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
            and ac.created_at >= ${activityFrom}::timestamptz
            and ac.created_at <= ${activityTo}::timestamptz
        ), 0) as commission_cents,
        coalesce((
          select count(distinct ac.affiliate_id)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
        ), 0) as active_affiliate_count,
        coalesce((
          select sum(ac.commission_cents)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
            and ac.status = 'UNPAID'
        ), 0) as unpaid_commission_cents,
        coalesce(
          (
            select upper(ac.currency)
            from sales_affiliate_commissions ac
            where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
            order by ac.created_at desc
            limit 1
          ),
          'INR'
        ) as currency,
        p.created_at as published_at
      from sales_affiliate_products p
      left join courses c on c.id = p.course_id and c.tenant_id = p.tenant_id
      left join sales_affiliate_configs cfg on cfg.tenant_id = p.tenant_id
      where p.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ${query.q ?? null}::text is null
          or lower(coalesce(c.title, '')) like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${enabledFilter}::text is null
          or (${enabledFilter} = 'enabled' and p.enabled = true)
          or (${enabledFilter} = 'disabled' and p.enabled = false)
        )
        and (
          ${commissionBand}::text is null
          or (
            ${commissionBand} = 'below_10'
            and coalesce(p.standard_commission_pct, cfg.standard_commission_pct, 10) < 10
          )
          or (
            ${commissionBand} = '10_20'
            and coalesce(p.standard_commission_pct, cfg.standard_commission_pct, 10) >= 10
            and coalesce(p.standard_commission_pct, cfg.standard_commission_pct, 10) <= 20
          )
          or (
            ${commissionBand} = 'above_20'
            and coalesce(p.standard_commission_pct, cfg.standard_commission_pct, 10) > 20
          )
        )
        and (
          ${query.publishedFrom ?? null}::timestamptz is null
          or p.created_at >= ${query.publishedFrom ?? null}::timestamptz
        )
        and (
          ${query.publishedTo ?? null}::timestamptz is null
          or p.created_at <= ${query.publishedTo ?? null}::timestamptz
        )
      order by
        case when ${query.sortBy} = 'revenue_cents' and ${query.sortDir} = 'asc' then coalesce((
          select sum(ac.order_amount_cents)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
            and ac.created_at >= ${activityFrom}::timestamptz
            and ac.created_at <= ${activityTo}::timestamptz
        ), 0) end asc,
        case when ${query.sortBy} = 'revenue_cents' and ${query.sortDir} = 'desc' then coalesce((
          select sum(ac.order_amount_cents)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
            and ac.created_at >= ${activityFrom}::timestamptz
            and ac.created_at <= ${activityTo}::timestamptz
        ), 0) end desc,
        case when ${query.sortBy} = 'commission_cents' and ${query.sortDir} = 'asc' then coalesce((
          select sum(ac.commission_cents)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
            and ac.created_at >= ${activityFrom}::timestamptz
            and ac.created_at <= ${activityTo}::timestamptz
        ), 0) end asc,
        case when ${query.sortBy} = 'commission_cents' and ${query.sortDir} = 'desc' then coalesce((
          select sum(ac.commission_cents)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
            and ac.created_at >= ${activityFrom}::timestamptz
            and ac.created_at <= ${activityTo}::timestamptz
        ), 0) end desc,
        case when ${query.sortBy} = 'order_count' and ${query.sortDir} = 'asc' then coalesce((
          select count(*)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
            and ac.created_at >= ${activityFrom}::timestamptz
            and ac.created_at <= ${activityTo}::timestamptz
        ), 0) end asc,
        case when ${query.sortBy} = 'order_count' and ${query.sortDir} = 'desc' then coalesce((
          select count(*)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
            and ac.created_at >= ${activityFrom}::timestamptz
            and ac.created_at <= ${activityTo}::timestamptz
        ), 0) end desc,
        case when ${query.sortBy} = 'commission_rate_pct' and ${query.sortDir} = 'asc'
          then coalesce(p.standard_commission_pct, cfg.standard_commission_pct, 10) end asc,
        case when ${query.sortBy} = 'commission_rate_pct' and ${query.sortDir} = 'desc'
          then coalesce(p.standard_commission_pct, cfg.standard_commission_pct, 10) end desc,
        case when ${query.sortBy} = 'effective_rate_pct' and ${query.sortDir} = 'asc' then (
          case when coalesce((
            select sum(ac.order_amount_cents)::int from sales_affiliate_commissions ac
            where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
              and ac.created_at >= ${activityFrom}::timestamptz
              and ac.created_at <= ${activityTo}::timestamptz
          ), 0) = 0 then 0::numeric
          else round(
            (
              (
                coalesce((
                  select sum(ac.commission_cents)::numeric from sales_affiliate_commissions ac
                  where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
                    and ac.created_at >= ${activityFrom}::timestamptz
                    and ac.created_at <= ${activityTo}::timestamptz
                ), 0) * 100
              ) /
              coalesce((
                select sum(ac.order_amount_cents)::numeric from sales_affiliate_commissions ac
                where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
                  and ac.created_at >= ${activityFrom}::timestamptz
                  and ac.created_at <= ${activityTo}::timestamptz
              ), 1)
            ),
            1
          ) end
        ) end asc,
        case when ${query.sortBy} = 'effective_rate_pct' and ${query.sortDir} = 'desc' then (
          case when coalesce((
            select sum(ac.order_amount_cents)::int from sales_affiliate_commissions ac
            where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
              and ac.created_at >= ${activityFrom}::timestamptz
              and ac.created_at <= ${activityTo}::timestamptz
          ), 0) = 0 then 0::numeric
          else round(
            (
              (
                coalesce((
                  select sum(ac.commission_cents)::numeric from sales_affiliate_commissions ac
                  where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
                    and ac.created_at >= ${activityFrom}::timestamptz
                    and ac.created_at <= ${activityTo}::timestamptz
                ), 0) * 100
              ) /
              coalesce((
                select sum(ac.order_amount_cents)::numeric from sales_affiliate_commissions ac
                where ac.course_id = p.course_id and ac.tenant_id = p.tenant_id
                  and ac.created_at >= ${activityFrom}::timestamptz
                  and ac.created_at <= ${activityTo}::timestamptz
              ), 1)
            ),
            1
          ) end
        ) end desc,
        case when ${query.sortBy} = 'product_title' and ${query.sortDir} = 'asc'
          then lower(coalesce(c.title, '')) end asc,
        case when ${query.sortBy} = 'product_title' and ${query.sortDir} = 'desc'
          then lower(coalesce(c.title, '')) end desc,
        case when ${query.sortBy} = 'published_at' and ${query.sortDir} = 'asc' then p.created_at end asc,
        case when ${query.sortBy} = 'published_at' and ${query.sortDir} = 'desc' then p.created_at end desc,
        p.created_at desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map((row) => {
      const revenue = Number(row["revenue_cents"] ?? 0);
      const commission = Number(row["commission_cents"] ?? 0);
      const net = Math.max(0, revenue - commission);
      const effective = revenue <= 0 ? 0 : Math.round((commission * 1000) / revenue) / 10;
      return {
        course_id: asUnknownString(row["course_id"]),
        product_title: asUnknownString(row["product_title"]),
        product_type: asUnknownString(row["product_type"], "Course"),
        enabled: Boolean(row["enabled"]),
        commission_rate_pct: Number(row["commission_rate_pct"] ?? 0),
        inherits_default_rate: Boolean(row["inherits_default_rate"]),
        tenant_default_commission_pct: Number(row["tenant_default_commission_pct"] ?? 10),
        order_count: Number(row["order_count"] ?? 0),
        revenue_cents: revenue,
        commission_cents: commission,
        net_cents: net,
        effective_rate_pct: effective,
        active_affiliate_count: Number(row["active_affiliate_count"] ?? 0),
        unpaid_commission_cents: Number(row["unpaid_commission_cents"] ?? 0),
        published_at: row["published_at"] instanceof Date ? row["published_at"] : null,
        currency: asUnknownString(row["currency"], "INR"),
      };
    });
  },

  async getAffiliateProductsSummary(
    tx: TenantTx,
    activityFrom: string,
    activityTo: string,
  ): Promise<{
    revenue_cents: number;
    commission_cents: number;
    order_count: number;
    products_enabled: number;
    products_in_programme: number;
    products_total: number;
    tenant_default_commission_pct: number;
    currency: string;
  }> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        coalesce((
          select sum(ac.order_amount_cents)::int
          from sales_affiliate_commissions ac
          where ac.tenant_id = current_setting('app.tenant_id', true)::uuid
            and ac.created_at >= ${activityFrom}::timestamptz
            and ac.created_at <= ${activityTo}::timestamptz
        ), 0) as revenue_cents,
        coalesce((
          select sum(ac.commission_cents)::int
          from sales_affiliate_commissions ac
          where ac.tenant_id = current_setting('app.tenant_id', true)::uuid
            and ac.created_at >= ${activityFrom}::timestamptz
            and ac.created_at <= ${activityTo}::timestamptz
        ), 0) as commission_cents,
        coalesce((
          select count(*)::int
          from sales_affiliate_commissions ac
          where ac.tenant_id = current_setting('app.tenant_id', true)::uuid
            and ac.created_at >= ${activityFrom}::timestamptz
            and ac.created_at <= ${activityTo}::timestamptz
        ), 0) as order_count,
        coalesce((
          select count(*)::int
          from sales_affiliate_products p
          where p.tenant_id = current_setting('app.tenant_id', true)::uuid
            and p.enabled = true
        ), 0) as products_enabled,
        coalesce((
          select count(*)::int
          from sales_affiliate_products p
          where p.tenant_id = current_setting('app.tenant_id', true)::uuid
        ), 0) as products_in_programme,
        coalesce((
          select count(*)::int
          from courses c
          where c.tenant_id = current_setting('app.tenant_id', true)::uuid
            and c.deleted_at is null
        ), 0) as products_total,
        coalesce((
          select cfg.standard_commission_pct
          from sales_affiliate_configs cfg
          where cfg.tenant_id = current_setting('app.tenant_id', true)::uuid
          limit 1
        ), 10) as tenant_default_commission_pct,
        coalesce(
          (
            select upper(ac.currency)
            from sales_affiliate_commissions ac
            where ac.tenant_id = current_setting('app.tenant_id', true)::uuid
            order by ac.created_at desc
            limit 1
          ),
          'INR'
        ) as currency
    `;
    const row = rows[0] ?? {};
    return {
      revenue_cents: Number(row["revenue_cents"] ?? 0),
      commission_cents: Number(row["commission_cents"] ?? 0),
      order_count: Number(row["order_count"] ?? 0),
      products_enabled: Number(row["products_enabled"] ?? 0),
      products_in_programme: Number(row["products_in_programme"] ?? 0),
      products_total: Number(row["products_total"] ?? 0),
      tenant_default_commission_pct: Number(row["tenant_default_commission_pct"] ?? 10),
      currency: asUnknownString(row["currency"], "INR"),
    };
  },

  async countAffiliates(
    tx: TenantTx,
    query: AffiliatesQuery,
    activityFrom: string,
    activityTo: string,
  ): Promise<number> {
    const statusFilter = query.view === "suspended" ? "INACTIVE" : (query.status ?? null);
    const unpaidBand =
      query.view === "owed" ? "has_unpaid" : query.unpaidBand === "any" ? null : query.unpaidBand;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from sales_affiliates a
      left join memberships m on m.id = a.membership_id and m.tenant_id = a.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where a.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${statusFilter}::text is null or a.status = ${statusFilter})
        and (${query.tier ?? null}::text is null or a.tier = ${query.tier ?? null})
        and (
          ${query.q ?? null}::text is null
          or lower(a.coupon_code) like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${query.signedUpFrom ?? null}::timestamptz is null
          or a.created_at >= ${query.signedUpFrom ?? null}::timestamptz
        )
        and (
          ${query.signedUpTo ?? null}::timestamptz is null
          or a.created_at <= ${query.signedUpTo ?? null}::timestamptz
        )
        and (
          ${unpaidBand}::text is null
          or (
            ${unpaidBand} = 'has_unpaid'
            and coalesce((
              select sum(c.commission_cents)::int from sales_affiliate_commissions c
              where c.affiliate_id = a.id and c.status = 'UNPAID'
            ), 0) > 0
          )
          or (
            ${unpaidBand} = 'zero'
            and coalesce((
              select sum(c.commission_cents)::int from sales_affiliate_commissions c
              where c.affiliate_id = a.id and c.status = 'UNPAID'
            ), 0) = 0
          )
          or (
            ${unpaidBand} = 'above_1000'
            and coalesce((
              select sum(c.commission_cents)::int from sales_affiliate_commissions c
              where c.affiliate_id = a.id and c.status = 'UNPAID'
            ), 0) > 100000
          )
        )
        and (
          ${query.view}::text is distinct from 'top'
          or coalesce((
            select sum(c.commission_cents)::int from sales_affiliate_commissions c
            where c.affiliate_id = a.id
              and c.created_at >= ${activityFrom}::timestamptz
              and c.created_at <= ${activityTo}::timestamptz
          ), 0) > 0
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listAffiliates(
    tx: TenantTx,
    query: AffiliatesQuery,
    activityFrom: string,
    activityTo: string,
  ): Promise<AffiliateRow[]> {
    const skip = (query.page - 1) * query.limit;
    const statusFilter = query.view === "suspended" ? "INACTIVE" : (query.status ?? null);
    const unpaidBand =
      query.view === "owed" ? "has_unpaid" : query.unpaidBand === "any" ? null : query.unpaidBand;
    const sortBy = query.view === "top" ? "commission_earned_cents" : query.sortBy;
    const sortDir = query.view === "top" ? "desc" : query.sortDir;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        a.id::text as affiliate_id,
        a.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        a.tier,
        a.status,
        a.coupon_code,
        coalesce((
          select sum(c.order_amount_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id
            and c.created_at >= ${activityFrom}::timestamptz
            and c.created_at <= ${activityTo}::timestamptz
        ), 0) as revenue_contribution_cents,
        coalesce((
          select sum(c.commission_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id
            and c.created_at >= ${activityFrom}::timestamptz
            and c.created_at <= ${activityTo}::timestamptz
        ), 0) as commission_earned_cents,
        coalesce((
          select sum(c.commission_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id and c.status = 'UNPAID'
        ), 0) as unpaid_cents,
        coalesce((
          select sum(c.commission_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id and c.status = 'PAID'
        ), 0) as paid_cents,
        coalesce(
          (
            select upper(c.currency)
            from sales_affiliate_commissions c
            where c.affiliate_id = a.id
            order by c.created_at desc
            limit 1
          ),
          'INR'
        ) as currency,
        a.created_at as signed_up_at
      from sales_affiliates a
      left join memberships m on m.id = a.membership_id and m.tenant_id = a.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where a.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${statusFilter}::text is null or a.status = ${statusFilter})
        and (${query.tier ?? null}::text is null or a.tier = ${query.tier ?? null})
        and (
          ${query.q ?? null}::text is null
          or lower(a.coupon_code) like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${query.signedUpFrom ?? null}::timestamptz is null
          or a.created_at >= ${query.signedUpFrom ?? null}::timestamptz
        )
        and (
          ${query.signedUpTo ?? null}::timestamptz is null
          or a.created_at <= ${query.signedUpTo ?? null}::timestamptz
        )
        and (
          ${unpaidBand}::text is null
          or (
            ${unpaidBand} = 'has_unpaid'
            and coalesce((
              select sum(c.commission_cents)::int from sales_affiliate_commissions c
              where c.affiliate_id = a.id and c.status = 'UNPAID'
            ), 0) > 0
          )
          or (
            ${unpaidBand} = 'zero'
            and coalesce((
              select sum(c.commission_cents)::int from sales_affiliate_commissions c
              where c.affiliate_id = a.id and c.status = 'UNPAID'
            ), 0) = 0
          )
          or (
            ${unpaidBand} = 'above_1000'
            and coalesce((
              select sum(c.commission_cents)::int from sales_affiliate_commissions c
              where c.affiliate_id = a.id and c.status = 'UNPAID'
            ), 0) > 100000
          )
        )
        and (
          ${query.view}::text is distinct from 'top'
          or coalesce((
            select sum(c.commission_cents)::int from sales_affiliate_commissions c
            where c.affiliate_id = a.id
              and c.created_at >= ${activityFrom}::timestamptz
              and c.created_at <= ${activityTo}::timestamptz
          ), 0) > 0
        )
      order by
        case when ${sortBy} = 'revenue_contribution_cents' and ${sortDir} = 'asc' then coalesce((
          select sum(c.order_amount_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id
            and c.created_at >= ${activityFrom}::timestamptz
            and c.created_at <= ${activityTo}::timestamptz
        ), 0) end asc,
        case when ${sortBy} = 'revenue_contribution_cents' and ${sortDir} = 'desc' then coalesce((
          select sum(c.order_amount_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id
            and c.created_at >= ${activityFrom}::timestamptz
            and c.created_at <= ${activityTo}::timestamptz
        ), 0) end desc,
        case when ${sortBy} = 'commission_earned_cents' and ${sortDir} = 'asc' then coalesce((
          select sum(c.commission_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id
            and c.created_at >= ${activityFrom}::timestamptz
            and c.created_at <= ${activityTo}::timestamptz
        ), 0) end asc,
        case when ${sortBy} = 'commission_earned_cents' and ${sortDir} = 'desc' then coalesce((
          select sum(c.commission_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id
            and c.created_at >= ${activityFrom}::timestamptz
            and c.created_at <= ${activityTo}::timestamptz
        ), 0) end desc,
        case when ${sortBy} = 'unpaid_cents' and ${sortDir} = 'asc' then coalesce((
          select sum(c.commission_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id and c.status = 'UNPAID'
        ), 0) end asc,
        case when ${sortBy} = 'unpaid_cents' and ${sortDir} = 'desc' then coalesce((
          select sum(c.commission_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id and c.status = 'UNPAID'
        ), 0) end desc,
        case when ${sortBy} = 'paid_cents' and ${sortDir} = 'asc' then coalesce((
          select sum(c.commission_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id and c.status = 'PAID'
        ), 0) end asc,
        case when ${sortBy} = 'paid_cents' and ${sortDir} = 'desc' then coalesce((
          select sum(c.commission_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id and c.status = 'PAID'
        ), 0) end desc,
        case when ${sortBy} = 'learner_name' and ${sortDir} = 'asc'
          then lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, '')) end asc,
        case when ${sortBy} = 'learner_name' and ${sortDir} = 'desc'
          then lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, '')) end desc,
        case when ${sortBy} = 'signed_up_at' and ${sortDir} = 'asc' then a.created_at end asc,
        case when ${sortBy} = 'signed_up_at' and ${sortDir} = 'desc' then a.created_at end desc,
        a.created_at desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map((row) => ({
      affiliate_id: asUnknownString(row["affiliate_id"]),
      membership_id: asUnknownString(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      tier: asUnknownString(row["tier"]),
      status: asUnknownString(row["status"]),
      coupon_code: asUnknownString(row["coupon_code"]),
      revenue_contribution_cents: Number(row["revenue_contribution_cents"] ?? 0),
      commission_earned_cents: Number(row["commission_earned_cents"] ?? 0),
      unpaid_cents: Number(row["unpaid_cents"] ?? 0),
      paid_cents: Number(row["paid_cents"] ?? 0),
      signed_up_at: row["signed_up_at"] as Date,
      currency: asUnknownString(row["currency"], "INR"),
    }));
  },

  async getAffiliatesSummary(
    tx: TenantTx,
    activityFrom: string,
    activityTo: string,
  ): Promise<{
    revenue_cents: number;
    commission_cents: number;
    unpaid_cents: number;
    unpaid_affiliate_count: number;
    paid_cents: number;
    active_count: number;
    total_count: number;
    pending_approval_count: number;
    currency: string;
  }> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        coalesce((
          select sum(c.order_amount_cents)::int
          from sales_affiliate_commissions c
          where c.tenant_id = current_setting('app.tenant_id', true)::uuid
            and c.created_at >= ${activityFrom}::timestamptz
            and c.created_at <= ${activityTo}::timestamptz
        ), 0) as revenue_cents,
        coalesce((
          select sum(c.commission_cents)::int
          from sales_affiliate_commissions c
          where c.tenant_id = current_setting('app.tenant_id', true)::uuid
            and c.created_at >= ${activityFrom}::timestamptz
            and c.created_at <= ${activityTo}::timestamptz
        ), 0) as commission_cents,
        coalesce((
          select sum(c.commission_cents)::int
          from sales_affiliate_commissions c
          where c.tenant_id = current_setting('app.tenant_id', true)::uuid
            and c.status = 'UNPAID'
        ), 0) as unpaid_cents,
        coalesce((
          select count(distinct c.affiliate_id)::int
          from sales_affiliate_commissions c
          where c.tenant_id = current_setting('app.tenant_id', true)::uuid
            and c.status = 'UNPAID'
            and c.commission_cents > 0
        ), 0) as unpaid_affiliate_count,
        coalesce((
          select sum(c.commission_cents)::int
          from sales_affiliate_commissions c
          where c.tenant_id = current_setting('app.tenant_id', true)::uuid
            and c.status = 'PAID'
        ), 0) as paid_cents,
        coalesce((
          select count(*)::int
          from sales_affiliates a
          where a.tenant_id = current_setting('app.tenant_id', true)::uuid
            and a.status = 'ACTIVE'
        ), 0) as active_count,
        coalesce((
          select count(*)::int
          from sales_affiliates a
          where a.tenant_id = current_setting('app.tenant_id', true)::uuid
        ), 0) as total_count,
        coalesce((
          select count(*)::int
          from sales_affiliate_requests r
          where r.tenant_id = current_setting('app.tenant_id', true)::uuid
            and r.status = 'PENDING'
        ), 0) as pending_approval_count,
        coalesce(
          (
            select upper(c.currency)
            from sales_affiliate_commissions c
            where c.tenant_id = current_setting('app.tenant_id', true)::uuid
            order by c.created_at desc
            limit 1
          ),
          'INR'
        ) as currency
    `;
    const row = rows[0] ?? {};
    return {
      revenue_cents: Number(row["revenue_cents"] ?? 0),
      commission_cents: Number(row["commission_cents"] ?? 0),
      unpaid_cents: Number(row["unpaid_cents"] ?? 0),
      unpaid_affiliate_count: Number(row["unpaid_affiliate_count"] ?? 0),
      paid_cents: Number(row["paid_cents"] ?? 0),
      active_count: Number(row["active_count"] ?? 0),
      total_count: Number(row["total_count"] ?? 0),
      pending_approval_count: Number(row["pending_approval_count"] ?? 0),
      currency: asUnknownString(row["currency"], "INR"),
    };
  },

  async findAffiliateById(tx: TenantTx, affiliateId: string): Promise<AffiliateRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        a.id::text as affiliate_id,
        a.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        a.tier,
        a.status,
        a.coupon_code,
        coalesce((
          select sum(c.order_amount_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id
        ), 0) as revenue_contribution_cents,
        coalesce((
          select sum(c.commission_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id
        ), 0) as commission_earned_cents,
        coalesce((
          select sum(c.commission_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id and c.status = 'UNPAID'
        ), 0) as unpaid_cents,
        coalesce((
          select sum(c.commission_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id and c.status = 'PAID'
        ), 0) as paid_cents,
        coalesce(
          (
            select upper(c.currency)
            from sales_affiliate_commissions c
            where c.affiliate_id = a.id
            order by c.created_at desc
            limit 1
          ),
          'INR'
        ) as currency,
        a.created_at as signed_up_at
      from sales_affiliates a
      left join memberships m on m.id = a.membership_id and m.tenant_id = a.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where a.tenant_id = current_setting('app.tenant_id', true)::uuid
        and a.id = ${affiliateId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      affiliate_id: asUnknownString(row["affiliate_id"]),
      membership_id: asUnknownString(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      tier: asUnknownString(row["tier"]),
      status: asUnknownString(row["status"]),
      coupon_code: asUnknownString(row["coupon_code"]),
      revenue_contribution_cents: Number(row["revenue_contribution_cents"] ?? 0),
      commission_earned_cents: Number(row["commission_earned_cents"] ?? 0),
      unpaid_cents: Number(row["unpaid_cents"] ?? 0),
      paid_cents: Number(row["paid_cents"] ?? 0),
      signed_up_at: row["signed_up_at"] as Date,
      currency: asUnknownString(row["currency"], "INR"),
    };
  },

  async listAffiliateAttributedOrders(
    tx: TenantTx,
    affiliateId: string,
    limit: number,
  ): Promise<
    Array<{
      commission_id: string;
      payment_order_id: string;
      invoice_number: string | null;
      learner_name: string | null;
      learner_email: string | null;
      product_title: string;
      order_amount_cents: number;
      commission_cents: number;
      currency: string;
      status: string;
      created_at: Date;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        c.id::text as commission_id,
        c.payment_order_id::text as payment_order_id,
        po.invoice_number,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as learner_email,
        coalesce(course.title, po.product_title, 'Untitled product') as product_title,
        c.order_amount_cents,
        c.commission_cents,
        upper(c.currency) as currency,
        c.status,
        c.created_at
      from sales_affiliate_commissions c
      left join payment_orders po
        on po.id = c.payment_order_id and po.tenant_id = c.tenant_id
      left join courses course
        on course.id = c.course_id and course.tenant_id = c.tenant_id
      left join memberships m
        on m.id = c.buyer_membership_id and m.tenant_id = c.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where c.tenant_id = current_setting('app.tenant_id', true)::uuid
        and c.affiliate_id = ${affiliateId}::uuid
      order by c.created_at desc
      limit ${limit}
    `;
    return rows.map((row) => ({
      commission_id: asUnknownString(row["commission_id"]),
      payment_order_id: asUnknownString(row["payment_order_id"]),
      invoice_number: typeof row["invoice_number"] === "string" ? row["invoice_number"] : null,
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      learner_email: typeof row["learner_email"] === "string" ? row["learner_email"] : null,
      product_title: asUnknownString(row["product_title"], "Untitled product"),
      order_amount_cents: Number(row["order_amount_cents"] ?? 0),
      commission_cents: Number(row["commission_cents"] ?? 0),
      currency: asUnknownString(row["currency"], "INR"),
      status: asUnknownString(row["status"]),
      created_at: row["created_at"] as Date,
    }));
  },

  async countAffiliateAttributedOrders(tx: TenantTx, affiliateId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from sales_affiliate_commissions c
      where c.tenant_id = current_setting('app.tenant_id', true)::uuid
        and c.affiliate_id = ${affiliateId}::uuid
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listAffiliatePayoutHistory(
    tx: TenantTx,
    affiliateId: string,
    limit: number,
  ): Promise<
    Array<{
      payout_id: string;
      amount_cents: number;
      currency: string;
      status: string;
      note: string | null;
      paid_at: Date;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        p.id::text as payout_id,
        p.amount_cents,
        upper(p.currency) as currency,
        p.status,
        p.note,
        p.paid_at
      from sales_affiliate_payouts p
      where p.tenant_id = current_setting('app.tenant_id', true)::uuid
        and p.affiliate_id = ${affiliateId}::uuid
      order by p.paid_at desc
      limit ${limit}
    `;
    return rows.map((row) => ({
      payout_id: asUnknownString(row["payout_id"]),
      amount_cents: Number(row["amount_cents"] ?? 0),
      currency: asUnknownString(row["currency"], "INR"),
      status: asUnknownString(row["status"]),
      note: typeof row["note"] === "string" ? row["note"] : null,
      paid_at: row["paid_at"] as Date,
    }));
  },

  async listAffiliateEarningsTrend(
    tx: TenantTx,
    affiliateId: string,
  ): Promise<Array<{ month: string; commission_cents: number; revenue_cents: number }>> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        to_char(date_trunc('month', c.created_at), 'YYYY-MM') as month,
        coalesce(sum(c.commission_cents), 0)::int as commission_cents,
        coalesce(sum(c.order_amount_cents), 0)::int as revenue_cents
      from sales_affiliate_commissions c
      where c.tenant_id = current_setting('app.tenant_id', true)::uuid
        and c.affiliate_id = ${affiliateId}::uuid
        and c.created_at >= (date_trunc('month', now()) - interval '11 months')
      group by 1
      order by 1 asc
    `;
    return rows.map((row) => ({
      month: asUnknownString(row["month"]),
      commission_cents: Number(row["commission_cents"] ?? 0),
      revenue_cents: Number(row["revenue_cents"] ?? 0),
    }));
  },

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
