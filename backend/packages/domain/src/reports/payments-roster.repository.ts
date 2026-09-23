import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type {
  PaymentInstalmentsQuery,
  PaymentInvoicesQuery,
  PaymentOverviewGrain,
  PaymentTransactionsQuery,
} from "./payments-roster.dto";
import { textColumn } from "./raw-column";

export type PaymentTransactionRow = {
  id: string;
  membership_id: string | null;
  learner_name: string | null;
  email: string | null;
  product_title: string | null;
  product_type: string | null;
  gateway_key: string | null;
  coupon_amount_cents: number | null;
  amount_cents: number;
  tax_amount_cents: number | null;
  currency: string;
  status: string;
  invoice_number: string | null;
  external_id: string | null;
  paid_at: Date | null;
  created_at: Date;
};

export type PaymentGatewaySummaryFilter = {
  paidFrom: string;
  paidTo: string;
};

export type PaymentGatewaySummaryRow = {
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
};

export type PaymentInvoiceRow = {
  id: string;
  membership_id: string | null;
  invoice_number: string;
  learner_name: string | null;
  email: string | null;
  billing_name: string | null;
  billing_name_differs: boolean;
  product_title: string | null;
  amount_cents: number;
  tax_amount_cents: number | null;
  coupon_amount_cents: number | null;
  currency: string;
  gateway_key: string | null;
  order_status: string;
  paid_at: Date | null;
  created_at: Date;
  voided_at: Date | null;
  void_reason: string | null;
  metadata_json: unknown;
};

export type PaymentInstalmentPlanRow = {
  id: string;
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  product_title: string;
  product_type: string;
  pricing_plan_label: string | null;
  total_amount_cents: number;
  remaining_amount_cents: number;
  currency: string;
  status: string;
  created_at: Date;
  next_due_at: Date | null;
  instalment_count: number;
  paid_count: number;
  overdue_count: number;
  metadata_json: Record<string, unknown> | null;
};

export type PaymentInstalmentScheduleRow = {
  id: string;
  sequence_no: number;
  amount_cents: number;
  due_at: Date;
  paid_at: Date | null;
  status: string;
  payment_order_id: string | null;
};

export type PaymentTransactionsFilter = {
  paidFrom?: string;
  paidTo?: string;
  learnerName?: string;
  productType?: string;
  gatewayKey?: string;
  status?: string;
  amountMinCents?: number;
  dateField?: "paid_at" | "created_at";
};

export type PaymentRefundsFilter = {
  queue: "refundable" | "partial" | "refunded" | "all";
  paidFrom?: string;
  paidTo?: string;
  q?: string;
  gatewayKey?: string;
};

export type PaymentRefundLedgerRow = {
  id: string;
  membership_id: string | null;
  learner_name: string | null;
  email: string | null;
  product_title: string | null;
  gateway_key: string | null;
  amount_cents: number;
  refunded_amount_cents: number;
  reserved_amount_cents: number;
  refundable_amount_cents: number;
  currency: string;
  status: string;
  invoice_number: string | null;
  paid_at: Date | null;
  created_at: Date;
  metadata_json: unknown;
};

export type PaymentInvoicesFilter = {
  paidFrom?: string;
  paidTo?: string;
  learnerName?: string;
  email?: string;
  q?: string;
  currency?: string;
};

export type PaymentInstalmentsFilter = {
  learnerName?: string;
  email?: string;
  status?: string;
  q?: string;
  productTitle?: string;
  pricingPlanLabel?: string;
  nextDue?: "overdue" | "7days" | "30days";
};

export type PaymentOverviewFilter = {
  paidFrom: string;
  paidTo: string;
  currency?: string;
};

export type PaymentTransactionDetailRow = {
  id: string;
  membership_id: string | null;
  learner_name: string | null;
  email: string | null;
  product_title: string | null;
  product_type: string | null;
  gateway_key: string | null;
  coupon_amount_cents: number | null;
  amount_cents: number;
  tax_amount_cents: number | null;
  currency: string;
  status: string;
  invoice_number: string | null;
  external_id: string | null;
  billing_name: string | null;
  metadata_json: unknown;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function asUuidOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^[0-9a-fA-F-]{36}$/.test(trimmed)) return null;
  return trimmed;
}

function asIntOrNull(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.trunc(num);
}

function asJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

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

