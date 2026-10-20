import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ paths: [] as string[], failing: [] as string[] }));
vi.mock("../../../frontend/apps/web/src/lib/server-api", () => ({
  serverApi: {
    get: (path: string) => {
      state.paths.push(path);
      return state.failing.some((part) => path.includes(part))
        ? Promise.reject(new Error("The report is unavailable."))
        : Promise.resolve({ data: { path } });
    },
  },
}));

const payments =
  await import("../../../frontend/apps/web/src/lib/server/report-payments-initial-data");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-17T07:30:00.000Z"));
  state.paths = [];
  state.failing = [];
});

afterEach(() => {
  vi.useRealTimers();
});

const P = "/api/v1/reports/payments";
const LAST_34_DAYS = "paidFrom=2026-09-13T00%3A00%3A00.000Z&paidTo=2026-10-17T23%3A59%3A59.999Z";
const LAST_29_DAYS = "paidFrom=2026-09-18T00%3A00%3A00.000Z&paidTo=2026-10-17T23%3A59%3A59.999Z";
const TRANSACTION_COLUMNS =
  "columns=learner_name%2Cemail%2Cproduct_title%2Cproduct_type%2Cgateway_key%2Ccoupon_amount_cents%2Camount_cents%2Ccurrency%2Cstatus%2Cinvoice_number%2Cpaid_at";

/*
 * Each Payments page skips its first browser load when the server sent data,
 * so the server must ask for exactly what that load would have. These are the
 * requests the pages made in the browser before they were server-rendered.
 */
describe("Payments initial data", () => {
  it("asks for what each page's first browser load would", async () => {
    await payments.loadPaymentTransactionsData(null);
    await payments.loadPaymentTransactionDetailData("ord-1");
    await payments.loadPaymentRefundsData();
    await payments.loadPaymentInvoicesData();
    await payments.loadPaymentInvoiceData("ord-1");
    await payments.loadPaymentInstalmentsData();
    await payments.loadPaymentInstalmentPlanData("plan-1");
    await payments.loadPaymentInstalmentCoursesData();
    await payments.loadPaymentGatewaysData();
    await payments.loadPaymentGatewayData("stripe");
    expect(state.paths).toEqual([
      `${P}/transactions?${LAST_34_DAYS}&dateField=paid_at&sortBy=paid_at&sortDir=desc&${TRANSACTION_COLUMNS}&page=1&limit=12`,
      `${P}/gateways`,
      `${P}/transactions/ord-1`,
      `${P}/refunds?queue=refundable&sortBy=paid_at&sortDir=desc&page=1&limit=20`,
      `${P}/invoices?${LAST_29_DAYS}&sortBy=paid_at&sortDir=desc&columns=invoice_number%2Clearner_name%2Cemail%2Cbilling_name%2Cproduct_title%2Camount_cents%2Ctax_amount_cents%2Ccurrency%2Cpaid_at&page=1&limit=12`,
      `${P}/invoices/ord-1`,
      `${P}/instalments?sortBy=created_at&sortDir=desc&columns=learner_name%2Cemail%2Cproduct_title%2Cpricing_plan_label%2Cremaining_amount_cents%2Ctotal_amount_cents%2Cstatus%2Cnext_due_at&page=1&limit=12`,
      `${P}/instalments/plan-1`,
      "/api/v1/courses?view=studio&limit=100",
      `${P}/gateways?${LAST_29_DAYS}`,
      `${P}/gateways/stripe?${LAST_29_DAYS}`,
      `${P}/gateways/stripe/transactions?${LAST_29_DAYS}&sortBy=paid_at&sortDir=desc&columns=learner_name%2Cemail%2Cproduct_title%2Camount_cents%2Ccurrency%2Cstatus%2Cpaid_at&page=1&limit=12`,
    ]);
  });

  it("filters the ledger by the gateway in the address, read the way the page reads it", async () => {
    await payments.loadPaymentTransactionsData(" stripe ");
    await payments.loadPaymentTransactionsData("  ");
    expect(state.paths.filter((path) => path.startsWith(`${P}/transactions`))).toEqual([
      `${P}/transactions?${LAST_34_DAYS}&gatewayKey=stripe&dateField=paid_at&sortBy=paid_at&sortDir=desc&${TRANSACTION_COLUMNS}&page=1&limit=12`,
      `${P}/transactions?${LAST_34_DAYS}&dateField=paid_at&sortBy=paid_at&sortDir=desc&${TRANSACTION_COLUMNS}&page=1&limit=12`,
    ]);
  });

  it("starts the ranged pages on the range they counted", async () => {
    await expect(payments.loadPaymentTransactionsData(null)).resolves.toMatchObject({
      transactions: { range: { from: "2026-09-13", to: "2026-10-17" } },
    });
    await expect(payments.loadPaymentInvoicesData()).resolves.toMatchObject({
      range: { from: "2026-09-18", to: "2026-10-17" },
    });
    await expect(payments.loadPaymentGatewaysData()).resolves.toMatchObject({
      range: { from: "2026-09-18", to: "2026-10-17" },
    });
    await expect(payments.loadPaymentGatewayData("stripe")).resolves.toMatchObject({
      detail: { range: { from: "2026-09-18", to: "2026-10-17" } },
      transactions: { range: { from: "2026-09-18", to: "2026-10-17" } },
    });
  });

  it("keeps ids inside their own path segments", async () => {
    await payments.loadPaymentTransactionDetailData("a/b?c");
    await payments.loadPaymentInvoiceData("o/1");
    await payments.loadPaymentInstalmentPlanData("p/1");
    await payments.loadPaymentGatewayData("x/y");
    expect(state.paths).toEqual([
      `${P}/transactions/a%2Fb%3Fc`,
      `${P}/invoices/o%2F1`,
      `${P}/instalments/p%2F1`,
      `${P}/gateways/x%2Fy?${LAST_29_DAYS}`,
      `${P}/gateways/x%2Fy/transactions?${LAST_29_DAYS}&sortBy=paid_at&sortDir=desc&columns=learner_name%2Cemail%2Cproduct_title%2Camount_cents%2Ccurrency%2Cstatus%2Cpaid_at&page=1&limit=12`,
    ]);
  });

  it("loads the ledger and its gateway options independently", async () => {
    state.failing = ["/gateways"];
    await expect(payments.loadPaymentTransactionsData(null)).resolves.toMatchObject({
      transactions: { range: { from: "2026-09-13" } },
      gateways: null,
    });
    state.failing = ["/transactions"];
    await expect(payments.loadPaymentTransactionsData(null)).resolves.toMatchObject({
      transactions: null,
      gateways: { data: { path: `${P}/gateways` } },
    });
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.failing = ["/"];
    await expect(payments.loadPaymentTransactionDetailData("ord-1")).resolves.toBeNull();
    await expect(payments.loadPaymentRefundsData()).resolves.toBeNull();
    await expect(payments.loadPaymentInvoicesData()).resolves.toBeNull();
    await expect(payments.loadPaymentInvoiceData("ord-1")).resolves.toBeNull();
    await expect(payments.loadPaymentInstalmentsData()).resolves.toBeNull();
    await expect(payments.loadPaymentInstalmentPlanData("plan-1")).resolves.toBeNull();
    await expect(payments.loadPaymentInstalmentCoursesData()).resolves.toBeNull();
    await expect(payments.loadPaymentGatewaysData()).resolves.toBeNull();
    await expect(payments.loadPaymentGatewayData("stripe")).resolves.toEqual({
      detail: null,
      transactions: null,
    });
    await expect(payments.loadPaymentOrdersData()).resolves.toBeNull();
    await expect(payments.loadPaymentOrderData("ord-1")).resolves.toBeNull();
    await expect(payments.loadPaymentOrderCapabilitiesData()).resolves.toBeNull();
    await expect(payments.loadUnmatchedPaymentOrdersData()).resolves.toBeNull();
    await expect(payments.loadPaymentOrderExportSummaryData({})).resolves.toBeNull();
  });
});

