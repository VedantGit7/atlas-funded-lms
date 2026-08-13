import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import { paymentsRepository } from "../payments/payments.repository";
import { resolvePaymentProvider } from "../payments/payment-provider.registry";
import {
  createPaymentInstalmentPlanBodySchema,
  createPaymentInstalmentPlanResponseSchema,
  cancelPaymentInstalmentPlanBodySchema,
  cancelPaymentInstalmentPlanResponseSchema,
  payPaymentInstalmentBodySchema,
  payPaymentInstalmentResponseSchema,
  paymentGatewaysListResponseSchema,
  paymentGatewayDetailResponseSchema,
  paymentRefundsListResponseSchema,
  paymentInstalmentPlanDetailResponseSchema,
  paymentInstalmentsListResponseSchema,
  paymentInvoiceDetailResponseSchema,
  paymentInvoicesListResponseSchema,
  paymentOverviewResponseSchema,
  paymentTransactionDetailResponseSchema,
  paymentTransactionsListResponseSchema,
  refundPaymentTransactionBodySchema,
  refundPaymentTransactionResponseSchema,
  voidPaymentInvoiceResponseSchema,
  type PaymentGatewaysQuery,
  type PaymentGatewayDetailQuery,
  type PaymentRefundsQuery,
  type PaymentInstalmentsQuery,
  type PaymentInvoicesQuery,
  type PaymentInvoiceVoidReason,
  type PaymentOverviewQuery,
  type PaymentTransactionsQuery,
} from "./payments-roster.dto";
import {
  paymentGatewayNotFound,
  paymentInstalmentNotPayable,
  paymentInstalmentPlanNotCancellable,
  paymentInstalmentPlanNotFound,
  paymentInvoiceAlreadyVoided,
  paymentInvoiceNotFound,
  paymentInvoiceNotVoidable,
  paymentTransactionNotFound,
  paymentTransactionNotRefundable,
} from "./payments-roster.errors";
import {
  paymentsRosterRepository,
  type PaymentInstalmentPlanRow,
  type PaymentInstalmentsFilter,
  type PaymentInvoicesFilter,
  type PaymentOverviewFilter,
  type PaymentTransactionDetailRow,
  type PaymentTransactionRow,
  type PaymentTransactionsFilter,
} from "./payments-roster.repository";

function toTransactionsFilter(input: Partial<PaymentTransactionsQuery>): PaymentTransactionsFilter {
  const filter: PaymentTransactionsFilter = {};
  if (input.paidFrom) filter.paidFrom = input.paidFrom;
  if (input.paidTo) filter.paidTo = input.paidTo;
  if (input.learnerName) filter.learnerName = input.learnerName;
  if (input.productType) filter.productType = input.productType;
  if (input.gatewayKey) filter.gatewayKey = input.gatewayKey;
  if (input.status) filter.status = input.status;
  if (input.amountMinCents != null) filter.amountMinCents = input.amountMinCents;
  if (input.dateField) filter.dateField = input.dateField;
  return filter;
}

function toInvoicesFilter(input: Partial<PaymentInvoicesQuery>): PaymentInvoicesFilter {
  const filter: PaymentInvoicesFilter = {};
  if (input.paidFrom) filter.paidFrom = input.paidFrom;
  if (input.paidTo) filter.paidTo = input.paidTo;
  if (input.learnerName) filter.learnerName = input.learnerName;
  if (input.email) filter.email = input.email;
  if (input.q) filter.q = input.q;
  if (input.currency) filter.currency = input.currency;
  return filter;
}

function toInstalmentsFilter(input: Partial<PaymentInstalmentsQuery>): PaymentInstalmentsFilter {
  const filter: PaymentInstalmentsFilter = {};
  if (input.learnerName) filter.learnerName = input.learnerName;
  if (input.email) filter.email = input.email;
  if (input.status) filter.status = input.status;
  if (input.q) filter.q = input.q;
  if (input.productTitle) filter.productTitle = input.productTitle;
  if (input.pricingPlanLabel) filter.pricingPlanLabel = input.pricingPlanLabel;
  if (input.nextDue) filter.nextDue = input.nextDue;
  return filter;
}

