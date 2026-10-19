import { clientApi } from "../../../lib/client-api";
import type { RefundStatus } from "./refund-submission";

export const PAYMENT_TRANSACTION_COLUMN_OPTIONS = [
  { key: "learner_name", label: "Learner" },
  { key: "email", label: "Email" },
  { key: "product_title", label: "Product" },
  { key: "product_type", label: "Product type" },
  { key: "gateway_key", label: "Gateway" },
  { key: "coupon_amount_cents", label: "Coupon amount" },
  { key: "amount_cents", label: "Amount" },
  { key: "tax_amount_cents", label: "Tax" },
  { key: "currency", label: "Currency" },
  { key: "status", label: "Status" },
  { key: "invoice_number", label: "Invoice #" },
  { key: "paid_at", label: "Transaction date" },
  { key: "created_at", label: "Created" },
] as const;

export type PaymentTransactionColumnKey =
  (typeof PAYMENT_TRANSACTION_COLUMN_OPTIONS)[number]["key"];

export const PAYMENT_INVOICE_COLUMN_OPTIONS = [
  { key: "invoice_number", label: "Invoice #" },
  { key: "learner_name", label: "Learner" },
  { key: "email", label: "Email" },
  { key: "billing_name", label: "Billing name" },
  { key: "product_title", label: "Product" },
  { key: "amount_cents", label: "Price" },
  { key: "tax_amount_cents", label: "Tax" },
  { key: "currency", label: "Currency" },
  { key: "paid_at", label: "Date" },
] as const;

export type PaymentInvoiceColumnKey = (typeof PAYMENT_INVOICE_COLUMN_OPTIONS)[number]["key"];

