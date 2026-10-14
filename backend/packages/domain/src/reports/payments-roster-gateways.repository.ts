import type { TenantTx } from "@atlas/db";
import type {
  PaymentGatewaySummaryFilter,
  PaymentGatewaySummaryRow,
} from "./payments-roster.repository";

/**
 * Payment gateways and their stats.
 * Part of paymentsRosterRepository.
 */
export const paymentsRosterGatewaysRepository = {
  async listGateways(
    tx: TenantTx,
    filter: PaymentGatewaySummaryFilter,
  ): Promise<PaymentGatewaySummaryRow[]> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        gateway_key: string;
        display_name: string;
        is_configured: boolean;
        is_published: boolean;
        is_default: boolean;
        transaction_count: number;
        paid_transaction_count: number;
        failed_count: number;
        paid_amount_cents: number;
        currency: string | null;
      }>
    >`
      select
        pg.id::text as id,
        pg.gateway_key,
        pg.display_name,
        pg.is_configured,
        pg.is_published,
        pg.is_default,
        coalesce(stats.transaction_count, 0)::int as transaction_count,
        coalesce(stats.paid_transaction_count, 0)::int as paid_transaction_count,
        coalesce(stats.failed_count, 0)::int as failed_count,
        coalesce(stats.paid_amount_cents, 0)::int as paid_amount_cents,
        stats.currency
      from payment_gateways pg
      left join lateral (
        select
          count(*)::int as transaction_count,
          count(*) filter (where po.status = 'paid')::int as paid_transaction_count,
          count(*) filter (
            where lower(po.status) in ('failed', 'failure', 'declined')
          )::int as failed_count,
          coalesce(
            sum(case when po.status = 'paid' then po.amount_cents else 0 end),
            0
          )::int as paid_amount_cents,
          (
            array_agg(po.currency order by po.amount_cents desc)
            filter (where po.status = 'paid')
          )[1] as currency
        from payment_orders po
        where po.tenant_id = pg.tenant_id
          and coalesce(
            po.gateway_key,
            po.metadata_json->>'gatewayKey',
            po.metadata_json->>'gateway_key'
          ) = pg.gateway_key
          and coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom}::timestamptz
          and coalesce(po.paid_at, po.created_at) <= ${filter.paidTo}::timestamptz
      ) stats on true
      where pg.tenant_id = current_setting('app.tenant_id', true)::uuid
      order by
        coalesce(stats.paid_amount_cents, 0) desc,
        pg.is_default desc,
        pg.display_name asc
    `;
    return rows;
  },

  async findGatewayByKey(
    tx: TenantTx,
    gatewayKey: string,
  ): Promise<{
    id: string;
    gateway_key: string;
    display_name: string;
    is_configured: boolean;
    is_published: boolean;
    is_default: boolean;
    publishable_key: string | null;
    secret_last4: string | null;
    created_at: Date;
    updated_at: Date;
  } | null> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        gateway_key: string;
        display_name: string;
        is_configured: boolean;
        is_published: boolean;
        is_default: boolean;
        publishable_key: string | null;
        secret_last4: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      select
        id::text as id,
        gateway_key,
        display_name,
        is_configured,
        is_published,
        is_default,
        publishable_key,
        secret_last4,
        created_at,
        updated_at
      from payment_gateways
      where gateway_key = ${gatewayKey}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async getGatewayWindowStats(
    tx: TenantTx,
    gatewayKey: string,
    filter: PaymentGatewaySummaryFilter,
  ): Promise<{
    transaction_count: number;
    paid_transaction_count: number;
    failed_count: number;
    refunded_count: number;
    paid_amount_cents: number;
    currency: string | null;
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        transaction_count: number;
        paid_transaction_count: number;
        failed_count: number;
        refunded_count: number;
        paid_amount_cents: number;
        currency: string | null;
      }>
    >`
      select
        count(*)::int as transaction_count,
        count(*) filter (where po.status = 'paid')::int as paid_transaction_count,
        count(*) filter (
          where lower(po.status) in ('failed', 'failure', 'declined')
        )::int as failed_count,
        count(*) filter (where lower(po.status) in ('refunded', 'refund'))::int as refunded_count,
        coalesce(
          sum(case when po.status = 'paid' then po.amount_cents else 0 end),
          0
        )::int as paid_amount_cents,
        (
          array_agg(po.currency order by po.amount_cents desc)
          filter (where po.status = 'paid')
        )[1] as currency
      from payment_orders po
      where po.tenant_id = current_setting('app.tenant_id', true)::uuid
        and coalesce(
          po.gateway_key,
          po.metadata_json->>'gatewayKey',
          po.metadata_json->>'gateway_key'
        ) = ${gatewayKey}
        and coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom}::timestamptz
        and coalesce(po.paid_at, po.created_at) <= ${filter.paidTo}::timestamptz
    `;
    const row = rows[0];
    return {
      transaction_count: row?.transaction_count ?? 0,
      paid_transaction_count: row?.paid_transaction_count ?? 0,
      failed_count: row?.failed_count ?? 0,
      refunded_count: row?.refunded_count ?? 0,
      paid_amount_cents: row?.paid_amount_cents ?? 0,
      currency: row?.currency ?? null,
    };
  },
};