function mapTransactionItem(row: PaymentTransactionRow) {
  return {
    id: row.id,
    membershipId: row.membership_id,
    learnerName: row.learner_name,
    email: row.email,
    productTitle: row.product_title,
    productType: row.product_type,
    gatewayKey: row.gateway_key,
    couponAmountCents: row.coupon_amount_cents,
    amountCents: row.amount_cents,
    taxAmountCents: row.tax_amount_cents,
    currency: row.currency,
    status: row.status,
    invoiceNumber: row.invoice_number,
    externalId: row.external_id,
    paidAt: row.paid_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

function mapPlanItem(row: PaymentInstalmentPlanRow) {
  return {
    id: row.id,
    membershipId: row.membership_id,
    learnerName: row.learner_name,
    email: row.email,
    productTitle: row.product_title,
    productType: row.product_type,
    pricingPlanLabel: row.pricing_plan_label,
    totalAmountCents: row.total_amount_cents,
    remainingAmountCents: row.remaining_amount_cents,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    nextDueAt: row.next_due_at?.toISOString() ?? null,
    instalmentCount: row.instalment_count,
    paidCount: row.paid_count,
    overdueCount: row.overdue_count,
  };
}

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

function buildInvoiceHtml(args: {
  invoiceNumber: string;
  businessName: string | null;
  learnerName: string | null;
  email: string | null;
  billingName: string | null;
  productTitle: string | null;
  amountCents: number;
  taxAmountCents: number | null;
  discountCents: number;
  currency: string;
  paidAt: string | null;
  voided: boolean;
}): string {
  const tax = args.taxAmountCents ?? 0;
  const discount = Math.max(0, args.discountCents);
  const subtotal = Math.max(args.amountCents - tax + discount, 0);
  const stamp = args.voided
    ? `<div style="position:absolute;top:80px;right:60px;border:4px solid #93000a;color:#93000a;padding:8px 16px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;transform:rotate(12deg);opacity:0.85;font-size:22px;">VOID</div>`
    : `<div style="position:absolute;top:80px;right:60px;border:4px solid #008000;color:#008000;padding:8px 16px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;transform:rotate(12deg);opacity:0.8;font-size:22px;">PAID IN FULL</div>`;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${args.invoiceNumber}</title>
  <style>
    body { font-family: Georgia, serif; color: #0a0a0a; margin: 0; background: #fffdf8; }
    .paper { position: relative; max-width: 800px; margin: 0 auto; padding: 48px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    .muted { color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { text-align: left; padding: 10px 0; border-bottom: 1px solid #e5e5e5; }
    .right { text-align: right; font-variant-numeric: tabular-nums; }
    .totals { width: 280px; margin-left: auto; margin-top: 24px; }
    .totals div { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e5e5; }
    .totals .grand { font-weight: 700; font-size: 18px; }
  </style>
</head>
<body>
  <div class="paper">
    ${stamp}
    <h1>${args.businessName ?? "Invoice"}</h1>
    <p class="muted">Tax Invoice · ${args.invoiceNumber}</p>
    <p>
      Bill to: ${args.billingName ?? args.learnerName ?? "Learner"}<br/>
      ${args.email ? `Email: ${args.email}<br/>` : ""}
      Issued: ${args.paidAt ? new Date(args.paidAt).toLocaleString() : "—"}
    </p>
    <table>
      <thead>
        <tr>
          <th>Product / Description</th>
          <th class="right">Qty</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${args.productTitle ?? "Purchase"}</td>
          <td class="right">1</td>
          <td class="right">${formatMoney(subtotal, args.currency)}</td>
        </tr>
      </tbody>
    </table>
    <div class="totals">
      <div><span class="muted">Subtotal</span><span>${formatMoney(subtotal, args.currency)}</span></div>
      <div><span class="muted">Discount</span><span>${formatMoney(discount, args.currency)}</span></div>
      <div><span class="muted">Tax</span><span>${formatMoney(tax, args.currency)}</span></div>
      <div class="grand"><span>Total</span><span>${formatMoney(args.amountCents, args.currency)}</span></div>
      ${
        args.voided
          ? ""
          : `<div style="color:#008000"><span>Amount Paid</span><span>-${formatMoney(args.amountCents, args.currency)}</span></div>
      <div class="grand"><span>Balance Due</span><span>${formatMoney(0, args.currency)}</span></div>`
      }
    </div>
  </div>
</body>
</html>`;
}

export async function listPaymentTransactions(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: PaymentTransactionsQuery,
) {
  const filter = toTransactionsFilter(query);
  const [totalCount, rows, filteredAmountCents] = await Promise.all([
    paymentsRosterRepository.countTransactions(tx, filter),
    paymentsRosterRepository.listTransactions(tx, query),
    paymentsRosterRepository.sumTransactionAmounts(tx, filter),
  ]);
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / query.limit);
  const pageAmountCents = Math.max(
    0,
    rows.reduce((sum, row) => sum + (Number.isFinite(row.amount_cents) ? row.amount_cents : 0), 0),
  );
  const currency = rows[0]?.currency ?? "USD";

  return paymentTransactionsListResponseSchema.parse({
    data: {
      items: rows.map(mapTransactionItem),
      pageInfo: {
        page: query.page,
        pageSize: query.limit,
        totalCount,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
      columns: query.columns,
      totals: {
        pageAmountCents,
        filteredAmountCents: Math.max(0, filteredAmountCents),
        currency,
      },
    },
  });
}

function resolvePaymentGatewaysWindow(query: PaymentGatewaysQuery): {
  windowFrom: Date;
  windowTo: Date;
  windowLabel: string;
} {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const windowFrom = query.paidFrom ? new Date(query.paidFrom) : defaultFrom;
  const windowTo = query.paidTo ? new Date(query.paidTo) : now;
  const days = Math.max(
    1,
    Math.round((windowTo.getTime() - windowFrom.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  const windowLabel =
    query.paidFrom || query.paidTo
      ? days <= 40
        ? `${String(days)} days`
        : "Selected range"
      : "30 days";
  return { windowFrom, windowTo, windowLabel };
}

export async function listPaymentReportGateways(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: PaymentGatewaysQuery = {},
) {
  const { windowFrom, windowTo, windowLabel } = resolvePaymentGatewaysWindow(query);
  const rows = await paymentsRosterRepository.listGateways(tx, {
    paidFrom: windowFrom.toISOString(),
    paidTo: windowTo.toISOString(),
  });
  const totalPaidCents = rows.reduce((sum, row) => sum + row.paid_amount_cents, 0);
  const currency =
    rows.find((row) => row.currency)?.currency?.toUpperCase() ??
    rows[0]?.currency?.toUpperCase() ??
    "USD";

  return paymentGatewaysListResponseSchema.parse({
    data: {
      summary: {
        totalPaidCents,
        currency,
        windowFrom: windowFrom.toISOString(),
        windowTo: windowTo.toISOString(),
        windowLabel,
      },
      items: rows.map((row) => {
        const decided = row.paid_transaction_count + row.failed_count;
        const successPercent =
          decided === 0 ? null : Math.round((row.paid_transaction_count / decided) * 1000) / 10;
        const volumeSharePercent =
          totalPaidCents === 0
            ? 0
            : Math.round((row.paid_amount_cents / totalPaidCents) * 1000) / 10;
        return {
          id: row.id,
          gatewayKey: row.gateway_key,
          displayName: row.display_name,
          isConfigured: row.is_configured,
          isPublished: row.is_published,
          isDefault: row.is_default,
          transactionCount: row.transaction_count,
          paidTransactionCount: row.paid_transaction_count,
          failedCount: row.failed_count,
          paidAmountCents: row.paid_amount_cents,
          successPercent,
          volumeSharePercent,
          currency: (row.currency ?? currency).toUpperCase(),
        };
      }),
    },
  });
}

function maskPublishableKey(key: string | null): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 7)}••••••••${trimmed.slice(-3)}`;
}

export async function getPaymentGatewayDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  gatewayKey: string,
  query: PaymentGatewayDetailQuery = {},
) {
  const gateway = await paymentsRosterRepository.findGatewayByKey(tx, gatewayKey);
  if (!gateway) throw paymentGatewayNotFound();

  const { windowFrom, windowTo, windowLabel } = resolvePaymentGatewaysWindow(query);
  const previous = previousPaymentWindow(windowFrom, windowTo);
  const [stats, previousStats] = await Promise.all([
    paymentsRosterRepository.getGatewayWindowStats(tx, gatewayKey, {
      paidFrom: windowFrom.toISOString(),
      paidTo: windowTo.toISOString(),
    }),
    paymentsRosterRepository.getGatewayWindowStats(tx, gatewayKey, {
      paidFrom: previous.from.toISOString(),
      paidTo: previous.to.toISOString(),
    }),
  ]);

  const decided = stats.paid_transaction_count + stats.failed_count;
  const successPercent =
    decided === 0 ? null : Math.round((stats.paid_transaction_count / decided) * 1000) / 10;
  const changePercent =
    previousStats.paid_amount_cents === 0
      ? stats.paid_amount_cents > 0
        ? 100
        : null
      : Math.round(
          ((stats.paid_amount_cents - previousStats.paid_amount_cents) /
            previousStats.paid_amount_cents) *
            1000,
        ) / 10;

  return paymentGatewayDetailResponseSchema.parse({
    data: {
      gateway: {
        id: gateway.id,
        gatewayKey: gateway.gateway_key,
        displayName: gateway.display_name,
        isConfigured: gateway.is_configured,
        isPublished: gateway.is_published,
        isDefault: gateway.is_default,
        publishableKeyMasked: maskPublishableKey(gateway.publishable_key),
        secretLast4: gateway.secret_last4,
        hasSecret: Boolean(gateway.secret_last4),
        createdAt: gateway.created_at.toISOString(),
        updatedAt: gateway.updated_at.toISOString(),
      },
      summary: {
        paidAmountCents: stats.paid_amount_cents,
        previousPaidAmountCents: previousStats.paid_amount_cents,
        changePercent,
        transactionCount: stats.transaction_count,
        paidTransactionCount: stats.paid_transaction_count,
        failedCount: stats.failed_count,
        refundedCount: stats.refunded_count,
        successPercent,
        currency: (stats.currency ?? "USD").toUpperCase(),
        windowFrom: windowFrom.toISOString(),
        windowTo: windowTo.toISOString(),
        windowLabel,
      },
      capabilities: {
        feesTracked: false,
        payoutsAvailable: false,
        webhookLogAvailable: false,
      },
    },
  });
}

export async function listPaymentGatewayTransactions(
  tx: TenantTx,
  ctx: ServiceCtx,
  gatewayKey: string,
  query: PaymentTransactionsQuery,
) {
  const gateway = await paymentsRosterRepository.findGatewayByKey(tx, gatewayKey);
  if (!gateway) throw paymentGatewayNotFound();
  return listPaymentTransactions(tx, ctx, { ...query, gatewayKey });
}

export async function listPaymentInvoices(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: PaymentInvoicesQuery,
) {
  await paymentsRosterRepository.backfillMissingInvoiceNumbers(tx);
  const filter = toInvoicesFilter(query);
  const [totalCount, rows, filteredByCurrency] = await Promise.all([
    paymentsRosterRepository.countInvoices(tx, filter),
    paymentsRosterRepository.listInvoices(tx, query),
    paymentsRosterRepository.sumInvoicesByCurrency(tx, filter),
  ]);
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / query.limit);
  const pageTotals = new Map<string, number>();
  for (const row of rows) {
    const key = row.currency.toUpperCase();
    pageTotals.set(key, (pageTotals.get(key) ?? 0) + row.amount_cents);
  }

  return paymentInvoicesListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        id: row.id,
        membershipId: row.membership_id,
        invoiceNumber: row.invoice_number,
        learnerName: row.learner_name,
        email: row.email,
        billingName: row.billing_name,
        billingNameDiffers: row.billing_name_differs,
        productTitle: row.product_title,
        amountCents: row.amount_cents,
        taxAmountCents: row.tax_amount_cents,
        currency: row.currency,
        paidAt: row.paid_at?.toISOString() ?? null,
        createdAt: row.created_at.toISOString(),
        status: row.voided_at ? ("void" as const) : ("issued" as const),
        voidedAt: row.voided_at?.toISOString() ?? null,
      })),
      pageInfo: {
        page: query.page,
        pageSize: query.limit,
        totalCount,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
      columns: query.columns,
      totals: {
        pageByCurrency: [...pageTotals.entries()].map(([currency, amountCents]) => ({
          currency,
          amountCents: Math.max(0, amountCents),
        })),
        filteredByCurrency: filteredByCurrency.map((row) => ({
          currency: row.currency,
          amountCents: Math.max(0, row.amount_cents),
        })),
      },
    },
  });
}

