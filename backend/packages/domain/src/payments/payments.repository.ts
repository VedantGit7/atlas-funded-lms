import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { PAYMENT_ORDER_FAULTS } from "./payments.dto";

export type PaymentOrderRow = {
  id: string;
  tenant_id: string;
  membership_id: string | null;
  external_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  metadata_json: unknown;
  gateway_key: string | null;
  product_title: string | null;
  product_type: string | null;
  coupon_amount_cents: number | null;
  tax_amount_cents: number | null;
  invoice_number: string | null;
  billing_name: string | null;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function mapRow(row: Record<string, unknown>): PaymentOrderRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    membership_id: typeof row["membership_id"] === "string" ? row["membership_id"] : null,
    external_id: typeof row["external_id"] === "string" ? row["external_id"] : null,
    amount_cents: Number(row["amount_cents"]),
    currency: String(row["currency"]),
    status: String(row["status"]),
    metadata_json: row["metadata_json"] ?? null,
    gateway_key: typeof row["gateway_key"] === "string" ? row["gateway_key"] : null,
    product_title: typeof row["product_title"] === "string" ? row["product_title"] : null,
    product_type: typeof row["product_type"] === "string" ? row["product_type"] : null,
    coupon_amount_cents:
      row["coupon_amount_cents"] == null ? null : Number(row["coupon_amount_cents"]),
    tax_amount_cents: row["tax_amount_cents"] == null ? null : Number(row["tax_amount_cents"]),
    invoice_number: typeof row["invoice_number"] === "string" ? row["invoice_number"] : null,
    billing_name: typeof row["billing_name"] === "string" ? row["billing_name"] : null,
    paid_at: row["paid_at"] instanceof Date ? row["paid_at"] : null,
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

/** The filters the ledger page and its summary both apply. */
export type PaymentOrderFilter = {
  status?: string;
  q?: string;
  currency?: string;
  settlement?: "settled" | "unsettled";
};

/** One `(status, currency)` bucket from the summary scan. */
export type PaymentOrderSummaryRow = {
  status: string;
  currency: string;
  total: bigint;
  amount_cents: bigint;
  missing_external_id: bigint;
  paid_without_timestamp: bigint;
};

/** One reconciliation fault an order can carry. */
export type PaymentOrderFault = (typeof PAYMENT_ORDER_FAULTS)[number];

/** The single-row aggregate behind the unmatched worklist's headline figures. */
export type UnmatchedOrderCountsRow = {
  scanned: bigint;
  missing_external_id: bigint;
  stale_pending: bigint;
  paid_without_timestamp: bigint;
  affected: bigint;
};

export const paymentsRepository = {
  async insertOrder(
    tx: TenantTx,
    args: {
      membershipId?: string | null;
      externalId?: string | null;
      amountCents: number;
      currency: string;
      status: string;
      metadataJson?: unknown;
      gatewayKey?: string | null;
      productTitle?: string | null;
      productType?: string | null;
      couponAmountCents?: number | null;
      taxAmountCents?: number | null;
      invoiceNumber?: string | null;
      billingName?: string | null;
      paidAt?: Date | null;
    },
  ): Promise<PaymentOrderRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into payment_orders (
        id, tenant_id, membership_id, external_id, amount_cents, currency, status,
        metadata_json, gateway_key, product_title, product_type, coupon_amount_cents,
        tax_amount_cents, invoice_number, billing_name, paid_at, created_at, updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.membershipId ?? null}::uuid,
        ${args.externalId ?? null},
        ${args.amountCents},
        ${args.currency},
        ${args.status},
        ${args.metadataJson ? JSON.stringify(args.metadataJson) : null}::jsonb,
        ${args.gatewayKey ?? null},
        ${args.productTitle ?? null},
        ${args.productType ?? null},
        ${args.couponAmountCents ?? null},
        ${args.taxAmountCents ?? null},
        ${args.invoiceNumber ?? null},
        ${args.billingName ?? null},
        ${args.paidAt ?? null}::timestamptz,
        now(),
        now()
      )
      returning *
    `;
    const row = rows[0];
    if (!row) throw new Error("PAYMENT_ORDER_INSERT_FAILED");
    return mapRow(row);
  },

  async listOrders(
    tx: TenantTx,
    args: PaymentOrderFilter & { cursor?: { createdAt: Date; id: string }; limit: number },
  ): Promise<PaymentOrderRow[]> {
    const like = args.q === undefined ? null : `%${args.q}%`;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from payment_orders
      where (${args.status ?? null}::text is null or status = ${args.status ?? null})
        and (${args.currency ?? null}::text is null or currency = ${args.currency ?? null})
        and (
          ${args.settlement ?? null}::text is null
          or (${args.settlement ?? null} = 'settled' and paid_at is not null)
          or (${args.settlement ?? null} = 'unsettled' and paid_at is null)
        )
        and (
          ${like}::text is null
          or external_id ilike ${like}
          or membership_id::text ilike ${like}
          or id::text ilike ${like}
        )
        and (
          ${args.cursor?.createdAt ?? null}::timestamptz is null
          or (created_at, id) <
             (${args.cursor?.createdAt ?? null}::timestamptz, ${args.cursor?.id ?? null}::uuid)
        )
      order by created_at desc, id desc
      limit ${args.limit + 1}
    `;
    return rows.map(mapRow);
  },

  /**
   * Every order matching the filter, up to a ceiling.
   *
   * Deliberately not the paged read: an export that walks the cursor would make
   * one request per fifty rows and could interleave with a webhook writing a
   * new order, producing a file that is neither one snapshot nor the other.
   * The predicate is repeated from `listOrders` for the reason given below.
   */
  async exportOrders(
    tx: TenantTx,
    args: PaymentOrderFilter & { limit: number },
  ): Promise<PaymentOrderRow[]> {
    const like = args.q === undefined ? null : `%${args.q}%`;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from payment_orders
      where (${args.status ?? null}::text is null or status = ${args.status ?? null})
        and (${args.currency ?? null}::text is null or currency = ${args.currency ?? null})
        and (
          ${args.settlement ?? null}::text is null
          or (${args.settlement ?? null} = 'settled' and paid_at is not null)
          or (${args.settlement ?? null} = 'unsettled' and paid_at is null)
        )
        and (
          ${like}::text is null
          or external_id ilike ${like}
          or membership_id::text ilike ${like}
          or id::text ilike ${like}
        )
      order by created_at desc, id desc
      limit ${args.limit}
    `;
    return rows.map(mapRow);
  },

  /**
   * Ledger-wide counts over the same filter the page uses.
   *
   * One grouped scan rather than a query per figure: the signal band shows five
   * numbers, and five passes over the ledger to draw a header is not a trade
   * worth making. The predicate is repeated verbatim from `listOrders` — the SQL
   * cannot be shared without a query-builder the Prisma boundary rules out — so
   * `tests/integration/api/payment-orders-summary.test.ts` asserts the two agree
   * under every filter.
   */
  async summariseOrders(tx: TenantTx, args: PaymentOrderFilter): Promise<PaymentOrderSummaryRow[]> {
    const like = args.q === undefined ? null : `%${args.q}%`;
    return await tx.$queryRaw<PaymentOrderSummaryRow[]>`
      select
        status,
        currency,
        count(*)::bigint as total,
        sum(amount_cents)::bigint as amount_cents,
        count(*) filter (
          where external_id is null or btrim(external_id) = ''
        )::bigint as missing_external_id,
        count(*) filter (where status = 'paid' and paid_at is null)::bigint
          as paid_without_timestamp
      from payment_orders
      where (${args.status ?? null}::text is null or status = ${args.status ?? null})
        and (${args.currency ?? null}::text is null or currency = ${args.currency ?? null})
        and (
          ${args.settlement ?? null}::text is null
          or (${args.settlement ?? null} = 'settled' and paid_at is not null)
          or (${args.settlement ?? null} = 'unsettled' and paid_at is null)
        )
        and (
          ${like}::text is null
          or external_id ilike ${like}
          or membership_id::text ilike ${like}
          or id::text ilike ${like}
        )
      group by status, currency
    `;
  },

  /**
   * Counts of each reconciliation fault across the whole ledger.
   *
   * One scan rather than three: the three predicates are `filter` clauses on a
   * single aggregate, so the numbers cannot disagree with each other the way
   * three separate queries against a moving table can. `affected` is a distinct
   * count because an order stuck for two reasons is still one order.
   */
  async countUnmatchedOrders(
    tx: TenantTx,
    args: { stalePendingDays: number },
  ): Promise<UnmatchedOrderCountsRow> {
    const rows = await tx.$queryRaw<UnmatchedOrderCountsRow[]>`
      select
        count(*)::bigint as scanned,
        count(*) filter (
          where external_id is null or btrim(external_id) = ''
        )::bigint as missing_external_id,
        count(*) filter (
          where status = 'pending'
            and created_at < now() - make_interval(days => ${args.stalePendingDays})
        )::bigint as stale_pending,
        count(*) filter (where status = 'paid' and paid_at is null)::bigint
          as paid_without_timestamp,
        count(*) filter (
          where external_id is null
            or btrim(external_id) = ''
            or (
              status = 'pending'
              and created_at < now() - make_interval(days => ${args.stalePendingDays})
            )
            or (status = 'paid' and paid_at is null)
        )::bigint as affected
      from payment_orders
    `;
    return (
      rows[0] ?? {
        scanned: 0n,
        missing_external_id: 0n,
        stale_pending: 0n,
        paid_without_timestamp: 0n,
        affected: 0n,
      }
    );
  },

  /**
   * A bounded sample of the orders carrying one fault.
   *
   * Oldest first, which inverts the ledger. A ledger answers "what happened
   * recently"; a worklist answers "what has been broken longest", and the row
   * that has been stuck for a fortnight is the one that matters.
   */
  async listUnmatchedOrders(
    tx: TenantTx,
    args: { fault: PaymentOrderFault; stalePendingDays: number; limit: number },
  ): Promise<PaymentOrderRow[]> {
    // Branched, never interpolated: the predicate shape differs per fault and
    // the parameter is the day count alone.
    const rows =
      args.fault === "missing-external-id"
        ? await tx.$queryRaw<Array<Record<string, unknown>>>`
            select * from payment_orders
            where external_id is null or btrim(external_id) = ''
            order by created_at asc, id asc
            limit ${args.limit}
          `
        : args.fault === "stale-pending"
          ? await tx.$queryRaw<Array<Record<string, unknown>>>`
              select * from payment_orders
              where status = 'pending'
                and created_at < now() - make_interval(days => ${args.stalePendingDays})
              order by created_at asc, id asc
              limit ${args.limit}
            `
          : await tx.$queryRaw<Array<Record<string, unknown>>>`
              select * from payment_orders
              where status = 'paid' and paid_at is null
              order by created_at asc, id asc
              limit ${args.limit}
            `;
    return rows.map(mapRow);
  },

  /**
   * The longest-standing affected order.
   *
   * Its own query rather than the first row of a sample, because the oldest
   * order overall need not be the oldest of whichever group happens to be
   * listed first.
   */
  async findOldestUnmatchedOrder(
    tx: TenantTx,
    args: { stalePendingDays: number },
  ): Promise<PaymentOrderRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select * from payment_orders
      where external_id is null
        or btrim(external_id) = ''
        or (
          status = 'pending'
          and created_at < now() - make_interval(days => ${args.stalePendingDays})
        )
        or (status = 'paid' and paid_at is null)
      order by created_at asc, id asc
      limit 1
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },

  /**
   * One order by id.
   *
   * RLS scopes this to the tenant, so a valid id belonging to somebody else
   * returns nothing rather than another tenant's ledger row.
   */
  async findOrderById(tx: TenantTx, orderId: string): Promise<PaymentOrderRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from payment_orders
      where id = ${orderId}::uuid
      limit 1
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async findByExternalId(tx: TenantTx, externalId: string): Promise<PaymentOrderRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from payment_orders
      where external_id = ${externalId}
      limit 1
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async updateOrderByExternalId(
    tx: TenantTx,
    args: {
      externalId: string;
      status: string;
      paidAt?: Date | null;
      invoiceNumber?: string | null;
    },
  ): Promise<PaymentOrderRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update payment_orders
      set
        status = ${args.status},
        paid_at = coalesce(${args.paidAt ?? null}::timestamptz, paid_at),
        invoice_number = coalesce(${args.invoiceNumber ?? null}, invoice_number),
        updated_at = now()
      where external_id = ${args.externalId}
      returning *
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },
};
