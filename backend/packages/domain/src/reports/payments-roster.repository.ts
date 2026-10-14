import { paymentsRosterInvoicesRepository } from "./payments-roster-invoices.repository";
import { paymentsRosterTransactionsRepository } from "./payments-roster-transactions.repository";
import { paymentsRosterGatewaysRepository } from "./payments-roster-gateways.repository";
import { paymentsRosterInstalmentsRepository } from "./payments-roster-instalments.repository";
import { paymentsRosterOverviewRepository } from "./payments-roster-overview.repository";

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

/** The payments roster queries, kept in one file per report area. */
export const paymentsRosterRepository = {
  ...paymentsRosterInvoicesRepository,
  ...paymentsRosterTransactionsRepository,
  ...paymentsRosterGatewaysRepository,
  ...paymentsRosterInstalmentsRepository,
  ...paymentsRosterOverviewRepository,
};
