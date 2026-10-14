import type { TenantTx } from "@atlas/db";
import type { AffiliateProductsQuery, AffiliatesQuery } from "./sales-marketing-roster.dto";
import type { AffiliateProductRow, AffiliateRow } from "./sales-marketing-roster.repository";
import { asUnknownString } from "./sales-marketing-roster.repository-helpers";

/**
 * Affiliate products and affiliates: lists, summaries, orders, payouts and earnings.
 * Part of salesMarketingRosterRepository.
 */
export const salesMarketingRosterAffiliatesRepository = {
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
};
