import type { TenantTx } from "@atlas/db";
import type { PaymentTransactionsQuery } from "./payments-roster.dto";
import { textColumn } from "./raw-column";
import type {
  PaymentRefundLedgerRow,
  PaymentRefundsFilter,
  PaymentTransactionDetailRow,
  PaymentTransactionRow,
  PaymentTransactionsFilter,
} from "./payments-roster.repository";
import { asDate, asIntOrNull, asUuidOrNull } from "./payments-roster.repository-helpers";

function mapTransaction(row: Record<string, unknown>): PaymentTransactionRow {
  const createdAt = asDate(row["created_at"]) ?? new Date(0);
  return {
    id: textColumn(row["id"]),
    membership_id: asUuidOrNull(row["membership_id"]),
    learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    product_title: typeof row["product_title"] === "string" ? row["product_title"] : null,
    product_type: typeof row["product_type"] === "string" ? row["product_type"] : null,
    gateway_key: typeof row["gateway_key"] === "string" ? row["gateway_key"] : null,
    coupon_amount_cents: asIntOrNull(row["coupon_amount_cents"]),
    amount_cents: asIntOrNull(row["amount_cents"]) ?? 0,
    tax_amount_cents: asIntOrNull(row["tax_amount_cents"]),
    currency: textColumn(row["currency"], "USD"),
    status: textColumn(row["status"], "pending"),
    invoice_number: typeof row["invoice_number"] === "string" ? row["invoice_number"] : null,
    external_id: typeof row["external_id"] === "string" ? row["external_id"] : null,
    paid_at: asDate(row["paid_at"]),
    created_at: createdAt,
  };
}

/**
 * Transactions and refunds: the lists, one transaction, and recording a refund.
 * Part of paymentsRosterRepository.
 */