export const PAYMENT_INSTALMENT_COLUMN_OPTIONS = [
  { key: "learner_name", label: "Learner" },
  { key: "email", label: "Email" },
  { key: "product_title", label: "Product" },
  { key: "pricing_plan_label", label: "Pricing plan" },
  { key: "total_amount_cents", label: "Total" },
  { key: "remaining_amount_cents", label: "Remaining" },
  { key: "currency", label: "Currency" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created" },
  { key: "next_due_at", label: "Next due" },
] as const;

export type PaymentInstalmentColumnKey = (typeof PAYMENT_INSTALMENT_COLUMN_OPTIONS)[number]["key"];

export type PaymentTransactionItem = {
  id: string;
  membershipId: string | null;
  learnerName: string | null;
  email: string | null;
  productTitle: string | null;
  productType: string | null;
  gatewayKey: string | null;
  couponAmountCents: number | null;
  amountCents: number;
  taxAmountCents: number | null;
  currency: string;
  status: string;
  invoiceNumber: string | null;
  externalId: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type PaymentGatewayItem = {
  id: string;
  gatewayKey: string;
  displayName: string;
  isConfigured: boolean;
  isPublished: boolean;
  isDefault: boolean;
  transactionCount: number;
  paidTransactionCount: number;
  failedCount: number;
  paidAmountCents: number;
  successPercent: number | null;
  volumeSharePercent: number;
  currency: string;
};

export type PaymentGatewaysSummary = {
  totalPaidCents: number;
  currency: string;
  windowFrom: string;
  windowTo: string;
  windowLabel: string;
};

export type PaymentGatewaysList = {
  summary: PaymentGatewaysSummary;
  items: PaymentGatewayItem[];
};

export type PaymentGatewayDetail = {
  gateway: {
    id: string;
    gatewayKey: string;
    displayName: string;
    isConfigured: boolean;
    isPublished: boolean;
    isDefault: boolean;
    publishableKeyMasked: string | null;
    secretLast4: string | null;
    hasSecret: boolean;
    createdAt: string;
    updatedAt: string;
  };
  summary: {
    paidAmountCents: number;
    previousPaidAmountCents: number;
    changePercent: number | null;
    transactionCount: number;
    paidTransactionCount: number;
    failedCount: number;
    refundedCount: number;
    successPercent: number | null;
    currency: string;
    windowFrom: string;
    windowTo: string;
    windowLabel: string;
  };
  capabilities: {
    feesTracked: boolean;
    payoutsAvailable: boolean;
    webhookLogAvailable: boolean;
  };
};

export type PaymentRefundsQueue = "refundable" | "partial" | "refunded" | "all";

export type PaymentRefundLedgerItem = {
  orderId: string;
  membershipId: string | null;
  learnerName: string | null;
  email: string | null;
  productTitle: string | null;
  gatewayKey: string | null;
  amountCents: number;
  refundedAmountCents: number;
  refundableAmountCents: number;
  reservedRefundAmountCents: number;
  currency: string;
  status: string;
  invoiceNumber: string | null;
  paidAt: string | null;
  createdAt: string;
  canRefund: boolean;
  refundCount: number;
  latestRefund: PaymentTransactionDetail["refunds"][number] | null;
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

/** A page of transactions, for the ledger and a gateway's transactions tab. */
export type PaymentTransactionsPayload = {
  items: PaymentTransactionItem[];
  pageInfo: PageInfo;
  columns: string[];
  totals: {
    pageAmountCents: number;
    filteredAmountCents: number;
    currency: string;
  };
};

export type PaymentInvoicesPayload = {
  items: PaymentInvoiceItem[];
  pageInfo: PageInfo;
  columns: string[];
  totals: {
    pageByCurrency: Array<{ currency: string; amountCents: number }>;
    filteredByCurrency: Array<{ currency: string; amountCents: number }>;
  };
};

export type PaymentRefundsList = {
  summary: {
    refundableCount: number;
    partialCount: number;
    refundedCount: number;
    refundableAmountCents: number;
    refundedAmountCents: number;
    currency: string;
    windowFrom: string | null;
    windowTo: string | null;
  };
  items: PaymentRefundLedgerItem[];
  pageInfo: PageInfo;
  capabilities: {
    requestQueue: boolean;
    disputesAvailable: boolean;
    gatewayRefundsAutomated: boolean;
  };
};

export type PaymentInvoiceItem = {
  id: string;
  membershipId: string | null;
  invoiceNumber: string;
  learnerName: string | null;
  email: string | null;
  billingName: string | null;
  billingNameDiffers: boolean;
  productTitle: string | null;
  amountCents: number;
  taxAmountCents: number | null;
  currency: string;
  paidAt: string | null;
  createdAt: string;
  status: "issued" | "void";
  voidedAt: string | null;
};

export type PaymentInvoiceDetail = {
  orderId: string;
  displayId: string;
  membershipId: string | null;
  invoiceNumber: string;
  status: "issued" | "void";
  orderStatus: string;
  businessName: string | null;
  learnerName: string | null;
  email: string | null;
  billingName: string | null;
  billingNameDiffers: boolean;
  productTitle: string | null;
  gatewayKey: string | null;
  amountCents: number;
  subtotalCents: number;
  discountCents: number;
  taxAmountCents: number | null;
  taxPercent: number | null;
  amountPaidCents: number;
  balanceDueCents: number;
  currency: string;
  paidAt: string | null;
  createdAt: string;
  issuedAt: string | null;
  voidedAt: string | null;
  voidReason: "issued_in_error" | "duplicate" | "amount_incorrect" | "order_refunded" | null;
  canVoid: boolean;
  canDownload: boolean;
  timeline: Array<{
    key: string;
    label: string;
    description: string;
    occurredAt: string;
    highlight: boolean;
  }>;
  filename: string;
  contentType: "text/html";
  content: string;
};

export type PaymentInstalmentPlanItem = {
  id: string;
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  productTitle: string;
  productType: string;
  pricingPlanLabel: string | null;
  totalAmountCents: number;
  remainingAmountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  nextDueAt: string | null;
  instalmentCount: number;
  paidCount: number;
  overdueCount: number;
};

export type PaymentInstalmentSummary = {
  currency: string;
  outstandingCents: number;
  outstandingPlanCount: number;
  dueNext7DaysCents: number;
  overdueCents: number;
  overdueInstalmentCount: number;
  completedThisMonthCount: number;
};

export type PaymentInstalmentScheduleItem = {
  id: string;
  sequenceNo: number;
  amountCents: number;
  dueAt: string;
  paidAt: string | null;
  status: string;
  paymentOrderId: string | null;
};

export type PaymentInstalmentActivityItem = {
  id: string;
  kind: "created" | "paid" | "cancelled" | "note";
  label: string;
  detail: string | null;
  occurredAt: string;
  actorLabel: string | null;
  tone: "neutral" | "success" | "danger";
};

export type PaymentInstalmentCancelInfo = {
  cancelledAt: string;
  reason: string;
  accessOption: "keep" | "revoke";
  accessNote: string | null;
};

export type PaymentInstalmentsPayload = {
  items: PaymentInstalmentPlanItem[];
  pageInfo: PageInfo;
  columns: string[];
  summary: PaymentInstalmentSummary;
};

export type PaymentInstalmentPlanDetail = {
  plan: PaymentInstalmentPlanItem;
  instalments: PaymentInstalmentScheduleItem[];
  activity: PaymentInstalmentActivityItem[];
  cancel: PaymentInstalmentCancelInfo | null;
};

export type PaymentInstalmentCancelReason =
  | "too_expensive"
  | "completed_goals"
  | "no_time"
  | "learner_request"
  | "admin_correction"
  | "other";

export type PaymentOverviewGrain = "day" | "week" | "month";

export type PaymentOverview = {
  summary: {
    collectedCents: number;
    currency: string;
    currencies: string[];
    transactionCount: number;
    averageOrderCents: number;
    outstandingInstalmentCents: number;
    outstandingPlanCount: number;
    failedCount: number;
    attemptCount: number;
    failedPercent: number;
    previousCollectedCents: number;
    changePercent: number | null;
    windowLabel: string;
    windowFrom: string;
    windowTo: string;
  };
  revenueTrend: Array<{
    date: string;
    courseCents: number;
    bundleCents: number;
    subscriptionCents: number;
    liveClassCents: number;
    otherCents: number;
    totalCents: number;
    orderCount: number;
  }>;
  byGateway: Array<{
    gatewayKey: string;
    displayName: string;
    amountCents: number;
    percent: number;
  }>;
  topProducts: Array<{
    productTitle: string;
    productType: string;
    amountCents: number;
    orderCount: number;
  }>;
  attention: {
    unsentInvoiceCount: number;
    overdueInstalmentCount: number;
    failedPaymentCount: number;
  };
  recentTransactions: PaymentTransactionItem[];
};

export function dateInputToStartIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return `${trimmed}T00:00:00.000Z`;
}

export function dateInputToEndIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return `${trimmed}T23:59:59.999Z`;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** The `?tab=` values the payments page sends to their own route instead of the overview. */
export const PAYMENTS_REDIRECT_TABS = ["transactions", "invoices", "instalment", "gateways"];

export type PaymentOverviewFilters = {
  paidFrom?: string | undefined;
  paidTo?: string | undefined;
  currency?: string | undefined;
  grain?: PaymentOverviewGrain | undefined;
};

/** Date inputs (YYYY-MM-DD) from `days` days before `now` to `now`, in UTC. */
export function paymentsRangeBefore(
  days: number,
  now: Date = new Date(),
): { from: string; to: string } {
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

/** The overview's default date inputs (YYYY-MM-DD): the 34 days up to `now`, in UTC. */
export function paymentOverviewDefaultRange(now: Date = new Date()): { from: string; to: string } {
  return paymentsRangeBefore(34, now);
}

/** What the overview opens on, besides its range; the server loads the first one with it too. */
export const PAYMENT_OVERVIEW_DEFAULTS = { currency: "", grain: "day" } as const satisfies {
  currency: string;
  grain: PaymentOverviewGrain;
};

export function paymentOverviewPath(filters: PaymentOverviewFilters): string {
  return `/api/v1/reports/payments/overview${buildQuery({
    paidFrom: filters.paidFrom,
    paidTo: filters.paidTo,
    currency: filters.currency,
    grain: filters.grain,
  })}`;
}

export async function fetchPaymentOverview(filters: PaymentOverviewFilters) {
  return clientApi.get<{ data: PaymentOverview }>(paymentOverviewPath(filters));
}

/*
 * What each Payments page opens on. The server loads the first page with the
 * same values, so the page can skip its first browser load.
 */

/** The transactions ledger: the 34 days up to today, newest payment first. */
export const PAYMENT_TRANSACTIONS_DEFAULTS = {
  rangeDays: 34,
  dateField: "paid_at",
  sortBy: "paid_at",
  sortDir: "desc",
  columns: [
    "learner_name",
    "email",
    "product_title",
    "product_type",
    "gateway_key",
    "coupon_amount_cents",
    "amount_cents",
    "currency",
    "status",
    "invoice_number",
    "paid_at",
  ],
  page: 1,
  limit: 12,
} as const satisfies {
  rangeDays: number;
  dateField: "paid_at" | "created_at";
  sortBy: string;
  sortDir: "asc" | "desc";
  columns: readonly PaymentTransactionColumnKey[];
  page: number;
  limit: number;
};

/** The invoices ledger: the 29 days up to today, newest payment first. */
export const PAYMENT_INVOICES_DEFAULTS = {
  rangeDays: 29,
  sortBy: "paid_at",
  sortDir: "desc",
  columns: [
    "invoice_number",
    "learner_name",
    "email",
    "billing_name",
    "product_title",
    "amount_cents",
    "tax_amount_cents",
    "currency",
    "paid_at",
  ],
  page: 1,
  limit: 12,
} as const satisfies {
  rangeDays: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  columns: readonly PaymentInvoiceColumnKey[];
  page: number;
  limit: number;
};

/** The instalment plans ledger: newest plan first. */
export const PAYMENT_INSTALMENTS_DEFAULTS = {
  sortBy: "created_at",
  sortDir: "desc",
  columns: [
    "learner_name",
    "email",
    "product_title",
    "pricing_plan_label",
    "remaining_amount_cents",
    "total_amount_cents",
    "status",
    "next_due_at",
  ],
  page: 1,
  limit: 12,
} as const satisfies {
  sortBy: string;
  sortDir: "asc" | "desc";
  columns: readonly PaymentInstalmentColumnKey[];
  page: number;
  limit: number;
};

/** The refunds ledger: the refundable queue, newest payment first. */
export const PAYMENT_REFUNDS_DEFAULTS = {
  queue: "refundable",
  sortBy: "paid_at",
  sortDir: "desc",
  page: 1,
  limit: 20,
} as const satisfies {
  queue: PaymentRefundsQueue;
  sortBy: string;
  sortDir: "asc" | "desc";
  page: number;
  limit: number;
};

/** The gateways list and a gateway's page cover the 29 days up to today. */
export const PAYMENT_GATEWAYS_RANGE_DAYS = 29;

/** A gateway's transactions tab, which its page opens on. */
export const PAYMENT_GATEWAY_TRANSACTIONS_DEFAULTS = {
  sortBy: "paid_at",
  sortDir: "desc",
  columns: [
    "learner_name",
    "email",
    "product_title",
    "amount_cents",
    "currency",
    "status",
    "paid_at",
  ],
  page: 1,
  limit: 12,
} as const satisfies {
  sortBy: string;
  sortDir: "asc" | "desc";
  columns: readonly PaymentTransactionColumnKey[];
  page: number;
  limit: number;
};

export type PaymentTransactionsFilters = {
  paidFrom?: string | undefined;
  paidTo?: string | undefined;
  learnerName?: string | undefined;
  productType?: string | undefined;
  gatewayKey?: string | undefined;
  status?: string | undefined;
  amountMinCents?: number | undefined;
  dateField?: "paid_at" | "created_at" | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  columns?: readonly PaymentTransactionColumnKey[] | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};

export function paymentTransactionsPath(filters: PaymentTransactionsFilters): string {
  return `/api/v1/reports/payments/transactions${buildQuery({
    paidFrom: filters.paidFrom,
    paidTo: filters.paidTo,
    learnerName: filters.learnerName,
    productType: filters.productType,
    gatewayKey: filters.gatewayKey,
    status: filters.status,
    amountMinCents: filters.amountMinCents,
    dateField: filters.dateField,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    columns: filters.columns?.join(","),
    page: filters.page,
    limit: filters.limit,
  })}`;
}

export async function fetchPaymentTransactions(filters: PaymentTransactionsFilters) {
  return clientApi.get<{ data: PaymentTransactionsPayload }>(paymentTransactionsPath(filters));
}

type PaymentRangeFilters = { paidFrom?: string | undefined; paidTo?: string | undefined };

export function paymentGatewaysPath(filters?: PaymentRangeFilters): string {
  return `/api/v1/reports/payments/gateways${buildQuery({
    paidFrom: filters?.paidFrom,
    paidTo: filters?.paidTo,
  })}`;
}

export async function fetchPaymentGateways(filters?: PaymentRangeFilters) {
  return clientApi.get<{ data: PaymentGatewaysList }>(paymentGatewaysPath(filters));
}

export function paymentGatewayDetailPath(
  gatewayKey: string,
  filters?: PaymentRangeFilters,
): string {
  return `/api/v1/reports/payments/gateways/${encodeURIComponent(gatewayKey)}${buildQuery({
    paidFrom: filters?.paidFrom,
    paidTo: filters?.paidTo,
  })}`;
}

export async function fetchPaymentGatewayDetail(gatewayKey: string, filters?: PaymentRangeFilters) {
  return clientApi.get<{ data: PaymentGatewayDetail }>(
    paymentGatewayDetailPath(gatewayKey, filters),
  );
}

export type PaymentRefundsFilters = {
  queue?: PaymentRefundsQueue | undefined;
  paidFrom?: string | undefined;
  paidTo?: string | undefined;
  q?: string | undefined;
  gatewayKey?: string | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};

export function paymentRefundsPath(filters: PaymentRefundsFilters): string {
  return `/api/v1/reports/payments/refunds${buildQuery({
    queue: filters.queue,
    paidFrom: filters.paidFrom,
    paidTo: filters.paidTo,
    q: filters.q,
    gatewayKey: filters.gatewayKey,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    page: filters.page,
    limit: filters.limit,
  })}`;
}

export async function fetchPaymentRefunds(filters: PaymentRefundsFilters) {
  return clientApi.get<{ data: PaymentRefundsList }>(paymentRefundsPath(filters));
}

export type PaymentGatewayTransactionsFilters = {
  paidFrom?: string | undefined;
  paidTo?: string | undefined;
  learnerName?: string | undefined;
  productType?: string | undefined;
  status?: string | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  columns?: readonly PaymentTransactionColumnKey[] | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};

export function paymentGatewayTransactionsPath(
  gatewayKey: string,
  filters: PaymentGatewayTransactionsFilters,
): string {
  return `/api/v1/reports/payments/gateways/${encodeURIComponent(gatewayKey)}/transactions${buildQuery(
    {
      paidFrom: filters.paidFrom,
      paidTo: filters.paidTo,
      learnerName: filters.learnerName,
      productType: filters.productType,
      status: filters.status,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      columns: filters.columns?.join(","),
      page: filters.page,
      limit: filters.limit,
    },
  )}`;
}

export async function fetchGatewayTransactions(
  gatewayKey: string,
  filters: PaymentGatewayTransactionsFilters,
) {
  return clientApi.get<{ data: PaymentTransactionsPayload }>(
    paymentGatewayTransactionsPath(gatewayKey, filters),
  );
}

export async function setPaymentGatewayPublished(gatewayId: string, published: boolean) {
  return clientApi.put<{
    data: {
      id: string;
      gatewayKey: string;
      displayName: string;
      isPublished: boolean;
    };
  }>(
    `/api/v1/learner-billing/payment-gateways/${gatewayId}/publish`,
    { published },
    "publish-payment-gateway",
    {
      successMessage: published ? "Payment gateway published." : "Payment gateway unpublished.",
    },
  );
}

export type PaymentInvoicesFilters = {
  paidFrom?: string | undefined;
  paidTo?: string | undefined;
  learnerName?: string | undefined;
  email?: string | undefined;
  q?: string | undefined;
  currency?: string | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  columns?: readonly PaymentInvoiceColumnKey[] | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};

export function paymentInvoicesPath(filters: PaymentInvoicesFilters): string {
  return `/api/v1/reports/payments/invoices${buildQuery({
    paidFrom: filters.paidFrom,
    paidTo: filters.paidTo,
    learnerName: filters.learnerName,
    email: filters.email,
    q: filters.q,
    currency: filters.currency,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    columns: filters.columns?.join(","),
    page: filters.page,
    limit: filters.limit,
  })}`;
}

export async function fetchPaymentInvoices(filters: PaymentInvoicesFilters) {
  return clientApi.get<{ data: PaymentInvoicesPayload }>(paymentInvoicesPath(filters));
}

export function paymentInvoiceDetailPath(orderId: string): string {
  return `/api/v1/reports/payments/invoices/${encodeURIComponent(orderId)}`;
}

export async function downloadPaymentInvoice(orderId: string) {
  return clientApi.get<{ data: PaymentInvoiceDetail }>(paymentInvoiceDetailPath(orderId));
}

export async function fetchPaymentInvoiceDetail(orderId: string) {
  return downloadPaymentInvoice(orderId);
}

export async function voidPaymentInvoice(
  orderId: string,
  body: { reason: "issued_in_error" | "duplicate" | "amount_incorrect" | "order_refunded" },
) {
  return clientApi.post<{
    data: {
      orderId: string;
      invoiceNumber: string;
      status: "void";
      voidedAt: string;
      voidReason: string;
    };
  }>(`/api/v1/reports/payments/invoices/${orderId}/void`, body, "payments-invoice-void", {
    successMessage: "Invoice voided.",
  });
}

export type PaymentTransactionDetail = {
  id: string;
  displayId: string;
  membershipId: string | null;
  status: string;
  currency: string;
  amountCents: number;
  couponAmountCents: number | null;
  taxAmountCents: number | null;
  subtotalCents: number;
  gatewayFeeCents: number | null;
  netSettledCents: number | null;
  couponCode: string | null;
  gatewayKey: string | null;
  externalId: string | null;
  invoiceNumber: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  environment: "live" | "test" | "unknown";
  learner: {
    membershipId: string | null;
    name: string | null;
    email: string | null;
  };
  product: {
    title: string | null;
    type: string | null;
    sku: string | null;
    courseId: string | null;
    accessStatus: string | null;
  };
  billing: {
    name: string | null;
    addressLines: string[];
    taxId: string | null;
  };
  gateway: {
    provider: string | null;
    methodLabel: string | null;
    brand: string | null;
    last4: string | null;
    networkRef: string | null;
  };
  risk: {
    label: string;
    score: number | null;
    summary: string | null;
  } | null;
  flow: Array<{
    key: "created" | "authorized" | "captured" | "settled" | "refunded" | "failed";
    label: string;
    status: "complete" | "current" | "pending" | "skipped";
    occurredAt: string | null;
  }>;
  events: Array<{
    id: string;
    kind: string;
    label: string;
    description: string;
    occurredAt: string;
    highlight: boolean;
  }>;
  refunds: Array<{
    id: string;
    status: RefundStatus;
    fulfillment: "gateway" | "manual_adjustment" | "legacy_recorded";
    gatewayRefundId?: string;
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
  }>;
  refundedAmountCents: number;
  refundableAmountCents: number;
  canRefund: boolean;
  canDownloadInvoice: boolean;
  reservedRefundAmountCents: number;
  metadata: Record<string, unknown> | null;
};

export function paymentTransactionDetailPath(orderId: string): string {
  return `/api/v1/reports/payments/transactions/${encodeURIComponent(orderId)}`;
}

export async function fetchPaymentTransactionDetail(orderId: string) {
  return clientApi.get<{ data: PaymentTransactionDetail }>(paymentTransactionDetailPath(orderId));
}

export async function refundPaymentTransaction(
  orderId: string,
  body: {
    refundRequestId: string;
    refundMethod?: "gateway" | "manual_adjustment";
    manualReference?: string;
    mode: "full" | "partial";
    amountCents?: number | undefined;
    reason: "duplicate" | "fraudulent" | "customer_requested" | "other";
    note: string;
    revokeAccess?: boolean | undefined;
    notifyLearner?: boolean | undefined;
  },
) {
  return clientApi.post<{
    data: {
      orderId: string;
      status: string;
      refund: PaymentTransactionDetail["refunds"][number];
      refundedAmountCents: number;
      refundableAmountCents: number;
      accessRevoked: boolean;
      notifyQueued: boolean;
      gatewayNote: string;
    };
  }>(
    `/api/v1/reports/payments/transactions/${orderId}/refund`,
    body,
    `payments-refund-${orderId}-${body.refundRequestId}`,
    { silent: true },
  );
}

export type PaymentInstalmentsFilters = {
  learnerName?: string | undefined;
  email?: string | undefined;
  q?: string | undefined;
  status?: string | undefined;
  productTitle?: string | undefined;
  pricingPlanLabel?: string | undefined;
  nextDue?: "overdue" | "7days" | "30days" | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  columns?: readonly PaymentInstalmentColumnKey[] | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};

export function paymentInstalmentsPath(filters: PaymentInstalmentsFilters): string {
  return `/api/v1/reports/payments/instalments${buildQuery({
    learnerName: filters.learnerName,
    email: filters.email,
    q: filters.q,
    status: filters.status,
    productTitle: filters.productTitle,
    pricingPlanLabel: filters.pricingPlanLabel,
    nextDue: filters.nextDue,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    columns: filters.columns?.join(","),
    page: filters.page,
    limit: filters.limit,
  })}`;
}

export async function fetchPaymentInstalments(filters: PaymentInstalmentsFilters) {
  return clientApi.get<{ data: PaymentInstalmentsPayload }>(paymentInstalmentsPath(filters));
}

export function paymentInstalmentDetailPath(planId: string): string {
  return `/api/v1/reports/payments/instalments/${encodeURIComponent(planId)}`;
}

export async function fetchPaymentInstalmentDetail(planId: string) {
  return clientApi.get<{ data: PaymentInstalmentPlanDetail }>(paymentInstalmentDetailPath(planId));
}

/** A course the new-plan form offers as the plan's product. */
export type PaymentInstalmentCourseOption = {
  id: string;
  title: string;
  priceCents: number | null;
  currency: string | null;
  status?: string;
};

/** The courses the new-plan form lists. */
export const PAYMENT_INSTALMENT_COURSES_PATH = "/api/v1/courses?view=studio&limit=100";

export async function fetchPaymentInstalmentCourses() {
  return clientApi.get<{ data: { items: PaymentInstalmentCourseOption[] } }>(
    PAYMENT_INSTALMENT_COURSES_PATH,
  );
}

export async function createPaymentInstalmentPlan(body: {
  membershipId: string;
  productTitle: string;
  productType?: string | undefined;
  productId?: string | undefined;
  pricingPlanLabel?: string | undefined;
  totalAmountCents: number;
  currency?: string | undefined;
  instalments: Array<{ amountCents: number; dueAt: string }>;
  accessPolicy?: "immediate" | "after_first_payment" | undefined;
  automatedReminders?: boolean | undefined;
  autoRevokeOnDefault?: boolean | undefined;
  sendConfirmationEmail?: boolean | undefined;
}) {
  return clientApi.post<{ data: PaymentInstalmentPlanItem }>(
    "/api/v1/reports/payments/instalments",
    body,
    "payments-instalment-create",
    { successMessage: "Instalment plan created." },
  );
}

export async function payPaymentInstalment(
  planId: string,
  body?: {
    instalmentId?: string | undefined;
    paymentMethod?: "gateway" | "bank" | "cash" | "adjustment" | undefined;
    gatewayKey?: string | undefined;
    reference?: string | undefined;
    paidAt?: string | undefined;
    sendReceipt?: boolean | undefined;
  },
) {
  return clientApi.post<{
    data: {
      planId: string;
      instalmentId: string;
      paymentOrderId: string;
      remainingAmountCents: number;
      planStatus: string;
      receiptQueued: boolean;
    };
  }>(`/api/v1/reports/payments/instalments/${planId}/pay`, body ?? {}, "payments-instalment-pay", {
    successMessage: "Instalment marked as paid.",
  });
}

export async function cancelPaymentInstalmentPlan(
  planId: string,
  body: {
    reason: PaymentInstalmentCancelReason;
    accessOption: "keep" | "revoke";
  },
) {
  return clientApi.post<{
    data: {
      planId: string;
      status: "cancelled";
      cancelledAt: string;
      reason: PaymentInstalmentCancelReason;
      accessOption: "keep" | "revoke";
      voidedInstalmentCount: number;
    };
  }>(`/api/v1/reports/payments/instalments/${planId}/cancel`, body, "payments-instalment-cancel", {
    successMessage: "Instalment plan cancelled.",
  });
}

export async function exportPaymentTransactions(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/payments/transactions/export",
    body,
    "payments-transactions-export",
    { successMessage: "Payments export queued." },
  );
}

export async function exportPaymentInvoices(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/payments/invoices/export",
    body,
    "payments-invoices-export",
    { successMessage: "Invoices export queued." },
  );
}

export async function exportPaymentInstalments(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/payments/instalments/export",
    body,
    "payments-instalments-export",
    { successMessage: "Instalments export queued." },
  );
}

export async function exportGatewayTransactions(gatewayKey: string, body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    `/api/v1/reports/payments/gateways/${encodeURIComponent(gatewayKey)}/export`,
    body,
    "payments-gateway-export",
    { successMessage: "Gateway transactions export queued." },
  );
}