function mapPlan(row: Record<string, unknown>): PaymentInstalmentPlanRow {
  return {
    id: textColumn(row["id"]),
    membership_id: textColumn(row["membership_id"]),
    learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    product_title: textColumn(row["product_title"]),
    product_type: textColumn(row["product_type"], "course"),
    pricing_plan_label:
      typeof row["pricing_plan_label"] === "string" ? row["pricing_plan_label"] : null,
    total_amount_cents: Number(row["total_amount_cents"]),
    remaining_amount_cents: Number(row["remaining_amount_cents"]),
    currency: textColumn(row["currency"]),
    status: textColumn(row["status"]),
    created_at: asDate(row["created_at"]) ?? new Date(0),
    next_due_at: asDate(row["next_due_at"]),
    instalment_count: asIntOrNull(row["instalment_count"]) ?? 0,
    paid_count: asIntOrNull(row["paid_count"]) ?? 0,
    overdue_count: asIntOrNull(row["overdue_count"]) ?? 0,
    metadata_json: asJsonObject(row["metadata_json"]),
  };
}

export const paymentsRosterRepository = {
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

  async countInstalmentPlans(tx: TenantTx, filter: PaymentInstalmentsFilter): Promise<number> {
    const status = filter.status ?? null;
    const nextDue = filter.nextDue ?? null;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from payment_instalment_plans p
      join memberships m on m.id = p.membership_id and m.tenant_id = p.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where p.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ${status}::text is null
          or (
            ${status} = 'overdue'
            and (
              p.status = 'overdue'
              or exists (
                select 1 from payment_instalments pi
                where pi.plan_id = p.id and pi.tenant_id = p.tenant_id
                  and (
                    pi.status = 'overdue'
                    or (pi.status = 'scheduled' and pi.due_at < now())
                  )
              )
            )
          )
          or (
            ${status} <> 'overdue'
            and p.status = ${status}
          )
        )
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
          or lower(p.product_title) like '%' || lower(${filter.q ?? null}) || '%'
          or lower(coalesce(p.pricing_plan_label, '')) like '%' || lower(${filter.q ?? null}) || '%'
        )
        and (
          ${filter.productTitle ?? null}::text is null
          or lower(p.product_title) like '%' || lower(${filter.productTitle ?? null}) || '%'
        )
        and (
          ${filter.pricingPlanLabel ?? null}::text is null
          or lower(coalesce(p.pricing_plan_label, ''))
            like '%' || lower(${filter.pricingPlanLabel ?? null}) || '%'
        )
        and (
          ${nextDue}::text is null
          or (
            ${nextDue} = 'overdue'
            and exists (
              select 1 from payment_instalments pi
              where pi.plan_id = p.id and pi.tenant_id = p.tenant_id
                and (
                  pi.status = 'overdue'
                  or (pi.status = 'scheduled' and pi.due_at < now())
                )
            )
          )
          or (
            ${nextDue} = '7days'
            and exists (
              select 1 from payment_instalments pi
              where pi.plan_id = p.id and pi.tenant_id = p.tenant_id
                and pi.status in ('scheduled', 'overdue')
                and pi.due_at >= now()
                and pi.due_at < now() + interval '7 days'
            )
          )
          or (
            ${nextDue} = '30days'
            and exists (
              select 1 from payment_instalments pi
              where pi.plan_id = p.id and pi.tenant_id = p.tenant_id
                and pi.status in ('scheduled', 'overdue')
                and pi.due_at >= now()
                and pi.due_at < now() + interval '30 days'
            )
          )
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listInstalmentPlans(
    tx: TenantTx,
    query: PaymentInstalmentsQuery,
  ): Promise<PaymentInstalmentPlanRow[]> {
    const skip = (query.page - 1) * query.limit;
    const status = query.status ?? null;
    const nextDue = query.nextDue ?? null;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        p.id::text as id,
        p.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        p.product_title,
        p.product_type,
        p.pricing_plan_label,
        p.total_amount_cents,
        p.remaining_amount_cents,
        p.currency,
        p.status,
        p.metadata_json,
        p.created_at,
        stats.next_due_at,
        coalesce(stats.instalment_count, 0)::int as instalment_count,
        coalesce(stats.paid_count, 0)::int as paid_count,
        coalesce(stats.overdue_count, 0)::int as overdue_count
      from payment_instalment_plans p
      join memberships m on m.id = p.membership_id and m.tenant_id = p.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join lateral (
        select
          min(pi.due_at) filter (
            where pi.status in ('scheduled', 'overdue')
          ) as next_due_at,
          count(*)::int as instalment_count,
          count(*) filter (where pi.status = 'paid')::int as paid_count,
          count(*) filter (
            where pi.status = 'overdue'
              or (pi.status = 'scheduled' and pi.due_at < now())
          )::int as overdue_count
        from payment_instalments pi
        where pi.plan_id = p.id and pi.tenant_id = p.tenant_id
      ) stats on true
      where p.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ${status}::text is null
          or (
            ${status} = 'overdue'
            and (
              p.status = 'overdue'
              or coalesce(stats.overdue_count, 0) > 0
            )
          )
          or (
            ${status} <> 'overdue'
            and p.status = ${status}
          )
        )
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
          or lower(p.product_title) like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(p.pricing_plan_label, '')) like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${query.productTitle ?? null}::text is null
          or lower(p.product_title) like '%' || lower(${query.productTitle ?? null}) || '%'
        )
        and (
          ${query.pricingPlanLabel ?? null}::text is null
          or lower(coalesce(p.pricing_plan_label, ''))
            like '%' || lower(${query.pricingPlanLabel ?? null}) || '%'
        )
        and (
          ${nextDue}::text is null
          or (
            ${nextDue} = 'overdue'
            and coalesce(stats.overdue_count, 0) > 0
          )
          or (
            ${nextDue} = '7days'
            and stats.next_due_at is not null
            and stats.next_due_at >= now()
            and stats.next_due_at < now() + interval '7 days'
          )
          or (
            ${nextDue} = '30days'
            and stats.next_due_at is not null
            and stats.next_due_at >= now()
            and stats.next_due_at < now() + interval '30 days'
          )
        )
      order by
        case when ${query.sortBy} = 'remaining_amount_cents' and ${query.sortDir} = 'asc'
          then p.remaining_amount_cents end asc,
        case when ${query.sortBy} = 'remaining_amount_cents' and ${query.sortDir} = 'desc'
          then p.remaining_amount_cents end desc,
        case when ${query.sortBy} = 'total_amount_cents' and ${query.sortDir} = 'asc'
          then p.total_amount_cents end asc,
        case when ${query.sortBy} = 'total_amount_cents' and ${query.sortDir} = 'desc'
          then p.total_amount_cents end desc,
        case when ${query.sortBy} = 'next_due_at' and ${query.sortDir} = 'asc'
          then stats.next_due_at end asc nulls last,
        case when ${query.sortBy} = 'next_due_at' and ${query.sortDir} = 'desc'
          then stats.next_due_at end desc nulls last,
        case when ${query.sortBy} = 'created_at' and ${query.sortDir} = 'asc' then p.created_at end asc,
        case when ${query.sortBy} = 'created_at' and ${query.sortDir} = 'desc' then p.created_at end desc,
        p.id desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map(mapPlan);
  },

  async getInstalmentLedgerSummary(tx: TenantTx): Promise<{
    currency: string;
    outstanding_cents: number;
    outstanding_plan_count: number;
    due_next_7_days_cents: number;
    overdue_cents: number;
    overdue_instalment_count: number;
    completed_this_month_count: number;
  }> {
    const [outstanding, dueSoon, overdue, completed, currencyRow] = await Promise.all([
      tx.$queryRaw<Array<{ remaining_cents: bigint; plan_count: bigint }>>`
        select
          coalesce(sum(p.remaining_amount_cents), 0)::bigint as remaining_cents,
          count(*)::bigint as plan_count
        from payment_instalment_plans p
        where p.tenant_id = current_setting('app.tenant_id', true)::uuid
          and p.status in ('active', 'overdue')
          and p.remaining_amount_cents > 0
      `,
      tx.$queryRaw<Array<{ amount_cents: bigint }>>`
        select coalesce(sum(pi.amount_cents), 0)::bigint as amount_cents
        from payment_instalments pi
        join payment_instalment_plans p on p.id = pi.plan_id and p.tenant_id = pi.tenant_id
        where pi.tenant_id = current_setting('app.tenant_id', true)::uuid
          and pi.status in ('scheduled', 'overdue')
          and pi.due_at >= now()
          and pi.due_at < now() + interval '7 days'
      `,
      tx.$queryRaw<Array<{ amount_cents: bigint; instalment_count: bigint }>>`
        select
          coalesce(sum(pi.amount_cents), 0)::bigint as amount_cents,
          count(*)::bigint as instalment_count
        from payment_instalments pi
        join payment_instalment_plans p on p.id = pi.plan_id and p.tenant_id = pi.tenant_id
        where pi.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            pi.status = 'overdue'
            or (pi.status = 'scheduled' and pi.due_at < now())
          )
      `,
      tx.$queryRaw<Array<{ plan_count: bigint }>>`
        select count(*)::bigint as plan_count
        from payment_instalment_plans p
        where p.tenant_id = current_setting('app.tenant_id', true)::uuid
          and p.status = 'completed'
          and p.updated_at >= date_trunc('month', now())
      `,
      tx.$queryRaw<Array<{ currency: string | null }>>`
        select p.currency
        from payment_instalment_plans p
        where p.tenant_id = current_setting('app.tenant_id', true)::uuid
          and p.status in ('active', 'overdue')
          and p.remaining_amount_cents > 0
        order by p.updated_at desc
        limit 1
      `,
    ]);

    return {
      currency: currencyRow[0]?.currency ?? "USD",
      outstanding_cents: Number(outstanding[0]?.remaining_cents ?? 0),
      outstanding_plan_count: Number(outstanding[0]?.plan_count ?? 0),
      due_next_7_days_cents: Number(dueSoon[0]?.amount_cents ?? 0),
      overdue_cents: Number(overdue[0]?.amount_cents ?? 0),
      overdue_instalment_count: Number(overdue[0]?.instalment_count ?? 0),
      completed_this_month_count: Number(completed[0]?.plan_count ?? 0),
    };
  },

  async findInstalmentPlan(tx: TenantTx, planId: string): Promise<PaymentInstalmentPlanRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        p.id::text as id,
        p.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        p.product_title,
        p.product_type,
        p.pricing_plan_label,
        p.total_amount_cents,
        p.remaining_amount_cents,
        p.currency,
        p.status,
        p.metadata_json,
        p.created_at,
        stats.next_due_at,
        coalesce(stats.instalment_count, 0)::int as instalment_count,
        coalesce(stats.paid_count, 0)::int as paid_count,
        coalesce(stats.overdue_count, 0)::int as overdue_count
      from payment_instalment_plans p
      join memberships m on m.id = p.membership_id and m.tenant_id = p.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join lateral (
        select
          min(pi.due_at) filter (
            where pi.status in ('scheduled', 'overdue')
          ) as next_due_at,
          count(*)::int as instalment_count,
          count(*) filter (where pi.status = 'paid')::int as paid_count,
          count(*) filter (
            where pi.status = 'overdue'
              or (pi.status = 'scheduled' and pi.due_at < now())
          )::int as overdue_count
        from payment_instalments pi
        where pi.plan_id = p.id and pi.tenant_id = p.tenant_id
      ) stats on true
      where p.id = ${planId}::uuid
      limit 1
    `;
    return rows[0] ? mapPlan(rows[0]) : null;
  },

  async listInstalmentSchedule(
    tx: TenantTx,
    planId: string,
  ): Promise<PaymentInstalmentScheduleRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        id::text as id,
        sequence_no,
        amount_cents,
        due_at,
        paid_at,
        status,
        payment_order_id::text as payment_order_id
      from payment_instalments
      where plan_id = ${planId}::uuid
      order by sequence_no asc
    `;
    return rows.map((row) => ({
      id: textColumn(row["id"]),
      sequence_no: Number(row["sequence_no"]),
      amount_cents: Number(row["amount_cents"]),
      due_at: row["due_at"] as Date,
      paid_at: row["paid_at"] instanceof Date ? row["paid_at"] : null,
      status: textColumn(row["status"]),
      payment_order_id:
        typeof row["payment_order_id"] === "string" ? row["payment_order_id"] : null,
    }));
  },

  async insertInstalmentPlan(
    tx: TenantTx,
    args: {
      membershipId: string;
      productTitle: string;
      productType: string;
      pricingPlanLabel?: string | null;
      totalAmountCents: number;
      currency: string;
      instalments: Array<{ amountCents: number; dueAt: string }>;
      metadataJson?: Record<string, unknown> | null;
    },
  ): Promise<PaymentInstalmentPlanRow> {
    const planId = randomUUID();
    await tx.$executeRaw`
      insert into payment_instalment_plans (
        id, tenant_id, membership_id, product_title, product_type, pricing_plan_label,
        total_amount_cents, currency, remaining_amount_cents, status, metadata_json,
        created_at, updated_at
      ) values (
        ${planId}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.membershipId}::uuid,
        ${args.productTitle},
        ${args.productType},
        ${args.pricingPlanLabel ?? null},
        ${args.totalAmountCents},
        ${args.currency},
        ${args.totalAmountCents},
        'active',
        ${args.metadataJson ? JSON.stringify(args.metadataJson) : null}::jsonb,
        now(),
        now()
      )
    `;

    let sequence = 1;
    for (const instalment of args.instalments) {
      await tx.$executeRaw`
        insert into payment_instalments (
          id, tenant_id, plan_id, sequence_no, amount_cents, due_at, status, created_at, updated_at
        ) values (
          ${randomUUID()}::uuid,
          current_setting('app.tenant_id', true)::uuid,
          ${planId}::uuid,
          ${sequence},
          ${instalment.amountCents},
          ${instalment.dueAt}::timestamptz,
          'scheduled',
          now(),
          now()
        )
      `;
      sequence += 1;
    }

    const plan = await this.findInstalmentPlan(tx, planId);
    if (!plan) throw new Error("INSTALMENT_PLAN_INSERT_FAILED");
    return plan;
  },

  async findNextPayableInstalment(
    tx: TenantTx,
    planId: string,
    instalmentId?: string,
  ): Promise<PaymentInstalmentScheduleRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        id::text as id,
        sequence_no,
        amount_cents,
        due_at,
        paid_at,
        status,
        payment_order_id::text as payment_order_id
      from payment_instalments
      where plan_id = ${planId}::uuid
        and status in ('scheduled', 'overdue')
        and (${instalmentId ?? null}::uuid is null or id = ${instalmentId ?? null}::uuid)
      order by sequence_no asc
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: textColumn(row["id"]),
      sequence_no: Number(row["sequence_no"]),
      amount_cents: Number(row["amount_cents"]),
      due_at: row["due_at"] as Date,
      paid_at: row["paid_at"] instanceof Date ? row["paid_at"] : null,
      status: textColumn(row["status"]),
      payment_order_id:
        typeof row["payment_order_id"] === "string" ? row["payment_order_id"] : null,
    };
  },

  async markInstalmentPaid(
    tx: TenantTx,
    args: {
      planId: string;
      instalmentId: string;
      paymentOrderId: string;
      amountCents: number;
      paidAt?: Date;
    },
  ): Promise<{ remaining_amount_cents: number; status: string }> {
    const paidAt = args.paidAt ?? new Date();
    await tx.$executeRaw`
      update payment_instalments
      set
        status = 'paid',
        paid_at = ${paidAt}::timestamptz,
        payment_order_id = ${args.paymentOrderId}::uuid,
        updated_at = now()
      where id = ${args.instalmentId}::uuid
        and plan_id = ${args.planId}::uuid
    `;

    const rows = await tx.$queryRaw<Array<{ remaining_amount_cents: number; status: string }>>`
      update payment_instalment_plans
      set
        remaining_amount_cents = greatest(remaining_amount_cents - ${args.amountCents}, 0),
        status = case
          when greatest(remaining_amount_cents - ${args.amountCents}, 0) = 0 then 'completed'
          when status = 'overdue' then 'active'
          else status
        end,
        updated_at = now()
      where id = ${args.planId}::uuid
      returning remaining_amount_cents, status
    `;
    const updated = rows[0];
    if (!updated) throw new Error("INSTALMENT_PLAN_UPDATE_FAILED");
    return updated;
  },

  async cancelInstalmentPlan(
    tx: TenantTx,
    args: {
      planId: string;
      reason: string;
      accessOption: "keep" | "revoke";
      cancelledAt: string;
      cancelledByMembershipId: string | null;
    },
  ): Promise<{
    status: string;
    voided_instalment_count: number;
    metadata_json: Record<string, unknown> | null;
  } | null> {
    const existing = await this.findInstalmentPlan(tx, args.planId);
    if (!existing) return null;

    const nextMeta = {
      ...(existing.metadata_json ?? {}),
      planCancel: {
        cancelledAt: args.cancelledAt,
        reason: args.reason,
        accessOption: args.accessOption,
        cancelledByMembershipId: args.cancelledByMembershipId,
        accessNote:
          args.accessOption === "revoke"
            ? "Revoke requested — course access is not automated yet; follow up in memberships if needed."
            : "Course access left unchanged.",
      },
    };

    const voided = await tx.$queryRaw<Array<{ count: bigint }>>`
      with voided as (
        update payment_instalments
        set
          status = 'cancelled',
          updated_at = now()
        where plan_id = ${args.planId}::uuid
          and status in ('scheduled', 'overdue')
        returning id
      )
      select count(*)::bigint as count from voided
    `;

    const rows = await tx.$queryRaw<Array<{ status: string; metadata_json: unknown }>>`
      update payment_instalment_plans
      set
        status = 'cancelled',
        metadata_json = ${JSON.stringify(nextMeta)}::jsonb,
        updated_at = now()
      where id = ${args.planId}::uuid
        and status in ('active', 'overdue')
      returning status, metadata_json
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      status: row.status,
      voided_instalment_count: Number(voided[0]?.count ?? 0),
      metadata_json: asJsonObject(row.metadata_json),
    };
  },

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
