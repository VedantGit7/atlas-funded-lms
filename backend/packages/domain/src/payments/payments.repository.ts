import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

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
    args: { status?: string; cursor?: string; limit: number },
  ): Promise<PaymentOrderRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from payment_orders
      where (${args.status ?? null}::text is null or status = ${args.status ?? null})
        and (${args.cursor ?? null}::uuid is null or id < ${args.cursor ?? null}::uuid)
      order by created_at desc, id desc
      limit ${args.limit + 1}
    `;
    return rows.map(mapRow);
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
