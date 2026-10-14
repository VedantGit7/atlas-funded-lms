import type { TenantTx } from "@atlas/db";
import type { PaymentOverviewGrain } from "./payments-roster.dto";
import type { PaymentOverviewFilter } from "./payments-roster.repository";

/**
 * The payments overview: totals, attention items, trend and top lists.
 * Part of paymentsRosterRepository.
 */
export const paymentsRosterOverviewRepository = {
  async getOverviewSummary(
    tx: TenantTx,
    filter: PaymentOverviewFilter,
  ): Promise<{
    collected_cents: number;
    transaction_count: number;
    failed_count: number;
    attempt_count: number;
    currencies: string[];
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        collected_cents: bigint;
        transaction_count: bigint;
        failed_count: bigint;
        attempt_count: bigint;
        currencies: string[] | null;
      }>
    >`
      select
        coalesce(sum(case when po.status = 'paid' then po.amount_cents else 0 end), 0)::bigint as collected_cents,
        count(*) filter (where po.status = 'paid')::bigint as transaction_count,
        count(*) filter (where lower(po.status) in ('failed', 'failure', 'declined'))::bigint as failed_count,
        count(*)::bigint as attempt_count,
        array_agg(distinct po.currency) filter (where po.status = 'paid') as currencies
      from payment_orders po
      where po.tenant_id = current_setting('app.tenant_id', true)::uuid
        and coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom}::timestamptz
        and coalesce(po.paid_at, po.created_at) <= ${filter.paidTo}::timestamptz
        and (
          ${filter.currency ?? null}::text is null
          or upper(po.currency) = upper(${filter.currency ?? null})
        )
    `;
    const row = rows[0];
    return {
      collected_cents: Number(row?.collected_cents ?? 0),
      transaction_count: Number(row?.transaction_count ?? 0),
      failed_count: Number(row?.failed_count ?? 0),
      attempt_count: Number(row?.attempt_count ?? 0),
      currencies: (row?.currencies ?? []).filter(Boolean),
    };
  },

  async getOverviewCollectedInWindow(tx: TenantTx, filter: PaymentOverviewFilter): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ collected_cents: bigint }>>`
      select coalesce(sum(po.amount_cents), 0)::bigint as collected_cents
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
    return Number(rows[0]?.collected_cents ?? 0);
  },

  async getOverviewOutstandingInstalments(
    tx: TenantTx,
    currency?: string,
  ): Promise<{ remaining_cents: number; plan_count: number }> {
    const rows = await tx.$queryRaw<Array<{ remaining_cents: bigint; plan_count: bigint }>>`
      select
        coalesce(sum(p.remaining_amount_cents), 0)::bigint as remaining_cents,
        count(*)::bigint as plan_count
      from payment_instalment_plans p
      where p.tenant_id = current_setting('app.tenant_id', true)::uuid
        and p.status in ('active', 'overdue')
        and p.remaining_amount_cents > 0
        and (
          ${currency ?? null}::text is null
          or upper(p.currency) = upper(${currency ?? null})
        )
    `;
    return {
      remaining_cents: Number(rows[0]?.remaining_cents ?? 0),
      plan_count: Number(rows[0]?.plan_count ?? 0),
    };
  },

  async getOverviewAttention(
    tx: TenantTx,
    filter: PaymentOverviewFilter,
  ): Promise<{
    unsent_invoice_count: number;
    overdue_instalment_count: number;
    failed_payment_count: number;
  }> {
    const [unsent, overdue, failed] = await Promise.all([
      tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from payment_orders po
        where po.tenant_id = current_setting('app.tenant_id', true)::uuid
          and po.status = 'paid'
          and (po.invoice_number is null or po.invoice_number = '')
          and (
            ${filter.currency ?? null}::text is null
            or upper(po.currency) = upper(${filter.currency ?? null})
          )
      `,
      tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from payment_instalments pi
        join payment_instalment_plans p on p.id = pi.plan_id and p.tenant_id = pi.tenant_id
        where pi.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            pi.status = 'overdue'
            or (pi.status = 'scheduled' and pi.due_at < now())
          )
          and (
            ${filter.currency ?? null}::text is null
            or upper(p.currency) = upper(${filter.currency ?? null})
          )
      `,
      tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from payment_orders po
        where po.tenant_id = current_setting('app.tenant_id', true)::uuid
          and lower(po.status) in ('failed', 'failure', 'declined')
          and coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom}::timestamptz
          and coalesce(po.paid_at, po.created_at) <= ${filter.paidTo}::timestamptz
          and (
            ${filter.currency ?? null}::text is null
            or upper(po.currency) = upper(${filter.currency ?? null})
          )
      `,
    ]);
    return {
      unsent_invoice_count: Number(unsent[0]?.count ?? 0),
      overdue_instalment_count: Number(overdue[0]?.count ?? 0),
      failed_payment_count: Number(failed[0]?.count ?? 0),
    };
  },

  async getOverviewRevenueTrend(
    tx: TenantTx,
    filter: PaymentOverviewFilter,
    grain: PaymentOverviewGrain,
  ): Promise<
    Array<{
      date: string;
      course_cents: number;
      bundle_cents: number;
      subscription_cents: number;
      live_class_cents: number;
      other_cents: number;
      total_cents: number;
      order_count: number;
    }>
  > {
    const trunc = grain === "week" ? "week" : grain === "month" ? "month" : "day";
    const step = grain === "week" ? "1 week" : grain === "month" ? "1 month" : "1 day";
    const rows = await tx.$queryRaw<
      Array<{
        bucket: string;
        course_cents: bigint;
        bundle_cents: bigint;
        subscription_cents: bigint;
        live_class_cents: bigint;
        other_cents: bigint;
        total_cents: bigint;
        order_count: bigint;
      }>
    >`
      with buckets as (
        select generate_series(
          date_trunc(${trunc}, ${filter.paidFrom}::timestamptz),
          date_trunc(${trunc}, ${filter.paidTo}::timestamptz),
          ${step}::interval
        ) as bucket
      ),
      typed as (
        select
          date_trunc(${trunc}, coalesce(po.paid_at, po.created_at)) as bucket,
          lower(coalesce(po.product_type, po.metadata_json->>'productType', 'course')) as product_type,
          po.amount_cents
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
        to_char(b.bucket, 'YYYY-MM-DD') as bucket,
        coalesce(sum(t.amount_cents) filter (
          where t.product_type in ('course', 'courses')
        ), 0)::bigint as course_cents,
        coalesce(sum(t.amount_cents) filter (
          where t.product_type in ('bundle', 'bundles')
        ), 0)::bigint as bundle_cents,
        coalesce(sum(t.amount_cents) filter (
          where t.product_type in ('subscription', 'subscriptions', 'membership')
        ), 0)::bigint as subscription_cents,
        coalesce(sum(t.amount_cents) filter (
          where t.product_type in ('live_class', 'live-class', 'live', 'liveclass')
        ), 0)::bigint as live_class_cents,
        coalesce(sum(t.amount_cents) filter (
          where t.product_type is not null
            and t.product_type not in (
              'course', 'courses', 'bundle', 'bundles',
              'subscription', 'subscriptions', 'membership',
              'live_class', 'live-class', 'live', 'liveclass'
            )
        ), 0)::bigint as other_cents,
        coalesce(sum(t.amount_cents), 0)::bigint as total_cents,
        count(t.amount_cents)::bigint as order_count
      from buckets b
      left join typed t on t.bucket = b.bucket
      group by b.bucket
      order by b.bucket asc
    `;
    return rows.map((row) => ({
      date: row.bucket,
      course_cents: Number(row.course_cents),
      bundle_cents: Number(row.bundle_cents),
      subscription_cents: Number(row.subscription_cents),
      live_class_cents: Number(row.live_class_cents),
      other_cents: Number(row.other_cents),
      total_cents: Number(row.total_cents),
      order_count: Number(row.order_count),
    }));
  },

  async getOverviewByGateway(
    tx: TenantTx,
    filter: PaymentOverviewFilter,
  ): Promise<Array<{ gateway_key: string; display_name: string; amount_cents: number }>> {
    const rows = await tx.$queryRaw<
      Array<{ gateway_key: string; display_name: string; amount_cents: bigint }>
    >`
      select
        coalesce(
          po.gateway_key,
          po.metadata_json->>'gatewayKey',
          po.metadata_json->>'gateway_key',
          'unknown'
        ) as gateway_key,
        coalesce(pg.display_name,
          coalesce(
            po.gateway_key,
            po.metadata_json->>'gatewayKey',
            po.metadata_json->>'gateway_key',
            'Unknown'
          )
        ) as display_name,
        coalesce(sum(po.amount_cents), 0)::bigint as amount_cents
      from payment_orders po
      left join payment_gateways pg
        on pg.tenant_id = po.tenant_id
        and pg.gateway_key = coalesce(
          po.gateway_key,
          po.metadata_json->>'gatewayKey',
          po.metadata_json->>'gateway_key'
        )
      where po.tenant_id = current_setting('app.tenant_id', true)::uuid
        and po.status = 'paid'
        and coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom}::timestamptz
        and coalesce(po.paid_at, po.created_at) <= ${filter.paidTo}::timestamptz
        and (
          ${filter.currency ?? null}::text is null
          or upper(po.currency) = upper(${filter.currency ?? null})
        )
      group by 1, 2
      order by amount_cents desc, gateway_key asc
      limit 8
    `;
    return rows.map((row) => ({
      gateway_key: row.gateway_key,
      display_name: row.display_name,
      amount_cents: Number(row.amount_cents),
    }));
  },

  async getOverviewTopProducts(
    tx: TenantTx,
    filter: PaymentOverviewFilter,
  ): Promise<
    Array<{
      product_title: string;
      product_type: string;
      amount_cents: number;
      order_count: number;
    }>
  > {
    const rows = await tx.$queryRaw<
      Array<{
        product_title: string;
        product_type: string;
        amount_cents: bigint;
        order_count: bigint;
      }>
    >`
      select
        coalesce(
          po.product_title,
          po.metadata_json->>'productTitle',
          po.metadata_json->>'courseTitle',
          'Untitled product'
        ) as product_title,
        coalesce(po.product_type, po.metadata_json->>'productType', 'course') as product_type,
        coalesce(sum(po.amount_cents), 0)::bigint as amount_cents,
        count(*)::bigint as order_count
      from payment_orders po
      where po.tenant_id = current_setting('app.tenant_id', true)::uuid
        and po.status = 'paid'
        and coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom}::timestamptz
        and coalesce(po.paid_at, po.created_at) <= ${filter.paidTo}::timestamptz
        and (
          ${filter.currency ?? null}::text is null
          or upper(po.currency) = upper(${filter.currency ?? null})
        )
      group by 1, 2
      order by amount_cents desc, product_title asc
      limit 5
    `;
    return rows.map((row) => ({
      product_title: row.product_title,
      product_type: row.product_type,
      amount_cents: Number(row.amount_cents),
      order_count: Number(row.order_count),
    }));
  },
};
