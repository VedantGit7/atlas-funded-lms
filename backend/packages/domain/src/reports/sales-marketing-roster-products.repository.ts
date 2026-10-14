import type { TenantTx } from "@atlas/db";
import type { SalesProductsQuery, SalesPurchasersQuery } from "./sales-marketing-roster.dto";
import type {
  PurchaserFilter,
  SalesProductRow,
  SalesPurchaserRow,
} from "./sales-marketing-roster.repository";
import { asUnknownString } from "./sales-marketing-roster.repository-helpers";

/**
 * Products sold: the list, summary, one product and its purchasers.
 * Part of salesMarketingRosterRepository.
 */
export const salesMarketingRosterProductsRepository = {
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
};