const O = "/api/v1/payments/orders";

describe("Payment orders initial data", () => {
  it("asks for what each order page's first browser load would", async () => {
    await payments.loadPaymentOrdersData();
    await payments.loadPaymentOrderData("ord-1");
    await payments.loadPaymentOrderCapabilitiesData();
    await payments.loadUnmatchedPaymentOrdersData();
    await payments.loadPaymentOrderExportSummaryData({});
    expect(state.paths).toEqual([
      `${O}?limit=50`,
      `${O}/summary`,
      `${O}/ord-1`,
      `${O}/summary`,
      `${O}/unmatched?stalePendingDays=7`,
      `${O}/summary`,
    ]);
  });

  it("counts the export screen's filters the way the page reads them from the address", async () => {
    await payments.loadPaymentOrderExportSummaryData({
      status: "paid",
      currency: ["inr", "usd"],
      settlement: "bogus",
      q: " asha ",
    });
    await payments.loadPaymentOrderExportSummaryData({ settlement: "unsettled", q: "  " });
    expect(state.paths).toEqual([
      `${O}/summary?status=paid&q=asha&currency=INR`,
      `${O}/summary?settlement=unsettled`,
    ]);
  });

  it("keeps an order id inside its own path segment", async () => {
    await payments.loadPaymentOrderData("a/b?c");
    expect(state.paths).toEqual([`${O}/a%2Fb%3Fc`]);
  });

  it("gives the ledger its first page and totals together, or nothing", async () => {
    await expect(payments.loadPaymentOrdersData()).resolves.toMatchObject({
      data: { page: { path: `${O}?limit=50` }, summary: { path: `${O}/summary` } },
    });
    state.failing = ["/summary"];
    await expect(payments.loadPaymentOrdersData()).resolves.toBeNull();
    state.failing = ["?limit="];
    await expect(payments.loadPaymentOrdersData()).resolves.toBeNull();
  });
});
