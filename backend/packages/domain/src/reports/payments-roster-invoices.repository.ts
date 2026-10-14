import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { PaymentInvoicesQuery } from "./payments-roster.dto";
import { textColumn } from "./raw-column";
import type { PaymentInvoiceRow, PaymentInvoicesFilter } from "./payments-roster.repository";
import { asDate, asIntOrNull, asUuidOrNull } from "./payments-roster.repository-helpers";

function mapInvoice(row: Record<string, unknown>): PaymentInvoiceRow {
  const learnerName = typeof row["learner_name"] === "string" ? row["learner_name"] : null;
  const billingStored =
    typeof row["billing_name_stored"] === "string" ? row["billing_name_stored"] : null;
  const billingName =
    typeof row["billing_name"] === "string" ? row["billing_name"] : (billingStored ?? learnerName);
  const differsRaw = row["billing_name_differs"];
  const billingNameDiffers =
    typeof differsRaw === "boolean"
      ? differsRaw
      : Boolean(
          billingStored &&
          learnerName &&
          billingStored.trim().toLowerCase() !== learnerName.trim().toLowerCase(),
        );
  const metadata =
    row["metadata_json"] && typeof row["metadata_json"] === "object"
      ? (row["metadata_json"] as Record<string, unknown>)
      : null;
  const invoiceVoid =
    metadata && metadata["invoiceVoid"] && typeof metadata["invoiceVoid"] === "object"
      ? (metadata["invoiceVoid"] as Record<string, unknown>)
      : null;
  const voidedAtRaw =
    typeof invoiceVoid?.["voidedAt"] === "string" ? invoiceVoid["voidedAt"] : null;
  const voidedAt = voidedAtRaw ? asDate(voidedAtRaw) : null;
  const voidReason = typeof invoiceVoid?.["reason"] === "string" ? invoiceVoid["reason"] : null;
  return {
    id: textColumn(row["id"]),
    membership_id: asUuidOrNull(row["membership_id"]),
    invoice_number: textColumn(row["invoice_number"]),
    learner_name: learnerName,
    email: typeof row["email"] === "string" ? row["email"] : null,
    billing_name: billingName,
    billing_name_differs: billingNameDiffers,
    product_title: typeof row["product_title"] === "string" ? row["product_title"] : null,
    amount_cents: asIntOrNull(row["amount_cents"]) ?? 0,
    tax_amount_cents: asIntOrNull(row["tax_amount_cents"]),
    coupon_amount_cents: asIntOrNull(row["coupon_amount_cents"]),
    currency: textColumn(row["currency"], "USD"),
    gateway_key: typeof row["gateway_key"] === "string" ? row["gateway_key"] : null,
    order_status: textColumn(row["order_status"] ?? row["status"], "paid"),
    paid_at: asDate(row["paid_at"]),
    created_at: asDate(row["created_at"]) ?? new Date(0),
    voided_at: voidedAt,
    void_reason: voidReason,
    metadata_json: row["metadata_json"] ?? null,
  };
}

/**
 * Invoice numbers and invoices: the list, totals, one invoice and voiding.
 * Part of paymentsRosterRepository.
 */