export async function getPaymentInvoiceDetail(tx: TenantTx, _ctx: ServiceCtx, orderId: string) {
  await paymentsRosterRepository.ensurePaidOrderInvoiceNumber(tx, orderId);
  const invoice = await paymentsRosterRepository.findInvoiceByOrderId(tx, orderId);
  if (!invoice) throw paymentInvoiceNotFound();

  const paidAt = invoice.paid_at?.toISOString() ?? null;
  const createdAt = invoice.created_at.toISOString();
  const issuedAt = paidAt ?? createdAt;
  const voided = Boolean(invoice.voided_at);
  const discountCents = Math.max(0, invoice.coupon_amount_cents ?? 0);
  const taxAmountCents = invoice.tax_amount_cents;
  const tax = taxAmountCents ?? 0;
  const subtotalCents = Math.max(invoice.amount_cents - tax + discountCents, 0);
  const taxPercent =
    tax > 0 && subtotalCents - discountCents > 0
      ? Math.round((tax / Math.max(subtotalCents - discountCents, 1)) * 1000) / 10
      : null;
  const voidReason =
    invoice.void_reason &&
    ["issued_in_error", "duplicate", "amount_incorrect", "order_refunded"].includes(
      invoice.void_reason,
    )
      ? (invoice.void_reason as PaymentInvoiceVoidReason)
      : null;

  const content = buildInvoiceHtml({
    invoiceNumber: invoice.invoice_number,
    businessName: invoice.business_name,
    learnerName: invoice.learner_name,
    email: invoice.email,
    billingName: invoice.billing_name,
    productTitle: invoice.product_title,
    amountCents: invoice.amount_cents,
    taxAmountCents,
    discountCents,
    currency: invoice.currency,
    paidAt,
    voided,
  });

  const timeline: Array<{
    key: string;
    label: string;
    description: string;
    occurredAt: string;
    highlight: boolean;
  }> = [
    {
      key: "generated",
      label: "Generated",
      description: "Invoice number reserved and document created.",
      occurredAt: issuedAt,
      highlight: !voided,
    },
  ];

  if (paidAt) {
    timeline.push({
      key: "paid",
      label: "Payment captured",
      description: invoice.gateway_key
        ? `Marked paid via ${invoice.gateway_key}.`
        : "Marked paid in the ledger.",
      occurredAt: paidAt,
      highlight: false,
    });
  }

  if (voided && invoice.voided_at) {
    timeline.push({
      key: "voided",
      label: "Voided",
      description: voidReason
        ? `Voided (${voidReason.replace(/_/g, " ")}). Number remains reserved.`
        : "Voided. Invoice number remains reserved for audit.",
      occurredAt: invoice.voided_at.toISOString(),
      highlight: true,
    });
  }

  timeline.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  return paymentInvoiceDetailResponseSchema.parse({
    data: {
      orderId: invoice.id,
      displayId: displayOrderId(invoice.id),
      membershipId: invoice.membership_id,
      invoiceNumber: invoice.invoice_number,
      status: voided ? "void" : "issued",
      orderStatus: invoice.order_status,
      businessName: invoice.business_name,
      learnerName: invoice.learner_name,
      email: invoice.email,
      billingName: invoice.billing_name,
      billingNameDiffers: invoice.billing_name_differs,
      productTitle: invoice.product_title,
      gatewayKey: invoice.gateway_key,
      amountCents: invoice.amount_cents,
      subtotalCents,
      discountCents,
      taxAmountCents,
      taxPercent,
      amountPaidCents: voided ? 0 : Math.max(0, invoice.amount_cents),
      balanceDueCents: voided ? 0 : 0,
      currency: invoice.currency,
      paidAt,
      createdAt,
      issuedAt,
      voidedAt: invoice.voided_at?.toISOString() ?? null,
      voidReason,
      canVoid: !voided,
      canDownload: true,
      timeline,
      filename: `${invoice.invoice_number}.html`,
      contentType: "text/html",
      content,
    },
  });
}

