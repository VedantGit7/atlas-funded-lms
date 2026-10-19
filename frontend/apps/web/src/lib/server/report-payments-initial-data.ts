import "server-only";
import {
  PAYMENT_GATEWAYS_RANGE_DAYS,
  PAYMENT_GATEWAY_TRANSACTIONS_DEFAULTS,
  PAYMENT_INSTALMENTS_DEFAULTS,
  PAYMENT_INSTALMENT_COURSES_PATH,
  PAYMENT_INVOICES_DEFAULTS,
  PAYMENT_REFUNDS_DEFAULTS,
  PAYMENT_TRANSACTIONS_DEFAULTS,
  dateInputToEndIso,
  dateInputToStartIso,
  paymentGatewayDetailPath,
  paymentGatewayTransactionsPath,
  paymentGatewaysPath,
  paymentInstalmentDetailPath,
  paymentInstalmentsPath,
  paymentInvoiceDetailPath,
  paymentInvoicesPath,
  paymentRefundsPath,
  paymentTransactionDetailPath,
  paymentTransactionsPath,
  paymentsRangeBefore,
  type PaymentGatewayDetail,
  type PaymentGatewaysList,
  type PaymentInstalmentCourseOption,
  type PaymentInstalmentPlanDetail,
  type PaymentInstalmentsPayload,
  type PaymentInvoiceDetail,
  type PaymentInvoicesPayload,
  type PaymentRefundsList,
  type PaymentTransactionDetail,
  type PaymentTransactionsPayload,
} from "../../features/admin/reports/admin-payments-roster-api";
import { loadReportInitialData, type ReportInitialDataInRange } from "./report-initial-data";

/*
 * The first data each Payments page shows, loaded on the server so the page
 * arrives filled in. Every path is the one the page's own first browser load
 * would request, so the page can skip that load; each resolves null on
 * failure and the page then loads in the browser as before.
 */

async function loadInRange<T>(
  range: { from: string; to: string },
  path: string,
): Promise<ReportInitialDataInRange<T> | null> {
  const loaded = await loadReportInitialData<T>(path);
  return loaded === null ? null : { ...loaded, range };
}

/**
 * The ledger's first page over its default range, and the gateway filter's
 * options. `gateway` is the `?gateway=` the page opens filtered by, read the
 * way the page reads it.
 */
export async function loadPaymentTransactionsData(gateway: string | null) {
  const range = paymentsRangeBefore(PAYMENT_TRANSACTIONS_DEFAULTS.rangeDays);
  const { rangeDays: _rangeDays, ...defaults } = PAYMENT_TRANSACTIONS_DEFAULTS;
  const [transactions, gateways] = await Promise.all([
    loadInRange<PaymentTransactionsPayload>(
      range,
      paymentTransactionsPath({
        ...defaults,
        paidFrom: dateInputToStartIso(range.from),
        paidTo: dateInputToEndIso(range.to),
        gatewayKey: gateway?.trim() || undefined,
      }),
    ),
    loadReportInitialData<PaymentGatewaysList>(paymentGatewaysPath()),
  ]);
  return { transactions, gateways };
}

export function loadPaymentTransactionDetailData(orderId: string) {
  return loadReportInitialData<PaymentTransactionDetail>(paymentTransactionDetailPath(orderId));
}

/** The refundable queue's first page. */
export function loadPaymentRefundsData() {
  return loadReportInitialData<PaymentRefundsList>(paymentRefundsPath(PAYMENT_REFUNDS_DEFAULTS));
}

/** The invoices ledger's first page over its default range. */
export function loadPaymentInvoicesData() {
  const range = paymentsRangeBefore(PAYMENT_INVOICES_DEFAULTS.rangeDays);
  const { rangeDays: _rangeDays, ...defaults } = PAYMENT_INVOICES_DEFAULTS;
  return loadInRange<PaymentInvoicesPayload>(
    range,
    paymentInvoicesPath({
      ...defaults,
      paidFrom: dateInputToStartIso(range.from),
      paidTo: dateInputToEndIso(range.to),
    }),
  );
}

/** An invoice, keyed by its order. */
export function loadPaymentInvoiceData(orderId: string) {
  return loadReportInitialData<PaymentInvoiceDetail>(paymentInvoiceDetailPath(orderId));
}

/** The instalment plans ledger's first page. */
export function loadPaymentInstalmentsData() {
  return loadReportInitialData<PaymentInstalmentsPayload>(
    paymentInstalmentsPath(PAYMENT_INSTALMENTS_DEFAULTS),
  );
}

export function loadPaymentInstalmentPlanData(planId: string) {
  return loadReportInitialData<PaymentInstalmentPlanDetail>(paymentInstalmentDetailPath(planId));
}

/** The courses the new-plan form's product picker lists. */
export function loadPaymentInstalmentCoursesData() {
  return loadReportInitialData<{ items: PaymentInstalmentCourseOption[] }>(
    PAYMENT_INSTALMENT_COURSES_PATH,
  );
}

/** The gateways over the default range. */
export function loadPaymentGatewaysData() {
  const range = paymentsRangeBefore(PAYMENT_GATEWAYS_RANGE_DAYS);
  return loadInRange<PaymentGatewaysList>(
    range,
    paymentGatewaysPath({
      paidFrom: dateInputToStartIso(range.from),
      paidTo: dateInputToEndIso(range.to),
    }),
  );
}

/** A gateway's summary and its transactions tab's first page, over the same default range. */
export async function loadPaymentGatewayData(gatewayKey: string) {
  const range = paymentsRangeBefore(PAYMENT_GATEWAYS_RANGE_DAYS);
  const paidFrom = dateInputToStartIso(range.from);
  const paidTo = dateInputToEndIso(range.to);
  const [detail, transactions] = await Promise.all([
    loadInRange<PaymentGatewayDetail>(
      range,
      paymentGatewayDetailPath(gatewayKey, { paidFrom, paidTo }),
    ),
    loadInRange<PaymentTransactionsPayload>(
      range,
      paymentGatewayTransactionsPath(gatewayKey, {
        ...PAYMENT_GATEWAY_TRANSACTIONS_DEFAULTS,
        paidFrom,
        paidTo,
      }),
    ),
  ]);
  return { detail, transactions };
}