export const paymentsRosterInvoicesRepository = {
  async allocateInvoiceNumber(tx: TenantTx): Promise<string> {
    const rows = await tx.$queryRaw<Array<{ prefix: string | null; next_number: number | null }>>`
      update learner_billing_config
      set
        invoice_next_number = coalesce(invoice_next_number, 1) + 1,
        updated_at = now()
      where tenant_id = current_setting('app.tenant_id', true)::uuid
      returning
        invoice_prefix as prefix,
        (invoice_next_number - 1) as next_number
    `;
    const row = rows[0];
    if (row?.next_number != null) {
      const prefix =
        (row.prefix?.trim() || "INV").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) || "INV";
      return `${prefix}-${String(row.next_number).padStart(5, "0")}`;
    }
    return `INV-${randomUUID().slice(0, 8).toUpperCase()}`;
  },

  async ensurePaidOrderInvoiceNumber(tx: TenantTx, orderId: string): Promise<string | null> {
    const existing = await tx.$queryRaw<Array<{ invoice_number: string | null; status: string }>>`
      select invoice_number, status
      from payment_orders
      where id = ${orderId}::uuid
      limit 1
    `;
    const order = existing[0];
    if (!order || order.status !== "paid") return null;
    if (order.invoice_number) return order.invoice_number;

    const invoiceNumber = await this.allocateInvoiceNumber(tx);
    await tx.$executeRaw`
      update payment_orders
      set invoice_number = ${invoiceNumber}, updated_at = now()
      where id = ${orderId}::uuid and invoice_number is null
    `;
    return invoiceNumber;
  },

  async backfillMissingInvoiceNumbers(tx: TenantTx): Promise<void> {
    const missing = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text as id
      from payment_orders
      where status = 'paid'
        and (invoice_number is null or invoice_number = '')
      order by coalesce(paid_at, created_at) asc, id asc
      limit 200
    `;
    for (const row of missing) {
      await this.ensurePaidOrderInvoiceNumber(tx, row.id);
    }
  },

  async countInvoices(tx: TenantTx, filter: PaymentInvoicesFilter): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from payment_orders po
      left join memberships m on m.id = po.membership_id and m.tenant_id = po.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where po.tenant_id = current_setting('app.tenant_id', true)::uuid
        and po.status = 'paid'
        and po.invoice_number is not null
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
          ${filter.currency ?? null}::text is null
          or upper(po.currency) = upper(${filter.currency ?? null})
        )
        and (
          ${filter.q ?? null}::text is null
          or lower(coalesce(po.invoice_number, '')) like '%' || lower(${filter.q ?? null}) || '%'
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.q ?? null}) || '%'
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.q ?? null}) || '%'
          or lower(coalesce(po.billing_name, '')) like '%' || lower(${filter.q ?? null}) || '%'
        )
        and (
          ${filter.paidFrom ?? null}::timestamptz is null
          or coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom ?? null}::timestamptz
        )
        and (
          ${filter.paidTo ?? null}::timestamptz is null
          or coalesce(po.paid_at, po.created_at) <= ${filter.paidTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async sumInvoicesByCurrency(
    tx: TenantTx,
    filter: PaymentInvoicesFilter,
  ): Promise<Array<{ currency: string; amount_cents: number }>> {
    const rows = await tx.$queryRaw<Array<{ currency: string; amount_cents: bigint }>>`
      select upper(po.currency) as currency, coalesce(sum(po.amount_cents), 0)::bigint as amount_cents
      from payment_orders po
      left join memberships m on m.id = po.membership_id and m.tenant_id = po.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where po.tenant_id = current_setting('app.tenant_id', true)::uuid
        and po.status = 'paid'
        and po.invoice_number is not null
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
          ${filter.currency ?? null}::text is null
          or upper(po.currency) = upper(${filter.currency ?? null})
        )
        and (
          ${filter.q ?? null}::text is null
          or lower(coalesce(po.invoice_number, '')) like '%' || lower(${filter.q ?? null}) || '%'
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.q ?? null}) || '%'
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.q ?? null}) || '%'
          or lower(coalesce(po.billing_name, '')) like '%' || lower(${filter.q ?? null}) || '%'
        )
        and (
          ${filter.paidFrom ?? null}::timestamptz is null
          or coalesce(po.paid_at, po.created_at) >= ${filter.paidFrom ?? null}::timestamptz
        )
        and (
          ${filter.paidTo ?? null}::timestamptz is null
          or coalesce(po.paid_at, po.created_at) <= ${filter.paidTo ?? null}::timestamptz
        )
      group by upper(po.currency)
      order by currency asc
    `;
    return rows.map((row) => ({
      currency: row.currency,
      amount_cents: Number(row.amount_cents),
    }));
  },

  async listInvoices(tx: TenantTx, query: PaymentInvoicesQuery): Promise<PaymentInvoiceRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        po.id::text as id,
        po.membership_id::text as membership_id,
        po.invoice_number,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        po.billing_name as billing_name_stored,
        coalesce(po.billing_name, mp.display_name, ap.email, m.invited_email_normalized) as billing_name,
        (
          po.billing_name is not null
          and length(trim(po.billing_name)) > 0
          and lower(trim(po.billing_name))
            <> lower(trim(coalesce(mp.display_name, ap.email, m.invited_email_normalized, '')))
        ) as billing_name_differs,
        coalesce(
          po.product_title,
          c.title,
          po.metadata_json->>'productTitle',
          po.metadata_json->>'courseTitle'
        ) as product_title,
        po.amount_cents,
        po.tax_amount_cents,
        coalesce(
          po.coupon_amount_cents,
          case
            when (po.metadata_json->>'discountCents') ~ '^-?[0-9]+$'
            then (po.metadata_json->>'discountCents')::int
            else null
          end
        ) as coupon_amount_cents,
        po.currency,
        coalesce(po.gateway_key, po.metadata_json->>'gatewayKey', po.metadata_json->>'gateway_key') as gateway_key,
        po.status as order_status,
        po.metadata_json,
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
        and po.status = 'paid'
        and po.invoice_number is not null
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
          ${query.currency ?? null}::text is null
          or upper(po.currency) = upper(${query.currency ?? null})
        )
        and (
          ${query.q ?? null}::text is null
          or lower(coalesce(po.invoice_number, '')) like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(po.billing_name, '')) like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${query.paidFrom ?? null}::timestamptz is null
          or coalesce(po.paid_at, po.created_at) >= ${query.paidFrom ?? null}::timestamptz
        )
        and (
          ${query.paidTo ?? null}::timestamptz is null
          or coalesce(po.paid_at, po.created_at) <= ${query.paidTo ?? null}::timestamptz
        )
      order by
        case when ${query.sortBy} = 'invoice_number' and ${query.sortDir} = 'asc' then po.invoice_number end asc,
        case when ${query.sortBy} = 'invoice_number' and ${query.sortDir} = 'desc' then po.invoice_number end desc,
        case when ${query.sortBy} = 'amount_cents' and ${query.sortDir} = 'asc' then po.amount_cents end asc,
        case when ${query.sortBy} = 'amount_cents' and ${query.sortDir} = 'desc' then po.amount_cents end desc,
        case when ${query.sortBy} = 'paid_at' and ${query.sortDir} = 'asc' then coalesce(po.paid_at, po.created_at) end asc,
        case when ${query.sortBy} = 'paid_at' and ${query.sortDir} = 'desc' then coalesce(po.paid_at, po.created_at) end desc,
        po.id desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map(mapInvoice);
  },

  async findInvoiceByOrderId(
    tx: TenantTx,
    orderId: string,
  ): Promise<(PaymentInvoiceRow & { business_name: string | null }) | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        po.id::text as id,
        po.membership_id::text as membership_id,
        po.invoice_number,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        po.billing_name as billing_name_stored,
        coalesce(po.billing_name, mp.display_name, ap.email, m.invited_email_normalized) as billing_name,
        (
          po.billing_name is not null
          and length(trim(po.billing_name)) > 0
          and lower(trim(po.billing_name))
            <> lower(trim(coalesce(mp.display_name, ap.email, m.invited_email_normalized, '')))
        ) as billing_name_differs,
        coalesce(
          po.product_title,
          c.title,
          po.metadata_json->>'productTitle',
          po.metadata_json->>'courseTitle'
        ) as product_title,
        po.amount_cents,
        po.tax_amount_cents,
        coalesce(
          po.coupon_amount_cents,
          case
            when (po.metadata_json->>'discountCents') ~ '^-?[0-9]+$'
            then (po.metadata_json->>'discountCents')::int
            else null
          end
        ) as coupon_amount_cents,
        po.currency,
        coalesce(po.gateway_key, po.metadata_json->>'gatewayKey', po.metadata_json->>'gateway_key') as gateway_key,
        po.status as order_status,
        po.metadata_json,
        po.paid_at,
        po.created_at,
        lbc.invoice_business_name as business_name
      from payment_orders po
      left join memberships m on m.id = po.membership_id and m.tenant_id = po.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join courses c
        on c.tenant_id = po.tenant_id
        and (po.metadata_json->>'courseId') ~ '^[0-9a-fA-F-]{36}$'
        and c.id = (po.metadata_json->>'courseId')::uuid
      left join learner_billing_config lbc on lbc.tenant_id = po.tenant_id
      where po.id = ${orderId}::uuid
        and po.status in ('paid', 'refunded', 'partially_refunded')
        and po.invoice_number is not null
      limit 1
    `;
    const row = rows[0];
    if (!row || typeof row["invoice_number"] !== "string") return null;
    return {
      ...mapInvoice(row),
      business_name: typeof row["business_name"] === "string" ? row["business_name"] : null,
    };
  },

  async voidInvoice(
    tx: TenantTx,
    args: {
      orderId: string;
      reason: string;
      voidedAt: string;
      voidedByMembershipId: string;
    },
  ): Promise<PaymentInvoiceRow | null> {
    const existing = await this.findInvoiceByOrderId(tx, args.orderId);
    if (!existing) return null;
    if (existing.voided_at) return existing;

    const baseMeta =
      existing.metadata_json && typeof existing.metadata_json === "object"
        ? { ...(existing.metadata_json as Record<string, unknown>) }
        : {};
    const nextMeta = {
      ...baseMeta,
      invoiceVoid: {
        voidedAt: args.voidedAt,
        reason: args.reason,
        voidedByMembershipId: args.voidedByMembershipId,
      },
    };

    await tx.$executeRaw`
      update payment_orders
      set
        metadata_json = ${JSON.stringify(nextMeta)}::jsonb,
        updated_at = now()
      where id = ${args.orderId}::uuid
        and tenant_id = current_setting('app.tenant_id', true)::uuid
        and invoice_number is not null
    `;

    const refreshed = await this.findInvoiceByOrderId(tx, args.orderId);
    return refreshed;
  },
};