export async function voidPaymentInvoice(
  tx: TenantTx,
  ctx: ServiceCtx,
  orderId: string,
  reason: PaymentInvoiceVoidReason,
) {
  const invoice = await paymentsRosterRepository.findInvoiceByOrderId(tx, orderId);
  if (!invoice) throw paymentInvoiceNotFound();
  if (invoice.voided_at) throw paymentInvoiceAlreadyVoided();
  if (!invoice.invoice_number) {
    throw paymentInvoiceNotVoidable("Invoice number is missing.");
  }

  const voidedAt = new Date().toISOString();
  const updated = await paymentsRosterRepository.voidInvoice(tx, {
    orderId,
    reason,
    voidedAt,
    voidedByMembershipId: ctx.actorMembershipId,
  });
  if (!updated?.voided_at) {
    throw paymentInvoiceNotVoidable("Unable to void this invoice.");
  }

  return voidPaymentInvoiceResponseSchema.parse({
    data: {
      orderId: updated.id,
      invoiceNumber: updated.invoice_number,
      status: "void",
      voidedAt: updated.voided_at.toISOString(),
      voidReason: reason,
    },
  });
}

export async function listPaymentInstalmentPlans(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: PaymentInstalmentsQuery,
) {
  const filter = toInstalmentsFilter(query);
  const [totalCount, rows, summary] = await Promise.all([
    paymentsRosterRepository.countInstalmentPlans(tx, filter),
    paymentsRosterRepository.listInstalmentPlans(tx, query),
    paymentsRosterRepository.getInstalmentLedgerSummary(tx),
  ]);
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / query.limit);

  return paymentInstalmentsListResponseSchema.parse({
    data: {
      items: rows.map(mapPlanItem),
      pageInfo: {
        page: query.page,
        pageSize: query.limit,
        totalCount,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
      columns: query.columns,
      summary: {
        currency: summary.currency,
        outstandingCents: Math.max(0, summary.outstanding_cents),
        outstandingPlanCount: Math.max(0, summary.outstanding_plan_count),
        dueNext7DaysCents: Math.max(0, summary.due_next_7_days_cents),
        overdueCents: Math.max(0, summary.overdue_cents),
        overdueInstalmentCount: Math.max(0, summary.overdue_instalment_count),
        completedThisMonthCount: Math.max(0, summary.completed_this_month_count),
      },
    },
  });
}

export async function getPaymentInstalmentPlanDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  planId: string,
) {
  const plan = await paymentsRosterRepository.findInstalmentPlan(tx, planId);
  if (!plan) throw paymentInstalmentPlanNotFound();
  const instalments = await paymentsRosterRepository.listInstalmentSchedule(tx, planId);

  const activity: Array<{
    id: string;
    kind: "created" | "paid" | "cancelled" | "note";
    label: string;
    detail: string | null;
    occurredAt: string;
    actorLabel: string | null;
    tone: "neutral" | "success" | "danger";
  }> = [
    {
      id: `created-${plan.id}`,
      kind: "created",
      label: "Plan created",
      detail: null,
      occurredAt: plan.created_at.toISOString(),
      actorLabel: "Admin",
      tone: "neutral",
    },
  ];

  for (const row of instalments) {
    if (row.status === "paid" && row.paid_at) {
      activity.push({
        id: `paid-${row.id}`,
        kind: "paid",
        label: `Instalment ${String(row.sequence_no)} paid`,
        detail: row.payment_order_id
          ? `Payment ${row.payment_order_id.slice(0, 8).toUpperCase()}`
          : null,
        occurredAt: row.paid_at.toISOString(),
        actorLabel: "Ledger",
        tone: "success",
      });
    }
  }

  const cancelMeta = plan.metadata_json?.["planCancel"];
  let cancel: {
    cancelledAt: string;
    reason: string;
    accessOption: "keep" | "revoke";
    accessNote: string | null;
  } | null = null;
  if (cancelMeta && typeof cancelMeta === "object" && !Array.isArray(cancelMeta)) {
    const record = cancelMeta as Record<string, unknown>;
    const cancelledAt = typeof record["cancelledAt"] === "string" ? record["cancelledAt"] : null;
    const reason = typeof record["reason"] === "string" ? record["reason"] : null;
    const accessOption =
      record["accessOption"] === "revoke" || record["accessOption"] === "keep"
        ? record["accessOption"]
        : null;
    if (cancelledAt && reason && accessOption) {
      cancel = {
        cancelledAt,
        reason,
        accessOption,
        accessNote: typeof record["accessNote"] === "string" ? record["accessNote"] : null,
      };
      activity.push({
        id: `cancelled-${plan.id}`,
        kind: "cancelled",
        label: "Plan cancelled",
        detail: reason,
        occurredAt: cancelledAt,
        actorLabel: "Admin",
        tone: "danger",
      });
    }
  }

  activity.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return paymentInstalmentPlanDetailResponseSchema.parse({
    data: {
      plan: mapPlanItem(plan),
      instalments: instalments.map((row) => ({
        id: row.id,
        sequenceNo: row.sequence_no,
        amountCents: row.amount_cents,
        dueAt: row.due_at.toISOString(),
        paidAt: row.paid_at?.toISOString() ?? null,
        status: row.status,
        paymentOrderId: row.payment_order_id,
      })),
      activity,
      cancel,
    },
  });
}

export async function createPaymentInstalmentPlan(
  tx: TenantTx,
  _ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = createPaymentInstalmentPlanBodySchema.parse(rawBody);
  const plan = await paymentsRosterRepository.insertInstalmentPlan(tx, {
    membershipId: body.membershipId,
    productTitle: body.productTitle,
    productType: body.productType,
    pricingPlanLabel: body.pricingPlanLabel ?? null,
    totalAmountCents: body.totalAmountCents,
    currency: body.currency,
    instalments: body.instalments,
    metadataJson: {
      productId: body.productId ?? null,
      accessPolicy: body.accessPolicy,
      accessPolicyNote:
        body.accessPolicy === "immediate"
          ? "Immediate access requested — course enrollment is not granted automatically by plan creation."
          : "Access after first payment requested — enrollment is not automated by this plan yet.",
      automatedReminders: body.automatedReminders,
      autoRevokeOnDefault: body.autoRevokeOnDefault,
      sendConfirmationEmail: body.sendConfirmationEmail,
      confirmationEmailQueued: false,
    },
  });

  return createPaymentInstalmentPlanResponseSchema.parse({
    data: mapPlanItem(plan),
  });
}

