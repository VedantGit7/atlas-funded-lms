"use client";

import { clientApi } from "../../../lib/client-api";

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

export type PaymentInstalmentColumnKey =
  (typeof PAYMENT_INSTALMENT_COLUMN_OPTIONS)[number]["key"];

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
  currency: string;
  status: string;
  invoiceNumber: string | null;
  paidAt: string | null;
  createdAt: string;
  canRefund: boolean;
  refundCount: number;
  latestRefund: {
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
  } | null;
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
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

export async function fetchPaymentOverview(filters: {
  paidFrom?: string;
  paidTo?: string;
  currency?: string;
  grain?: PaymentOverviewGrain;
}) {
  return clientApi.get<{ data: PaymentOverview }>(
    `/api/v1/reports/payments/overview${buildQuery({
      paidFrom: filters.paidFrom,
      paidTo: filters.paidTo,
      currency: filters.currency,
      grain: filters.grain,
    })}`,
  );
}

export async function fetchPaymentTransactions(filters: {
  paidFrom?: string;
  paidTo?: string;
  learnerName?: string;
  productType?: string;
  gatewayKey?: string;
  status?: string;
  amountMinCents?: number;
  dateField?: "paid_at" | "created_at";
  sortBy?: string;
  sortDir?: "asc" | "desc";
  columns?: PaymentTransactionColumnKey[];
  page?: number;
  limit?: number;
}) {
  return clientApi.get<{
    data: {
      items: PaymentTransactionItem[];
      pageInfo: PageInfo;
      columns: string[];
      totals: {
        pageAmountCents: number;
        filteredAmountCents: number;
        currency: string;
      };
    };
  }>(
    `/api/v1/reports/payments/transactions${buildQuery({
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
    })}`,
  );
}

export async function fetchPaymentGateways(filters?: {
  paidFrom?: string;
  paidTo?: string;
}) {
  return clientApi.get<{ data: PaymentGatewaysList }>(
    `/api/v1/reports/payments/gateways${buildQuery({
      paidFrom: filters?.paidFrom,
      paidTo: filters?.paidTo,
    })}`,
  );
}

export async function fetchPaymentGatewayDetail(
  gatewayKey: string,
  filters?: { paidFrom?: string; paidTo?: string },
) {
  return clientApi.get<{ data: PaymentGatewayDetail }>(
    `/api/v1/reports/payments/gateways/${encodeURIComponent(gatewayKey)}${buildQuery({
      paidFrom: filters?.paidFrom,
      paidTo: filters?.paidTo,
    })}`,
  );
}

export async function fetchPaymentRefunds(filters: {
  queue?: PaymentRefundsQueue;
  paidFrom?: string;
  paidTo?: string;
  q?: string;
  gatewayKey?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  limit?: number;
}) {
  return clientApi.get<{ data: PaymentRefundsList }>(
    `/api/v1/reports/payments/refunds${buildQuery({
      queue: filters.queue,
      paidFrom: filters.paidFrom,
      paidTo: filters.paidTo,
      q: filters.q,
      gatewayKey: filters.gatewayKey,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      page: filters.page,
      limit: filters.limit,
    })}`,
  );
}

export async function fetchGatewayTransactions(
  gatewayKey: string,
  filters: {
    paidFrom?: string;
    paidTo?: string;
    learnerName?: string;
    productType?: string;
    status?: string;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    columns?: PaymentTransactionColumnKey[];
    page?: number;
    limit?: number;
  },
) {
  return clientApi.get<{
    data: {
      items: PaymentTransactionItem[];
      pageInfo: PageInfo;
      columns: string[];
      totals: {
        pageAmountCents: number;
        filteredAmountCents: number;
        currency: string;
      };
    };
  }>(
    `/api/v1/reports/payments/gateways/${encodeURIComponent(gatewayKey)}/transactions${buildQuery({
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
    })}`,
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

export async function fetchPaymentInvoices(filters: {
  paidFrom?: string;
  paidTo?: string;
  learnerName?: string;
  email?: string;
  q?: string;
  currency?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  columns?: PaymentInvoiceColumnKey[];
  page?: number;
  limit?: number;
}) {
  return clientApi.get<{
    data: {
      items: PaymentInvoiceItem[];
      pageInfo: PageInfo;
      columns: string[];
      totals: {
        pageByCurrency: Array<{ currency: string; amountCents: number }>;
        filteredByCurrency: Array<{ currency: string; amountCents: number }>;
      };
    };
  }>(
    `/api/v1/reports/payments/invoices${buildQuery({
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
    })}`,
  );
}

export async function downloadPaymentInvoice(orderId: string) {
  return clientApi.get<{ data: PaymentInvoiceDetail }>(
    `/api/v1/reports/payments/invoices/${orderId}`,
  );
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
  metadata: Record<string, unknown> | null;
};

export async function fetchPaymentTransactionDetail(orderId: string) {
  return clientApi.get<{ data: PaymentTransactionDetail }>(
    `/api/v1/reports/payments/transactions/${orderId}`,
  );
}

export async function refundPaymentTransaction(
  orderId: string,
  body: {
    mode: "full" | "partial";
    amountCents?: number;
    reason: "duplicate" | "fraudulent" | "customer_requested" | "other";
    note: string;
    revokeAccess?: boolean;
    notifyLearner?: boolean;
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
    `payments-refund-${orderId}`,
    { successMessage: "Refund recorded on the ledger." },
  );
}

export async function fetchPaymentInstalments(filters: {
  learnerName?: string;
  email?: string;
  q?: string;
  status?: string;
  productTitle?: string;
  pricingPlanLabel?: string;
  nextDue?: "overdue" | "7days" | "30days";
  sortBy?: string;
  sortDir?: "asc" | "desc";
  columns?: PaymentInstalmentColumnKey[];
  page?: number;
  limit?: number;
}) {
  return clientApi.get<{
    data: {
      items: PaymentInstalmentPlanItem[];
      pageInfo: PageInfo;
      columns: string[];
      summary: PaymentInstalmentSummary;
    };
  }>(
    `/api/v1/reports/payments/instalments${buildQuery({
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
    })}`,
  );
}

export async function fetchPaymentInstalmentDetail(planId: string) {
  return clientApi.get<{ data: PaymentInstalmentPlanDetail }>(
    `/api/v1/reports/payments/instalments/${planId}`,
  );
}

export async function createPaymentInstalmentPlan(body: {
  membershipId: string;
  productTitle: string;
  productType?: string;
  productId?: string;
  pricingPlanLabel?: string;
  totalAmountCents: number;
  currency?: string;
  instalments: Array<{ amountCents: number; dueAt: string }>;
  accessPolicy?: "immediate" | "after_first_payment";
  automatedReminders?: boolean;
  autoRevokeOnDefault?: boolean;
  sendConfirmationEmail?: boolean;
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
    instalmentId?: string;
    paymentMethod?: "gateway" | "bank" | "cash" | "adjustment";
    gatewayKey?: string;
    reference?: string;
    paidAt?: string;
    sendReceipt?: boolean;
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
  }>(
    `/api/v1/reports/payments/instalments/${planId}/cancel`,
    body,
    "payments-instalment-cancel",
    { successMessage: "Instalment plan cancelled." },
  );
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

export async function exportGatewayTransactions(
  gatewayKey: string,
  body: Record<string, unknown>,
) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    `/api/v1/reports/payments/gateways/${encodeURIComponent(gatewayKey)}/export`,
    body,
    "payments-gateway-export",
    { successMessage: "Gateway transactions export queued." },
  );
}