export const paymentsRosterTransactionsRepository = {
  async countTransactions(tx: TenantTx, filter: PaymentTransactionsFilter): Promise<number> {
    const dateField = filter.dateField ?? "paid_at";
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from payment_orders po
      left join memberships m on m.id = po.membership_id and m.tenant_id = po.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where po.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${filter.status ?? null}::text is null or lower(po.status) = lower(${filter.status ?? null}))
        and (
          ${filter.productType ?? null}::text is null
          or coalesce(po.product_type, po.metadata_json->>'productType', 'course') = ${filter.productType ?? null}
        )
        and (
          ${filter.gatewayKey ?? null}::text is null
          or coalesce(po.gateway_key, po.metadata_json->>'gatewayKey', po.metadata_json->>'gateway_key') = ${filter.gatewayKey ?? null}
        )
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.amountMinCents ?? null}::int is null
          or po.amount_cents >= ${filter.amountMinCents ?? null}::int
        )
        and (
          ${filter.paidFrom ?? null}::timestamptz is null
          or case
            when ${dateField} = 'created_at' then po.created_at
            else coalesce(po.paid_at, po.created_at)
          end >= ${filter.paidFrom ?? null}::timestamptz
        )
        and (
          ${filter.paidTo ?? null}::timestamptz is null
          or case
            when ${dateField} = 'created_at' then po.created_at
            else coalesce(po.paid_at, po.created_at)
          end <= ${filter.paidTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async sumTransactionAmounts(tx: TenantTx, filter: PaymentTransactionsFilter): Promise<number> {
    const dateField = filter.dateField ?? "paid_at";
    const rows = await tx.$queryRaw<Array<{ total: bigint }>>`
      select coalesce(sum(po.amount_cents), 0)::bigint as total
      from payment_orders po
      left join memberships m on m.id = po.membership_id and m.tenant_id = po.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where po.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${filter.status ?? null}::text is null or lower(po.status) = lower(${filter.status ?? null}))
        and (
          ${filter.productType ?? null}::text is null
          or coalesce(po.product_type, po.metadata_json->>'productType', 'course') = ${filter.productType ?? null}
        )
        and (
          ${filter.gatewayKey ?? null}::text is null
          or coalesce(po.gateway_key, po.metadata_json->>'gatewayKey', po.metadata_json->>'gateway_key') = ${filter.gatewayKey ?? null}
        )
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.amountMinCents ?? null}::int is null
          or po.amount_cents >= ${filter.amountMinCents ?? null}::int
        )
        and (
          ${filter.paidFrom ?? null}::timestamptz is null
          or case
            when ${dateField} = 'created_at' then po.created_at
            else coalesce(po.paid_at, po.created_at)
          end >= ${filter.paidFrom ?? null}::timestamptz
        )
        and (
          ${filter.paidTo ?? null}::timestamptz is null
          or case
            when ${dateField} = 'created_at' then po.created_at
            else coalesce(po.paid_at, po.created_at)
          end <= ${filter.paidTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.total ?? 0);
  },

  async listTransactions(
    tx: TenantTx,
    query: PaymentTransactionsQuery,
  ): Promise<PaymentTransactionRow[]> {
    const skip = (query.page - 1) * query.limit;
    const dateField = query.dateField;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        po.id::text as id,
        po.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        coalesce(
          po.product_title,
          c.title,
          po.metadata_json->>'productTitle',
          po.metadata_json->>'courseTitle'
        ) as product_title,
        coalesce(po.product_type, po.metadata_json->>'productType', 'course') as product_type,
        coalesce(po.gateway_key, po.metadata_json->>'gatewayKey', po.metadata_json->>'gateway_key') as gateway_key,
        coalesce(
          po.coupon_amount_cents,
          case
            when (po.metadata_json->>'discountCents') ~ '^-?[0-9]+$'
            then (po.metadata_json->>'discountCents')::int
            else null
          end,
          0
        ) as coupon_amount_cents,
        po.amount_cents,
        po.tax_amount_cents,
        po.currency,
        po.status,
        po.invoice_number,
        po.external_id,
        po.paid_at,
        po.created_at
      from payment_orders po
      left join memberships m on m.id = po.membership_id and m.tenant_id = po.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join courses c
        on c.tenant_id = po.tenant_id
        and (po.metadata_json->>'courseId') ~ '^[0-9a-fA-F-]{36}$'
        and c.id = (po.metadata_json->>'courseId')::uuid
      where po.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${query.status ?? null}::text is null or lower(po.status) = lower(${query.status ?? null}))
        and (
          ${query.productType ?? null}::text is null
          or coalesce(po.product_type, po.metadata_json->>'productType', 'course') = ${query.productType ?? null}
        )
        and (
          ${query.gatewayKey ?? null}::text is null
          or coalesce(po.gateway_key, po.metadata_json->>'gatewayKey', po.metadata_json->>'gateway_key') = ${query.gatewayKey ?? null}
        )
        and (
          ${query.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.learnerName ?? null}) || '%'
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.learnerName ?? null}) || '%'
        )
        and (
          ${query.amountMinCents ?? null}::int is null
          or po.amount_cents >= ${query.amountMinCents ?? null}::int
        )
        and (
          ${query.paidFrom ?? null}::timestamptz is null
          or case
            when ${dateField} = 'created_at' then po.created_at
            else coalesce(po.paid_at, po.created_at)
          end >= ${query.paidFrom ?? null}::timestamptz
        )
        and (
          ${query.paidTo ?? null}::timestamptz is null
          or case
            when ${dateField} = 'created_at' then po.created_at
            else coalesce(po.paid_at, po.created_at)
          end <= ${query.paidTo ?? null}::timestamptz
        )
      order by
        case when ${query.sortBy} = 'coupon_amount_cents' and ${query.sortDir} = 'asc'
          then coalesce(
            po.coupon_amount_cents,
            case
              when (po.metadata_json->>'discountCents') ~ '^-?[0-9]+$'
              then (po.metadata_json->>'discountCents')::int
              else null
            end,
            0
          ) end asc nulls last,
        case when ${query.sortBy} = 'coupon_amount_cents' and ${query.sortDir} = 'desc'
          then coalesce(
            po.coupon_amount_cents,
            case
              when (po.metadata_json->>'discountCents') ~ '^-?[0-9]+$'
              then (po.metadata_json->>'discountCents')::int
              else null
            end,
            0
          ) end desc nulls last,
        case when ${query.sortBy} = 'amount_cents' and ${query.sortDir} = 'asc' then po.amount_cents end asc,
        case when ${query.sortBy} = 'amount_cents' and ${query.sortDir} = 'desc' then po.amount_cents end desc,
        case when ${query.sortBy} = 'created_at' and ${query.sortDir} = 'asc' then po.created_at end asc,
        case when ${query.sortBy} = 'created_at' and ${query.sortDir} = 'desc' then po.created_at end desc,
        case when ${query.sortBy} = 'paid_at' and ${query.sortDir} = 'asc' then coalesce(po.paid_at, po.created_at) end asc,
        case when ${query.sortBy} = 'paid_at' and ${query.sortDir} = 'desc' then coalesce(po.paid_at, po.created_at) end desc,
        po.id desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map(mapTransaction);
  },

  async getRefundsQueueSummary(
    tx: TenantTx,
    filter: Omit<PaymentRefundsFilter, "queue">,
  ): Promise<{
    refundable_count: number;
    partial_count: number;
    refunded_count: number;
    refundable_amount_cents: number;
    refunded_amount_cents: number;
    currency: string | null;
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        refundable_count: number;
        partial_count: number;
        refunded_count: number;
        refundable_amount_cents: number;
        refunded_amount_cents: number;
        currency: string | null;
      }>
    >`
      with base as (
        select
          po.id,
          po.amount_cents,
          po.currency,
          po.status,
          coalesce((
            select sum(coalesce((elem->>'amountCents')::int, 0))
            from jsonb_array_elements(
              case
                when jsonb_typeof(coalesce(po.metadata_json->'refunds', '[]'::jsonb)) = 'array'
                then coalesce(po.metadata_json->'refunds', '[]'::jsonb)
                else '[]'::jsonb
              end
            ) elem
          ), 0)::int as refunded_amount_cents,
          coalesce((select sum(ri.amount_cents) from payment_refund_intents ri
            where ri.tenant_id = po.tenant_id and ri.order_id = po.id
              and ri.status in ('requested','processing','pending','reconciliation_required')
          ), 0)::int as reserved_amount_cents
        from payment_orders po
        left join memberships m on m.id = po.membership_id and m.tenant_id = po.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where po.tenant_id = current_setting('app.tenant_id', true)::uuid
          and lower(po.status) not in ('failed', 'cancelled', 'pending')
          and (
            ${filter.gatewayKey ?? null}::text is null
            or coalesce(po.gateway_key, po.metadata_json->>'gatewayKey', po.metadata_json->>'gateway_key') = ${filter.gatewayKey ?? null}
          )
          and (
            ${filter.q ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.q ?? null}) || '%'
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.q ?? null}) || '%'
            or lower(coalesce(po.product_title, '')) like '%' || lower(${filter.q ?? null}) || '%'
            or lower(coalesce(po.invoice_number, '')) like '%' || lower(${filter.q ?? null}) || '%'
            or lower(coalesce(po.external_id, '')) like '%' || lower(${filter.q ?? null}) || '%'
          )
          and (
            ${filter.paidFrom ?? null}::timestamptz is null
            or coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom ?? null}::timestamptz
          )
          and (
            ${filter.paidTo ?? null}::timestamptz is null
            or coalesce(po.paid_at, po.created_at) <= ${filter.paidTo ?? null}::timestamptz
          )
      )
      select
        count(*) filter (
          where lower(status) = 'paid' and refunded_amount_cents = 0 and reserved_amount_cents < amount_cents
        )::int as refundable_count,
        count(*) filter (
          where lower(status) = 'paid'
            and refunded_amount_cents > 0
            and refunded_amount_cents + reserved_amount_cents < amount_cents
        )::int as partial_count,
        count(*) filter (
          where lower(status) like '%refund%'
            or refunded_amount_cents >= amount_cents
        )::int as refunded_count,
        coalesce(sum(
          case
            when lower(status) = 'paid' and refunded_amount_cents + reserved_amount_cents < amount_cents
            then greatest(0, amount_cents - refunded_amount_cents - reserved_amount_cents)
            else 0
          end
        ), 0)::int as refundable_amount_cents,
        coalesce(sum(refunded_amount_cents), 0)::int as refunded_amount_cents,
        (
          array_agg(currency order by amount_cents desc)
        )[1] as currency
      from base
    `;
    const row = rows[0];
    return {
      refundable_count: row?.refundable_count ?? 0,
      partial_count: row?.partial_count ?? 0,
      refunded_count: row?.refunded_count ?? 0,
      refundable_amount_cents: row?.refundable_amount_cents ?? 0,
      refunded_amount_cents: row?.refunded_amount_cents ?? 0,
      currency: row?.currency ?? null,
    };
  },

  async countRefundLedger(tx: TenantTx, filter: PaymentRefundsFilter): Promise<number> {
    const queue = filter.queue;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with base as (
        select
          po.id,
          po.amount_cents,
          po.status,
          coalesce((
            select sum(coalesce((elem->>'amountCents')::int, 0))
            from jsonb_array_elements(
              case
                when jsonb_typeof(coalesce(po.metadata_json->'refunds', '[]'::jsonb)) = 'array'
                then coalesce(po.metadata_json->'refunds', '[]'::jsonb)
                else '[]'::jsonb
              end
            ) elem
          ), 0)::int as refunded_amount_cents,
          coalesce((select sum(ri.amount_cents) from payment_refund_intents ri
            where ri.tenant_id = po.tenant_id and ri.order_id = po.id
              and ri.status in ('requested','processing','pending','reconciliation_required')
          ), 0)::int as reserved_amount_cents
        from payment_orders po
        left join memberships m on m.id = po.membership_id and m.tenant_id = po.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where po.tenant_id = current_setting('app.tenant_id', true)::uuid
          and lower(po.status) not in ('failed', 'cancelled', 'pending')
          and (
            ${filter.gatewayKey ?? null}::text is null
            or coalesce(po.gateway_key, po.metadata_json->>'gatewayKey', po.metadata_json->>'gateway_key') = ${filter.gatewayKey ?? null}
          )
          and (
            ${filter.q ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.q ?? null}) || '%'
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.q ?? null}) || '%'
            or lower(coalesce(po.product_title, '')) like '%' || lower(${filter.q ?? null}) || '%'
            or lower(coalesce(po.invoice_number, '')) like '%' || lower(${filter.q ?? null}) || '%'
            or lower(coalesce(po.external_id, '')) like '%' || lower(${filter.q ?? null}) || '%'
          )
          and (
            ${filter.paidFrom ?? null}::timestamptz is null
            or coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom ?? null}::timestamptz
          )
          and (
            ${filter.paidTo ?? null}::timestamptz is null
            or coalesce(po.paid_at, po.created_at) <= ${filter.paidTo ?? null}::timestamptz
          )
      )
      select count(*)::bigint as count
      from base
      where (
        ${queue} = 'all'
        and (
          (lower(status) = 'paid' and refunded_amount_cents + reserved_amount_cents < amount_cents)
          or reserved_amount_cents > 0
          or lower(status) like '%refund%'
          or refunded_amount_cents >= amount_cents
        )
      )
      or (
        ${queue} = 'refundable'
        and lower(status) = 'paid'
        and refunded_amount_cents = 0 and reserved_amount_cents < amount_cents
      )
      or (
        ${queue} = 'partial'
        and lower(status) = 'paid'
        and refunded_amount_cents > 0
        and refunded_amount_cents + reserved_amount_cents < amount_cents
      )
      or (
        ${queue} = 'refunded'
        and (lower(status) like '%refund%' or refunded_amount_cents >= amount_cents)
      )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listRefundLedger(
    tx: TenantTx,
    query: {
      queue: PaymentRefundsFilter["queue"];
      paidFrom?: string;
      paidTo?: string;
      q?: string;
      gatewayKey?: string;
      sortBy: "paid_at" | "created_at" | "amount_cents";
      sortDir: "asc" | "desc";
      limit: number;
      page: number;
    },
  ): Promise<PaymentRefundLedgerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const queue = query.queue;
    const rows = await tx.$queryRaw<PaymentRefundLedgerRow[]>`
      with base as (
        select
          po.id::text as id,
          po.membership_id::text as membership_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          po.product_title,
          coalesce(po.gateway_key, po.metadata_json->>'gatewayKey', po.metadata_json->>'gateway_key') as gateway_key,
          po.amount_cents,
          coalesce((
            select sum(coalesce((elem->>'amountCents')::int, 0))
            from jsonb_array_elements(
              case
                when jsonb_typeof(coalesce(po.metadata_json->'refunds', '[]'::jsonb)) = 'array'
                then coalesce(po.metadata_json->'refunds', '[]'::jsonb)
                else '[]'::jsonb
              end
            ) elem
          ), 0)::int as refunded_amount_cents,
          coalesce((select sum(ri.amount_cents) from payment_refund_intents ri
            where ri.tenant_id = po.tenant_id and ri.order_id = po.id
              and ri.status in ('requested','processing','pending','reconciliation_required')
          ), 0)::int as reserved_amount_cents,
          po.currency,
          po.status,
          po.invoice_number,
          po.paid_at,
          po.created_at,
          po.metadata_json
        from payment_orders po
        left join memberships m on m.id = po.membership_id and m.tenant_id = po.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where po.tenant_id = current_setting('app.tenant_id', true)::uuid
          and lower(po.status) not in ('failed', 'cancelled', 'pending')
          and (
            ${query.gatewayKey ?? null}::text is null
            or coalesce(po.gateway_key, po.metadata_json->>'gatewayKey', po.metadata_json->>'gateway_key') = ${query.gatewayKey ?? null}
          )
          and (
            ${query.q ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.q ?? null}) || '%'
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.q ?? null}) || '%'
            or lower(coalesce(po.product_title, '')) like '%' || lower(${query.q ?? null}) || '%'
            or lower(coalesce(po.invoice_number, '')) like '%' || lower(${query.q ?? null}) || '%'
            or lower(coalesce(po.external_id, '')) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${query.paidFrom ?? null}::timestamptz is null
            or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz
          )
          and (
            ${query.paidTo ?? null}::timestamptz is null
            or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz
          )
      )
      select
        id,
        membership_id,
        learner_name,
        email,
        product_title,
        gateway_key,
        amount_cents,
        refunded_amount_cents,
        reserved_amount_cents,
        (case when lower(status) = 'refunded' then 0 else greatest(0, amount_cents - refunded_amount_cents - reserved_amount_cents) end)::int as refundable_amount_cents,
        currency,
        status,
        invoice_number,
        paid_at,
        created_at,
        metadata_json
      from base
      where (
        ${queue} = 'all'
        and (
          (lower(status) = 'paid' and refunded_amount_cents + reserved_amount_cents < amount_cents)
          or reserved_amount_cents > 0
          or lower(status) like '%refund%'
          or refunded_amount_cents >= amount_cents
        )
      )
      or (
        ${queue} = 'refundable'
        and lower(status) = 'paid'
        and refunded_amount_cents = 0 and reserved_amount_cents < amount_cents
      )
      or (
        ${queue} = 'partial'
        and lower(status) = 'paid'
        and refunded_amount_cents > 0
        and refunded_amount_cents + reserved_amount_cents < amount_cents
      )
      or (
        ${queue} = 'refunded'
        and (lower(status) like '%refund%' or refunded_amount_cents >= amount_cents)
      )
      order by
        case when ${query.sortBy} = 'amount_cents' and ${query.sortDir} = 'asc' then amount_cents end asc,
        case when ${query.sortBy} = 'amount_cents' and ${query.sortDir} = 'desc' then amount_cents end desc,
        case when ${query.sortBy} = 'created_at' and ${query.sortDir} = 'asc' then created_at end asc,
        case when ${query.sortBy} = 'created_at' and ${query.sortDir} = 'desc' then created_at end desc,
        case when ${query.sortBy} = 'paid_at' and ${query.sortDir} = 'asc' then coalesce(paid_at, created_at) end asc,
        case when ${query.sortBy} = 'paid_at' and ${query.sortDir} = 'desc' then coalesce(paid_at, created_at) end desc,
        id desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows;
  },

  async findTransactionDetailByOrderId(
    tx: TenantTx,
    orderId: string,
  ): Promise<PaymentTransactionDetailRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        po.id::text as id,
        po.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        coalesce(
          po.product_title,
          c.title,
          po.metadata_json->>'productTitle',
          po.metadata_json->>'courseTitle'
        ) as product_title,
        coalesce(po.product_type, po.metadata_json->>'productType', 'course') as product_type,
        po.gateway_key,
        po.coupon_amount_cents,
        po.amount_cents,
        po.tax_amount_cents,
        po.currency,
        po.status,
        po.invoice_number,
        po.external_id,
        coalesce(po.billing_name, mp.display_name) as billing_name,
        po.metadata_json,
        po.paid_at,
        po.created_at,
        po.updated_at
      from payment_orders po
      left join memberships m on m.id = po.membership_id and m.tenant_id = po.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join courses c
        on c.tenant_id = po.tenant_id
        and (po.metadata_json->>'courseId') ~ '^[0-9a-fA-F-]{36}$'
        and c.id = (po.metadata_json->>'courseId')::uuid
      where po.id = ${orderId}::uuid
        and po.tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: textColumn(row["id"]),
      membership_id: typeof row["membership_id"] === "string" ? row["membership_id"] : null,
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      product_title: typeof row["product_title"] === "string" ? row["product_title"] : null,
      product_type: typeof row["product_type"] === "string" ? row["product_type"] : null,
      gateway_key: typeof row["gateway_key"] === "string" ? row["gateway_key"] : null,
      coupon_amount_cents:
        row["coupon_amount_cents"] == null ? null : Number(row["coupon_amount_cents"]),
      amount_cents: Number(row["amount_cents"]),
      tax_amount_cents: row["tax_amount_cents"] == null ? null : Number(row["tax_amount_cents"]),
      currency: textColumn(row["currency"]),
      status: textColumn(row["status"]),
      invoice_number: typeof row["invoice_number"] === "string" ? row["invoice_number"] : null,
      external_id: typeof row["external_id"] === "string" ? row["external_id"] : null,
      billing_name: typeof row["billing_name"] === "string" ? row["billing_name"] : null,
      metadata_json: row["metadata_json"] ?? null,
      paid_at: row["paid_at"] instanceof Date ? row["paid_at"] : null,
      created_at: row["created_at"] as Date,
      updated_at: row["updated_at"] as Date,
    };
  },

  async updateOrderRefund(
    tx: TenantTx,
    args: {
      orderId: string;
      status: string;
      metadataJson: unknown;
    },
  ): Promise<PaymentTransactionDetailRow | null> {
    await tx.$executeRaw`
      update payment_orders
      set
        status = ${args.status},
        metadata_json = ${JSON.stringify(args.metadataJson)}::jsonb,
        updated_at = now()
      where id = ${args.orderId}::uuid
        and tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
    return this.findTransactionDetailByOrderId(tx, args.orderId);
  },

  async revokeCourseEnrollment(
    tx: TenantTx,
    args: { membershipId: string; courseId: string },
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      update enrollments
      set status = 'revoked'
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and membership_id = ${args.membershipId}::uuid
        and course_id = ${args.courseId}::uuid
        and status = 'active'
      returning id::text as id
    `;
    return rows.length > 0;
  },
};