export async function payPaymentInstalment(
  tx: TenantTx,
  ctx: ServiceCtx,
  planId: string,
  rawBody: unknown,
) {
  const body = payPaymentInstalmentBodySchema.parse(rawBody);
  const plan = await paymentsRosterRepository.findInstalmentPlan(tx, planId);
  if (!plan) throw paymentInstalmentPlanNotFound();
  if (plan.status === "cancelled" || plan.status === "completed") {
    throw paymentInstalmentNotPayable();
  }

  const instalment = await paymentsRosterRepository.findNextPayableInstalment(
    tx,
    planId,
    body.instalmentId,
  );
  if (!instalment) throw paymentInstalmentNotPayable();

  const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
  const externalId =
    body.reference?.trim() ||
    `instalment_${instalment.id}${body.paymentMethod === "gateway" ? "" : `_${body.paymentMethod}`}`;

  const invoiceNumber = await paymentsRosterRepository.allocateInvoiceNumber(tx);
  const order = await paymentsRepository.insertOrder(tx, {
    membershipId: plan.membership_id,
    externalId,
    amountCents: instalment.amount_cents,
    currency: plan.currency,
    status: "paid",
    gatewayKey: body.gatewayKey ?? null,
    productTitle: plan.product_title,
    productType: plan.product_type,
    invoiceNumber,
    billingName: plan.learner_name,
    paidAt,
    metadataJson: {
      kind: "instalment_payment",
      planId,
      instalmentId: instalment.id,
      sequenceNo: instalment.sequence_no,
      paymentMethod: body.paymentMethod,
      gatewayKey: body.gatewayKey ?? null,
      reference: body.reference ?? null,
      sendReceipt: body.sendReceipt,
      recordedByMembershipId: ctx.actorMembershipId,
    },
  });

  const updated = await paymentsRosterRepository.markInstalmentPaid(tx, {
    planId,
    instalmentId: instalment.id,
    paymentOrderId: order.id,
    amountCents: instalment.amount_cents,
    paidAt,
  });

  return payPaymentInstalmentResponseSchema.parse({
    data: {
      planId,
      instalmentId: instalment.id,
      paymentOrderId: order.id,
      remainingAmountCents: updated.remaining_amount_cents,
      planStatus: updated.status,
      // Receipt email delivery is not wired for admin-recorded instalments yet.
      receiptQueued: false,
    },
  });
}

export async function cancelPaymentInstalmentPlan(
  tx: TenantTx,
  ctx: ServiceCtx,
  planId: string,
  rawBody: unknown,
) {
  const body = cancelPaymentInstalmentPlanBodySchema.parse(rawBody);
  const plan = await paymentsRosterRepository.findInstalmentPlan(tx, planId);
  if (!plan) throw paymentInstalmentPlanNotFound();
  if (plan.status === "cancelled") {
    throw paymentInstalmentPlanNotCancellable("This plan is already cancelled.");
  }
  if (plan.status === "completed") {
    throw paymentInstalmentPlanNotCancellable("Completed plans cannot be cancelled.");
  }

  const cancelledAt = new Date().toISOString();
  const updated = await paymentsRosterRepository.cancelInstalmentPlan(tx, {
    planId,
    reason: body.reason,
    accessOption: body.accessOption,
    cancelledAt,
    cancelledByMembershipId: ctx.actorMembershipId,
  });
  if (!updated) {
    throw paymentInstalmentPlanNotCancellable("Unable to cancel this plan.");
  }

  return cancelPaymentInstalmentPlanResponseSchema.parse({
    data: {
      planId,
      status: "cancelled",
      cancelledAt,
      reason: body.reason,
      accessOption: body.accessOption,
      voidedInstalmentCount: updated.voided_instalment_count,
    },
  });
}

function resolvePaymentOverviewWindow(query: PaymentOverviewQuery): {
  windowFrom: Date;
  windowTo: Date;
  windowLabel: string;
  filter: PaymentOverviewFilter;
} {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 34 * 24 * 60 * 60 * 1000);
  const windowFrom = query.paidFrom ? new Date(query.paidFrom) : defaultFrom;
  const windowTo = query.paidTo ? new Date(query.paidTo) : now;
  const days = Math.max(
    1,
    Math.round((windowTo.getTime() - windowFrom.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  const windowLabel =
    query.paidFrom || query.paidTo
      ? days <= 40
        ? `${String(days)} days`
        : "Selected range"
      : "35 days";

  const filter: PaymentOverviewFilter = {
    paidFrom: windowFrom.toISOString(),
    paidTo: windowTo.toISOString(),
  };
  if (query.currency) filter.currency = query.currency.toUpperCase();

  return { windowFrom, windowTo, windowLabel, filter };
}

function previousPaymentWindow(
  windowFrom: Date,
  windowTo: Date,
): {
  from: Date;
  to: Date;
} {
  const durationMs = Math.max(windowTo.getTime() - windowFrom.getTime(), 24 * 60 * 60 * 1000);
  const to = new Date(windowFrom.getTime() - 1);
  const from = new Date(to.getTime() - durationMs);
  return { from, to };
}

export async function getPaymentOverview(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: PaymentOverviewQuery,
) {
  const { windowFrom, windowTo, windowLabel, filter } = resolvePaymentOverviewWindow(query);
  const previous = previousPaymentWindow(windowFrom, windowTo);
  const previousFilter: PaymentOverviewFilter = {
    paidFrom: previous.from.toISOString(),
    paidTo: previous.to.toISOString(),
  };
  if (filter.currency) previousFilter.currency = filter.currency;

  const [
    summary,
    outstanding,
    previousCollectedCents,
    revenueTrend,
    byGatewayRows,
    topProducts,
    attention,
    recentRows,
  ] = await Promise.all([
    paymentsRosterRepository.getOverviewSummary(tx, filter),
    paymentsRosterRepository.getOverviewOutstandingInstalments(tx, filter.currency),
    paymentsRosterRepository.getOverviewCollectedInWindow(tx, previousFilter),
    paymentsRosterRepository.getOverviewRevenueTrend(tx, filter, query.grain),
    paymentsRosterRepository.getOverviewByGateway(tx, filter),
    paymentsRosterRepository.getOverviewTopProducts(tx, filter),
    paymentsRosterRepository.getOverviewAttention(tx, filter),
    paymentsRosterRepository.listTransactions(tx, {
      paidFrom: filter.paidFrom,
      paidTo: filter.paidTo,
      status: "paid",
      dateField: "paid_at",
      sortBy: "paid_at",
      sortDir: "desc",
      columns: [
        "learner_name",
        "email",
        "product_title",
        "gateway_key",
        "amount_cents",
        "currency",
        "status",
        "paid_at",
      ],
      limit: 8,
      page: 1,
    }),
  ]);

  const currency = filter.currency ?? summary.currencies[0] ?? recentRows[0]?.currency ?? "USD";

  const averageOrderCents =
    summary.transaction_count === 0
      ? 0
      : Math.round(summary.collected_cents / summary.transaction_count);

  const failedPercent =
    summary.attempt_count === 0
      ? 0
      : Math.round((summary.failed_count / summary.attempt_count) * 1000) / 10;

  const changePercent =
    previousCollectedCents === 0
      ? summary.collected_cents > 0
        ? 100
        : null
      : Math.round(
          ((summary.collected_cents - previousCollectedCents) / previousCollectedCents) * 1000,
        ) / 10;

  const gatewayTotal = byGatewayRows.reduce((sum, row) => sum + row.amount_cents, 0);

  const recentFiltered = filter.currency
    ? recentRows.filter((row) => row.currency.toUpperCase() === filter.currency)
    : recentRows;

  return paymentOverviewResponseSchema.parse({
    data: {
      summary: {
        collectedCents: summary.collected_cents,
        currency,
        currencies: summary.currencies.length > 0 ? summary.currencies : [currency],
        transactionCount: summary.transaction_count,
        averageOrderCents,
        outstandingInstalmentCents: outstanding.remaining_cents,
        outstandingPlanCount: outstanding.plan_count,
        failedCount: summary.failed_count,
        attemptCount: summary.attempt_count,
        failedPercent,
        previousCollectedCents,
        changePercent,
        windowLabel,
        windowFrom: windowFrom.toISOString(),
        windowTo: windowTo.toISOString(),
      },
      revenueTrend: revenueTrend.map((row) => ({
        date: row.date,
        courseCents: row.course_cents,
        bundleCents: row.bundle_cents,
        subscriptionCents: row.subscription_cents,
        liveClassCents: row.live_class_cents,
        otherCents: row.other_cents,
        totalCents: row.total_cents,
        orderCount: row.order_count,
      })),
      byGateway: byGatewayRows.map((row) => ({
        gatewayKey: row.gateway_key,
        displayName: row.display_name,
        amountCents: row.amount_cents,
        percent: gatewayTotal === 0 ? 0 : Math.round((row.amount_cents / gatewayTotal) * 1000) / 10,
      })),
      topProducts: topProducts.map((row) => ({
        productTitle: row.product_title,
        productType: row.product_type,
        amountCents: row.amount_cents,
        orderCount: row.order_count,
      })),
      attention: {
        unsentInvoiceCount: attention.unsent_invoice_count,
        overdueInstalmentCount: attention.overdue_instalment_count,
        failedPaymentCount: attention.failed_payment_count,
      },
      recentTransactions: recentFiltered.map(mapTransactionItem),
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function displayOrderId(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

type StoredRefund = {
  id: string;
  amountCents: number;
  reason: string;
  note: string | null;
  mode: "full" | "partial";
  revokeAccess: boolean;
  notifyLearner: boolean;
  accessRevoked: boolean;
  notifyQueued: boolean;
  actorMembershipId: string | null;
  createdAt: string;
  gatewayRefundId?: string;
};

function readRefunds(metadata: Record<string, unknown>): StoredRefund[] {
  const raw = metadata["refunds"];
  if (!Array.isArray(raw)) return [];
  const out: StoredRefund[] = [];
  for (const item of raw) {
    const record = asRecord(item);
    const id = asString(record["id"]);
    const amountCents = asNumber(record["amountCents"]);
    const createdAt = asString(record["createdAt"]);
    const mode = record["mode"] === "partial" ? "partial" : "full";
    if (!id || amountCents == null || amountCents <= 0 || !createdAt) continue;
    out.push({
      id,
      amountCents: Math.trunc(amountCents),
      reason: asString(record["reason"]) ?? "other",
      note: asString(record["note"]),
      mode,
      revokeAccess: Boolean(record["revokeAccess"]),
      notifyLearner: Boolean(record["notifyLearner"]),
      accessRevoked: Boolean(record["accessRevoked"]),
      notifyQueued: Boolean(record["notifyQueued"]),
      actorMembershipId: asString(record["actorMembershipId"]),
      createdAt,
    });
  }
  return out;
}

function readAddressLines(metadata: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const nested = asRecord(metadata["billingAddress"] ?? metadata["billing_address"]);
  const candidates = [
    asString(nested["line1"]) ?? asString(nested["addressLine1"]),
    asString(nested["line2"]) ?? asString(nested["addressLine2"]),
    [asString(nested["city"]), asString(nested["state"]), asString(nested["postalCode"])]
      .filter(Boolean)
      .join(", ") || null,
    asString(nested["country"]),
    asString(metadata["billingAddressText"]),
    asString(metadata["billing_address_text"]),
  ];
  for (const line of candidates) {
    if (line && !lines.includes(line)) lines.push(line);
  }
  return lines;
}

function buildTransactionDetailPayload(row: PaymentTransactionDetailRow) {
  const metadata = asRecord(row.metadata_json);
  const refunds = readRefunds(metadata);
  const refundedAmountCents = refunds.reduce((sum, item) => sum + item.amountCents, 0);
  const statusLower = row.status.toLowerCase();
  const isFailed = statusLower === "failed" || statusLower === "cancelled";
  const isRefunded = statusLower.includes("refund");
  const refundableAmountCents = isFailed ? 0 : Math.max(0, row.amount_cents - refundedAmountCents);
  const canRefund = refundableAmountCents > 0 && (statusLower === "paid" || isRefunded);
  const couponAmountCents = row.coupon_amount_cents;
  const taxAmountCents = row.tax_amount_cents;
  const subtotalCents = row.amount_cents + (couponAmountCents ?? 0) - (taxAmountCents ?? 0);
  const gatewayFeeCents =
    asNumber(metadata["gatewayFeeCents"]) ??
    asNumber(metadata["gateway_fee_cents"]) ??
    asNumber(metadata["feeCents"]) ??
    null;
  const netSettledCents =
    gatewayFeeCents == null ? null : Math.max(0, row.amount_cents - Math.abs(gatewayFeeCents));

  const courseId = asString(metadata["courseId"]) ?? asString(metadata["course_id"]) ?? null;
  const sku =
    asString(metadata["sku"]) ??
    asString(metadata["productSku"]) ??
    asString(metadata["product_sku"]) ??
    null;
  const couponCode = asString(metadata["couponCode"]) ?? asString(metadata["coupon_code"]) ?? null;
  const last4 =
    asString(metadata["last4"]) ??
    asString(metadata["cardLast4"]) ??
    asString(asRecord(metadata["paymentMethod"])["last4"]) ??
    null;
  const brand =
    asString(metadata["brand"]) ??
    asString(metadata["cardBrand"]) ??
    asString(asRecord(metadata["paymentMethod"])["brand"]) ??
    null;
  const methodLabel =
    asString(metadata["paymentMethodLabel"]) ??
    (brand && last4 ? `${brand} ending in ${last4}` : brand) ??
    asString(metadata["paymentMethod"]) ??
    null;
  const envRaw = (
    asString(metadata["environment"]) ?? asString(metadata["livemode"])
  )?.toLowerCase();
  const environment =
    envRaw === "live" || envRaw === "true" || envRaw === "1"
      ? ("live" as const)
      : envRaw === "test" || envRaw === "false" || envRaw === "0"
        ? ("test" as const)
        : ("unknown" as const);

  const riskScore =
    asNumber(metadata["riskScore"]) ??
    asNumber(metadata["risk_score"]) ??
    asNumber(asRecord(metadata["risk"])["score"]);
  const riskLabel =
    asString(metadata["riskLabel"]) ??
    asString(asRecord(metadata["risk"])["label"]) ??
    (riskScore != null ? (riskScore <= 20 ? "Pass" : "Review") : null);
  const riskSummary =
    asString(metadata["riskSummary"]) ?? asString(asRecord(metadata["risk"])["summary"]) ?? null;
  const risk =
    riskLabel || riskScore != null || riskSummary
      ? {
          label: riskLabel ?? "Recorded",
          score: riskScore,
          summary: riskSummary,
        }
      : null;

  const createdAt = row.created_at.toISOString();
  const paidAt = row.paid_at?.toISOString() ?? null;
  const updatedAt = row.updated_at.toISOString();

  const flow: Array<{
    key: "created" | "authorized" | "captured" | "settled" | "refunded" | "failed";
    label: string;
    status: "complete" | "current" | "pending" | "skipped";
    occurredAt: string | null;
  }> = [{ key: "created", label: "Created", status: "complete", occurredAt: createdAt }];

  if (isFailed) {
    flow.push(
      { key: "authorized", label: "Authorized", status: "skipped", occurredAt: null },
      { key: "captured", label: "Captured", status: "skipped", occurredAt: null },
      {
        key: "failed",
        label: "Failed",
        status: "current",
        occurredAt: updatedAt,
      },
    );
  } else if (isRefunded && refundableAmountCents === 0) {
    flow.push(
      {
        key: "authorized",
        label: "Authorized",
        status: "complete",
        occurredAt: paidAt ?? createdAt,
      },
      {
        key: "captured",
        label: "Captured",
        status: "complete",
        occurredAt: paidAt ?? createdAt,
      },
      {
        key: "refunded",
        label: "Refunded",
        status: "current",
        occurredAt: refunds[refunds.length - 1]?.createdAt ?? updatedAt,
      },
    );
  } else if (statusLower === "paid" || (isRefunded && refundableAmountCents > 0)) {
    flow.push(
      {
        key: "authorized",
        label: "Authorized",
        status: "complete",
        occurredAt: paidAt ?? createdAt,
      },
      {
        key: "captured",
        label: "Captured",
        status: "complete",
        occurredAt: paidAt ?? createdAt,
      },
      {
        key: "settled",
        label: "Settled",
        status: "current",
        occurredAt: paidAt,
      },
    );
  } else {
    flow.push(
      { key: "authorized", label: "Authorized", status: "pending", occurredAt: null },
      { key: "captured", label: "Captured", status: "pending", occurredAt: null },
      { key: "settled", label: "Settled", status: "pending", occurredAt: null },
    );
  }

  const events: Array<{
    id: string;
    kind: string;
    label: string;
    description: string;
    occurredAt: string;
    highlight: boolean;
  }> = [
    {
      id: `${row.id}-created`,
      kind: "order.created",
      label: "Order created",
      description: "Payment order recorded in the ledger.",
      occurredAt: createdAt,
      highlight: false,
    },
  ];

  if (paidAt) {
    events.push({
      id: `${row.id}-captured`,
      kind: "payment.captured",
      label: "Payment captured",
      description: row.gateway_key
        ? `Marked paid via ${row.gateway_key}.`
        : "Marked paid in the ledger.",
      occurredAt: paidAt,
      highlight: false,
    });
    events.push({
      id: `${row.id}-access`,
      kind: "access.granted",
      label: "Access granted",
      description: courseId
        ? "Course entitlement expected from this paid order."
        : "Product access follows your catalog fulfilment rules.",
      occurredAt: paidAt,
      highlight: statusLower === "paid",
    });
  }

  if (row.invoice_number && paidAt) {
    events.push({
      id: `${row.id}-invoice`,
      kind: "invoice.issued",
      label: "Invoice issued",
      description: `Tax invoice ${row.invoice_number} available for download.`,
      occurredAt: paidAt,
      highlight: false,
    });
  }

  for (const refund of refunds) {
    events.push({
      id: refund.id,
      kind: "payment.refunded",
      label: refund.mode === "full" ? "Full refund recorded" : "Partial refund recorded",
      description: `Ledger refund of ${String(refund.amountCents)} ${row.currency.toUpperCase()} (${refund.reason}).`,
      occurredAt: refund.createdAt,
      highlight: true,
    });
  }

  if (isFailed) {
    events.push({
      id: `${row.id}-failed`,
      kind: "payment.failed",
      label: "Payment failed",
      description: "Order ended in a non-collected state.",
      occurredAt: updatedAt,
      highlight: true,
    });
  }

  events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  let accessStatus: string | null = null;
  if (isRefunded && refunds.some((item) => item.accessRevoked)) {
    accessStatus = "Revoked after refund";
  } else if (statusLower === "paid") {
    accessStatus = courseId ? "Granted with payment" : "Fulfilment per product rules";
  } else if (isFailed) {
    accessStatus = "Not granted";
  }

  return {
    id: row.id,
    displayId: displayOrderId(row.id),
    membershipId: row.membership_id,
    status: row.status,
    currency: row.currency,
    amountCents: row.amount_cents,
    couponAmountCents,
    taxAmountCents,
    subtotalCents: Math.max(0, subtotalCents),
    gatewayFeeCents: gatewayFeeCents == null ? null : Math.abs(Math.trunc(gatewayFeeCents)),
    netSettledCents,
    couponCode,
    gatewayKey: row.gateway_key,
    externalId: row.external_id,
    invoiceNumber: row.invoice_number,
    paidAt,
    createdAt,
    updatedAt,
    environment,
    learner: {
      membershipId: row.membership_id,
      name: row.learner_name,
      email: row.email,
    },
    product: {
      title: row.product_title,
      type: row.product_type,
      sku,
      courseId: courseId && /^[0-9a-fA-F-]{36}$/.test(courseId) ? courseId : null,
      accessStatus,
    },
    billing: {
      name: row.billing_name,
      addressLines: readAddressLines(metadata),
      taxId:
        asString(metadata["taxId"]) ??
        asString(metadata["gstin"]) ??
        asString(metadata["vatId"]) ??
        null,
    },
    gateway: {
      provider: row.gateway_key,
      methodLabel,
      brand,
      last4,
      networkRef:
        asString(metadata["chargeId"]) ?? asString(metadata["charge_id"]) ?? row.external_id,
    },
    risk,
    flow,
    events,
    refunds,
    refundedAmountCents,
    refundableAmountCents,
    canRefund,
    canDownloadInvoice: Boolean(row.invoice_number) && statusLower === "paid",
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  };
}

export async function getPaymentTransactionDetail(tx: TenantTx, _ctx: ServiceCtx, orderId: string) {
  const row = await paymentsRosterRepository.findTransactionDetailByOrderId(tx, orderId);
  if (!row) throw paymentTransactionNotFound();
  return paymentTransactionDetailResponseSchema.parse({
    data: buildTransactionDetailPayload(row),
  });
}

export async function listPaymentRefunds(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: PaymentRefundsQuery,
) {
  const filter = {
    queue: query.queue,
    ...(query.paidFrom ? { paidFrom: query.paidFrom } : {}),
    ...(query.paidTo ? { paidTo: query.paidTo } : {}),
    ...(query.q ? { q: query.q } : {}),
    ...(query.gatewayKey ? { gatewayKey: query.gatewayKey } : {}),
  };
  const summaryFilter = {
    ...(query.paidFrom ? { paidFrom: query.paidFrom } : {}),
    ...(query.paidTo ? { paidTo: query.paidTo } : {}),
    ...(query.q ? { q: query.q } : {}),
    ...(query.gatewayKey ? { gatewayKey: query.gatewayKey } : {}),
  };

  const [totalCount, rows, summary] = await Promise.all([
    paymentsRosterRepository.countRefundLedger(tx, filter),
    paymentsRosterRepository.listRefundLedger(tx, {
      ...filter,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      limit: query.limit,
      page: query.page,
    }),
    paymentsRosterRepository.getRefundsQueueSummary(tx, summaryFilter),
  ]);

  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / query.limit);
  const currency = (summary.currency ?? rows[0]?.currency ?? "USD").toUpperCase();

  return paymentRefundsListResponseSchema.parse({
    data: {
      summary: {
        refundableCount: summary.refundable_count,
        partialCount: summary.partial_count,
        refundedCount: summary.refunded_count,
        refundableAmountCents: summary.refundable_amount_cents,
        refundedAmountCents: summary.refunded_amount_cents,
        currency,
        windowFrom: query.paidFrom ?? null,
        windowTo: query.paidTo ?? null,
      },
      items: rows.map((row) => {
        const refunds = readRefunds(
          row.metadata_json && typeof row.metadata_json === "object"
            ? (row.metadata_json as Record<string, unknown>)
            : {},
        );
        const statusLower = row.status.toLowerCase();
        const canRefund =
          row.refundable_amount_cents > 0 &&
          (statusLower === "paid" || statusLower.includes("refund"));
        const latestRefund =
          refunds.length === 0
            ? null
            : ([...refunds].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null);
        return {
          orderId: row.id,
          membershipId: row.membership_id,
          learnerName: row.learner_name,
          email: row.email,
          productTitle: row.product_title,
          gatewayKey: row.gateway_key,
          amountCents: row.amount_cents,
          refundedAmountCents: row.refunded_amount_cents,
          refundableAmountCents: row.refundable_amount_cents,
          currency: row.currency.toUpperCase(),
          status: row.status,
          invoiceNumber: row.invoice_number,
          paidAt: row.paid_at ? row.paid_at.toISOString() : null,
          createdAt: row.created_at.toISOString(),
          canRefund,
          refundCount: refunds.length,
          latestRefund,
        };
      }),
      pageInfo: {
        page: query.page,
        pageSize: query.limit,
        totalCount,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
      capabilities: {
        requestQueue: false,
        disputesAvailable: false,
        gatewayRefundsAutomated: false,
      },
    },
  });
}

export async function refundPaymentTransaction(
  tx: TenantTx,
  ctx: ServiceCtx,
  orderId: string,
  rawBody: unknown,
) {
  const body = refundPaymentTransactionBodySchema.parse(rawBody);
  const row = await paymentsRosterRepository.findTransactionDetailByOrderId(tx, orderId);
  if (!row) throw paymentTransactionNotFound();

  const detail = buildTransactionDetailPayload(row);
  if (!detail.canRefund || detail.refundableAmountCents <= 0) {
    throw paymentTransactionNotRefundable("This payment has no remaining refundable balance.");
  }

  const amountCents =
    body.mode === "full" ? detail.refundableAmountCents : (body.amountCents as number);

  if (amountCents > detail.refundableAmountCents) {
    throw paymentTransactionNotRefundable(
      `Refund amount exceeds refundable balance (${String(detail.refundableAmountCents)} cents).`,
    );
  }

  let accessRevoked = false;
  if (body.revokeAccess && row.membership_id && detail.product.courseId) {
    accessRevoked = await paymentsRosterRepository.revokeCourseEnrollment(tx, {
      membershipId: row.membership_id,
      courseId: detail.product.courseId,
    });
  }

  let gatewayRefundId: string | null = null;
  let gatewayNote =
    "Refund recorded on the LMS ledger. Process the matching reverse on your payment gateway if required; automated gateway refunds are not wired yet.";

  if (row.external_id && row.gateway_key) {
    try {
      const { provider } = await resolvePaymentProvider(tx, {
        gatewayKey: row.gateway_key,
      });
      if (provider.refund) {
        const gatewayRefund = await provider.refund({
          externalId: row.external_id,
          ...(body.mode === "full" ? {} : { amountCents }),
        });
        gatewayRefundId = gatewayRefund.refundId;
        gatewayNote = `Refund submitted to ${row.gateway_key} (${gatewayRefund.refundId}).`;
      }
    } catch {
      gatewayNote =
        "Refund recorded on the LMS ledger, but the payment gateway refund failed. Process the reverse on your gateway manually.";
    }
  }

  const notifyQueued = Boolean(body.notifyLearner && row.email);
  const refund: StoredRefund = {
    id: randomUUID(),
    amountCents,
    reason: body.reason,
    note: body.note,
    mode: body.mode,
    revokeAccess: body.revokeAccess,
    notifyLearner: body.notifyLearner,
    accessRevoked,
    notifyQueued,
    actorMembershipId: ctx.actorMembershipId,
    createdAt: new Date().toISOString(),
    ...(gatewayRefundId ? { gatewayRefundId } : {}),
  };

  const metadata = asRecord(row.metadata_json);
  const nextRefunds = [...readRefunds(metadata), refund];
  const nextRefundedTotal = nextRefunds.reduce((sum, item) => sum + item.amountCents, 0);
  const nextStatus = nextRefundedTotal >= row.amount_cents ? "refunded" : row.status;

  const updated = await paymentsRosterRepository.updateOrderRefund(tx, {
    orderId,
    status: nextStatus,
    metadataJson: {
      ...metadata,
      refunds: nextRefunds,
    },
  });
  if (!updated) throw paymentTransactionNotFound();

  const updatedDetail = buildTransactionDetailPayload(updated);

  return refundPaymentTransactionResponseSchema.parse({
    data: {
      orderId: updated.id,
      status: updated.status,
      refund,
      refundedAmountCents: updatedDetail.refundedAmountCents,
      refundableAmountCents: updatedDetail.refundableAmountCents,
      accessRevoked,
      notifyQueued,
      gatewayNote,
    },
  });
}
