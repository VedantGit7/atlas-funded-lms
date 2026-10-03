import { describe, expect, it } from "vitest";
import {
  cancelPaymentInstalmentPlanBodySchema,
  createPaymentInstalmentPlanBodySchema,
  PAYMENT_ROSTER_COLUMNS,
  paymentGatewaysListResponseSchema,
  paymentGatewaysQuerySchema,
  paymentGatewayDetailResponseSchema,
  paymentRefundsListResponseSchema,
  paymentRefundsQuerySchema,
  paymentInstalmentPlanDetailResponseSchema,
  paymentInvoiceDetailResponseSchema,
  paymentInstalmentsListResponseSchema,
  paymentInstalmentsQuerySchema,
  paymentInvoicesListResponseSchema,
  paymentInvoicesQuerySchema,
  payPaymentInstalmentBodySchema,
  paymentOverviewQuerySchema,
  paymentOverviewResponseSchema,
  paymentTransactionDetailResponseSchema,
  paymentTransactionsQuerySchema,
  exportPaymentRosterBodySchema,
  refundPaymentTransactionBodySchema,
  refundPaymentTransactionResponseSchema,
  voidPaymentInvoiceBodySchema,
} from "@atlas/domain/reports/payments-roster.dto";

describe("payments roster dto", () => {
  it("parses transaction query defaults and column selection", () => {
    const parsed = paymentTransactionsQuerySchema.parse({
      columns: "learner_name,email,paid_at",
      sortBy: "coupon_amount_cents",
      sortDir: "asc",
      page: "2",
    });

    expect(parsed.columns).toEqual(["learner_name", "email", "paid_at"]);
    expect(parsed.sortBy).toBe("coupon_amount_cents");
    expect(parsed.sortDir).toBe("asc");
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
  });

  it("accepts already-parsed column arrays", () => {
    const parsed = paymentTransactionsQuerySchema.parse({
      columns: ["learner_name", "amount_cents"],
    });
    expect(parsed.columns).toEqual(["learner_name", "amount_cents"]);
  });

  it("falls back to all columns when selection is invalid", () => {
    const parsed = paymentTransactionsQuerySchema.parse({
      columns: "not_a_column",
    });
    expect(parsed.columns).toEqual([...PAYMENT_ROSTER_COLUMNS]);
  });

  it("accepts create plan preferences and still enforces instalment sum", () => {
    const valid = createPaymentInstalmentPlanBodySchema.parse({
      membershipId: "11111111-1111-4111-8111-111111111111",
      productTitle: "Funded Trader Foundations",
      productId: "22222222-2222-4222-8222-222222222222",
      totalAmountCents: 1249900,
      currency: "INR",
      accessPolicy: "after_first_payment",
      automatedReminders: true,
      sendConfirmationEmail: true,
      instalments: [
        { amountCents: 416600, dueAt: "2026-07-22T00:00:00.000Z" },
        { amountCents: 416600, dueAt: "2026-08-22T00:00:00.000Z" },
        { amountCents: 416700, dueAt: "2026-09-22T00:00:00.000Z" },
      ],
    });
    expect(valid.accessPolicy).toBe("after_first_payment");
    expect(valid.productId).toBe("22222222-2222-4222-8222-222222222222");

    expect(() =>
      createPaymentInstalmentPlanBodySchema.parse({
        membershipId: "11111111-1111-4111-8111-111111111111",
        productTitle: "Funded Trader Foundations",
        totalAmountCents: 1249900,
        instalments: [
          { amountCents: 400000, dueAt: "2026-07-22T00:00:00.000Z" },
          { amountCents: 400000, dueAt: "2026-08-22T00:00:00.000Z" },
          { amountCents: 400000, dueAt: "2026-09-22T00:00:00.000Z" },
        ],
      }),
    ).toThrow();
  });

  it("parses instalment plan detail with activity and cancel payload schemas", () => {
    const detail = paymentInstalmentPlanDetailResponseSchema.parse({
      data: {
        plan: {
          id: "11111111-1111-4111-8111-111111111111",
          membershipId: "22222222-2222-4222-8222-222222222222",
          learnerName: "Alex",
          email: "alex@example.com",
          productTitle: "System Architecture",
          productType: "course",
          pricingPlanLabel: "3 instalments",
          totalAmountCents: 1249900,
          remainingAmountCents: 749900,
          currency: "INR",
          status: "active",
          createdAt: "2026-06-14T11:28:00.000Z",
          nextDueAt: "2026-07-14T00:00:00.000Z",
          instalmentCount: 3,
          paidCount: 1,
          overdueCount: 1,
        },
        instalments: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            sequenceNo: 1,
            amountCents: 500000,
            dueAt: "2026-06-14T00:00:00.000Z",
            paidAt: "2026-06-14T11:30:00.000Z",
            status: "paid",
            paymentOrderId: "44444444-4444-4444-8444-444444444444",
          },
        ],
        activity: [
          {
            id: "created-1",
            kind: "created",
            label: "Plan created",
            detail: null,
            occurredAt: "2026-06-14T11:28:00.000Z",
            actorLabel: "Admin",
            tone: "neutral",
          },
        ],
        cancel: null,
      },
    });
    expect(detail.data.activity).toHaveLength(1);
    expect(detail.data.instalments[0]?.paymentOrderId).toBe("44444444-4444-4444-8444-444444444444");

    const cancelBody = cancelPaymentInstalmentPlanBodySchema.parse({
      reason: "learner_request",
      accessOption: "revoke",
    });
    expect(cancelBody.accessOption).toBe("revoke");

    const payBody = payPaymentInstalmentBodySchema.parse({
      paymentMethod: "bank",
      reference: "NEFT-99",
      paidAt: "2026-08-01T12:00:00.000Z",
      sendReceipt: true,
    });
    expect(payBody.paymentMethod).toBe("bank");
    expect(payBody.sendReceipt).toBe(true);
  });

  it("parses instalment query filters and summary response shape", () => {
    const query = paymentInstalmentsQuerySchema.parse({
      q: "Priya",
      status: "overdue",
      nextDue: "7days",
      productTitle: "React",
      sortBy: "next_due_at",
    });
    expect(query.q).toBe("Priya");
    expect(query.nextDue).toBe("7days");
    expect(query.sortBy).toBe("next_due_at");

    const list = paymentInstalmentsListResponseSchema.parse({
      data: {
        items: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            membershipId: "22222222-2222-4222-8222-222222222222",
            learnerName: "Priya",
            email: "priya@example.com",
            productTitle: "React Bootcamp",
            productType: "course",
            pricingPlanLabel: "3 instalments",
            totalAmountCents: 300000,
            remainingAmountCents: 100000,
            currency: "INR",
            status: "active",
            createdAt: "2026-07-01T00:00:00.000Z",
            nextDueAt: "2026-08-10T00:00:00.000Z",
            instalmentCount: 3,
            paidCount: 2,
            overdueCount: 0,
          },
        ],
        pageInfo: {
          page: 1,
          pageSize: 12,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        columns: ["learner_name", "product_title", "status"],
        summary: {
          currency: "INR",
          outstandingCents: 64200000,
          outstandingPlanCount: 48,
          dueNext7DaysCents: 11840000,
          overdueCents: 8720000,
          overdueInstalmentCount: 9,
          completedThisMonthCount: 23,
        },
      },
    });
    expect(list.data.summary.overdueInstalmentCount).toBe(9);
    expect(list.data.items[0]?.instalmentCount).toBe(3);
  });

  it("parses invoice query with search and currency filters", () => {
    const parsed = paymentInvoicesQuerySchema.parse({
      q: "INV-2026",
      currency: "usd",
      sortBy: "invoice_number",
      columns: "invoice_number,learner_name,amount_cents",
    });
    expect(parsed.q).toBe("INV-2026");
    expect(parsed.currency).toBe("usd");
    expect(parsed.sortBy).toBe("invoice_number");
    expect(parsed.columns).toEqual(["invoice_number", "learner_name", "amount_cents"]);
  });

  it("validates invoice list response with currency totals", () => {
    const parsed = paymentInvoicesListResponseSchema.parse({
      data: {
        items: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            membershipId: "22222222-2222-4222-8222-222222222222",
            invoiceNumber: "INV-2026-004182",
            learnerName: "Priya Raghunathan",
            email: "priya.r@example.com",
            billingName: "Acme Corp",
            billingNameDiffers: true,
            productTitle: "Advanced React Patterns",
            amountCents: 125000,
            taxAmountCents: 22500,
            currency: "USD",
            paidAt: "2026-10-24T00:00:00.000Z",
            createdAt: "2026-10-24T00:00:00.000Z",
            status: "issued",
            voidedAt: null,
          },
        ],
        pageInfo: {
          page: 1,
          pageSize: 12,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        columns: ["invoice_number", "learner_name", "amount_cents"],
        totals: {
          pageByCurrency: [{ currency: "USD", amountCents: 125000 }],
          filteredByCurrency: [{ currency: "USD", amountCents: 125000 }],
        },
      },
    });
    expect(parsed.data.items[0]?.billingNameDiffers).toBe(true);
    expect(parsed.data.totals.pageByCurrency[0]?.amountCents).toBe(125000);
  });

  it("accepts export body with q and currency", () => {
    const parsed = exportPaymentRosterBodySchema.parse({
      tab: "invoices",
      q: "Acme",
      currency: "EUR",
      emailDownloadLink: true,
    });
    expect(parsed.q).toBe("Acme");
    expect(parsed.currency).toBe("EUR");
  });

  it("validates invoice detail preview response and void body", () => {
    const detail = paymentInvoiceDetailResponseSchema.parse({
      data: {
        orderId: "11111111-1111-4111-8111-111111111111",
        displayId: "11111111",
        membershipId: "22222222-2222-4222-8222-222222222222",
        invoiceNumber: "INV-2026-004182",
        status: "issued",
        orderStatus: "paid",
        businessName: "Atlas Academy",
        learnerName: "Priya",
        email: "priya@example.com",
        billingName: "Acme Corp",
        billingNameDiffers: true,
        productTitle: "Bootcamp",
        gatewayKey: "stripe",
        amountCents: 125000,
        subtotalCents: 105932,
        discountCents: 0,
        taxAmountCents: 19068,
        taxPercent: 18,
        amountPaidCents: 125000,
        balanceDueCents: 0,
        currency: "USD",
        paidAt: "2026-07-22T14:38:00.000Z",
        createdAt: "2026-07-22T14:38:00.000Z",
        issuedAt: "2026-07-22T14:38:00.000Z",
        voidedAt: null,
        voidReason: null,
        canVoid: true,
        canDownload: true,
        timeline: [
          {
            key: "generated",
            label: "Generated",
            description: "Created",
            occurredAt: "2026-07-22T14:38:00.000Z",
            highlight: true,
          },
        ],
        filename: "INV-2026-004182.html",
        contentType: "text/html",
        content: "<html></html>",
      },
    });
    expect(detail.data.canVoid).toBe(true);
    expect(detail.data.taxPercent).toBe(18);

    const voided = voidPaymentInvoiceBodySchema.parse({ reason: "duplicate" });
    expect(voided.reason).toBe("duplicate");

    expect(() => voidPaymentInvoiceBodySchema.parse({ reason: "unknown" })).toThrow();
  });

  it("accepts export body and rejects tenant fields", () => {
    const parsed = exportPaymentRosterBodySchema.parse({
      tab: "invoices",
      emailDownloadLink: true,
    });
    expect(parsed.tab).toBe("invoices");

    expect(() =>
      exportPaymentRosterBodySchema.parse({
        tab: "transactions",
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });

  it("parses overview query defaults and currency filter", () => {
    const parsed = paymentOverviewQuerySchema.parse({
      currency: "inr",
      grain: "week",
    });
    expect(parsed.grain).toBe("week");
    expect(parsed.currency).toBe("inr");
    expect(parsed.paidFrom).toBeUndefined();

    expect(() =>
      paymentOverviewQuerySchema.parse({
        grain: "hour",
      }),
    ).toThrow();

    expect(() =>
      paymentOverviewQuerySchema.parse({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });

  it("parses gateways query and enriched list response", () => {
    const query = paymentGatewaysQuerySchema.parse({
      paidFrom: "2026-07-01T00:00:00.000Z",
      paidTo: "2026-07-31T23:59:59.999Z",
    });
    expect(query.paidFrom).toBe("2026-07-01T00:00:00.000Z");
    expect(query.paidTo).toBe("2026-07-31T23:59:59.999Z");

    expect(() =>
      paymentGatewaysQuerySchema.parse({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();

    const list = paymentGatewaysListResponseSchema.parse({
      data: {
        summary: {
          totalPaidCents: 10000,
          currency: "INR",
          windowFrom: "2026-07-01T00:00:00.000Z",
          windowTo: "2026-07-31T23:59:59.999Z",
          windowLabel: "31 days",
        },
        items: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            gatewayKey: "stripe",
            displayName: "Stripe",
            isConfigured: true,
            isPublished: true,
            isDefault: true,
            transactionCount: 12,
            paidTransactionCount: 10,
            failedCount: 2,
            paidAmountCents: 10000,
            successPercent: 83.3,
            volumeSharePercent: 100,
            currency: "INR",
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            gatewayKey: "cashfree",
            displayName: "Cashfree",
            isConfigured: false,
            isPublished: false,
            isDefault: false,
            transactionCount: 0,
            paidTransactionCount: 0,
            failedCount: 0,
            paidAmountCents: 0,
            successPercent: null,
            volumeSharePercent: 0,
            currency: "INR",
          },
        ],
      },
    });
    expect(list.data.summary.totalPaidCents).toBe(10000);
    expect(list.data.items[0]?.successPercent).toBe(83.3);
    expect(list.data.items[1]?.successPercent).toBeNull();
  });

  it("parses gateway detail response with honest capability flags", () => {
    const detail = paymentGatewayDetailResponseSchema.parse({
      data: {
        gateway: {
          id: "11111111-1111-4111-8111-111111111111",
          gatewayKey: "razorpay",
          displayName: "Razorpay",
          isConfigured: true,
          isPublished: true,
          isDefault: true,
          publishableKeyMasked: "rzp_live••••••••392",
          secretLast4: "8392",
          hasSecret: true,
          createdAt: "2026-02-14T00:00:00.000Z",
          updatedAt: "2026-07-01T12:00:00.000Z",
        },
        summary: {
          paidAmountCents: 241890000,
          previousPaidAmountCents: 215000000,
          changePercent: 12.5,
          transactionCount: 855,
          paidTransactionCount: 812,
          failedCount: 43,
          refundedCount: 8,
          successPercent: 94.6,
          currency: "INR",
          windowFrom: "2026-07-01T00:00:00.000Z",
          windowTo: "2026-07-31T23:59:59.999Z",
          windowLabel: "30 days",
        },
        capabilities: {
          feesTracked: false,
          payoutsAvailable: false,
          webhookLogAvailable: false,
        },
      },
    });
    expect(detail.data.gateway.gatewayKey).toBe("razorpay");
    expect(detail.data.capabilities.payoutsAvailable).toBe(false);
    expect(detail.data.summary.changePercent).toBe(12.5);
  });

  it("parses refunds ledger query and list response", () => {
    const query = paymentRefundsQuerySchema.parse({
      queue: "partial",
      page: "2",
    });
    expect(query.queue).toBe("partial");
    expect(query.page).toBe(2);
    expect(query.limit).toBe(25);

    expect(() =>
      paymentRefundsQuerySchema.parse({
        queue: "open_requests",
      }),
    ).toThrow();

    const list = paymentRefundsListResponseSchema.parse({
      data: {
        summary: {
          refundableCount: 3,
          partialCount: 1,
          refundedCount: 12,
          refundableAmountCents: 450000,
          refundedAmountCents: 1200000,
          currency: "INR",
          windowFrom: null,
          windowTo: null,
        },
        items: [
          {
            orderId: "11111111-1111-4111-8111-111111111111",
            membershipId: "22222222-2222-4222-8222-222222222222",
            learnerName: "Arjun Mehta",
            email: "arjun@example.com",
            productTitle: "Advanced Python Bootcamp",
            gatewayKey: "razorpay",
            amountCents: 450000,
            refundedAmountCents: 0,
            refundableAmountCents: 450000,
            currency: "INR",
            status: "paid",
            invoiceNumber: "INV-1",
            paidAt: "2026-07-01T10:00:00.000Z",
            createdAt: "2026-07-01T09:00:00.000Z",
            canRefund: true,
            refundCount: 0,
            latestRefund: null,
          },
        ],
        pageInfo: {
          page: 1,
          pageSize: 25,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        capabilities: {
          requestQueue: false,
          disputesAvailable: false,
          gatewayRefundsAutomated: false,
        },
      },
    });
    expect(list.data.summary.refundableCount).toBe(3);
    expect(list.data.capabilities.requestQueue).toBe(false);
    expect(list.data.items[0]?.canRefund).toBe(true);
    expect(list.data.items[0]?.reservedRefundAmountCents).toBe(0);
    const reservedList = paymentRefundsListResponseSchema.parse({
      data: {
        ...list.data,
        items: list.data.items.map((item) => ({
          ...item,
          reservedRefundAmountCents: 2500,
          refundableAmountCents: item.refundableAmountCents - 2500,
        })),
      },
    });
    expect(reservedList.data.items[0]?.reservedRefundAmountCents).toBe(2500);
  });

  it("parses transaction query with amount and date field filters", () => {
    const parsed = paymentTransactionsQuerySchema.parse({
      amountMinCents: "50000",
      dateField: "created_at",
      status: "paid",
    });
    expect(parsed.amountMinCents).toBe(50000);
    expect(parsed.dateField).toBe("created_at");
    expect(parsed.status).toBe("paid");
  });

  it("defaults dateField to paid_at", () => {
    const parsed = paymentTransactionsQuerySchema.parse({});
    expect(parsed.dateField).toBe("paid_at");
  });

  it("validates overview response shape", () => {
    const parsed = paymentOverviewResponseSchema.parse({
      data: {
        summary: {
          collectedCents: 10000,
          currency: "USD",
          currencies: ["USD"],
          transactionCount: 2,
          averageOrderCents: 5000,
          outstandingInstalmentCents: 1000,
          outstandingPlanCount: 1,
          failedCount: 1,
          attemptCount: 3,
          failedPercent: 33.3,
          previousCollectedCents: 8000,
          changePercent: 25,
          windowLabel: "35 days",
          windowFrom: "2026-07-01T00:00:00.000Z",
          windowTo: "2026-08-04T00:00:00.000Z",
        },
        revenueTrend: [
          {
            date: "2026-07-01",
            courseCents: 5000,
            bundleCents: 0,
            subscriptionCents: 0,
            liveClassCents: 0,
            otherCents: 0,
            totalCents: 5000,
            orderCount: 1,
          },
        ],
        byGateway: [
          {
            gatewayKey: "stripe",
            displayName: "Stripe",
            amountCents: 10000,
            percent: 100,
          },
        ],
        topProducts: [
          {
            productTitle: "Course A",
            productType: "course",
            amountCents: 10000,
            orderCount: 2,
          },
        ],
        attention: {
          unsentInvoiceCount: 0,
          overdueInstalmentCount: 1,
          failedPaymentCount: 1,
        },
        recentTransactions: [],
      },
    });
    expect(parsed.data.summary.collectedCents).toBe(10000);
    expect(parsed.data.byGateway[0]?.percent).toBe(100);
  });

  it("requires note and amount for partial refund body", () => {
    const full = refundPaymentTransactionBodySchema.parse({
      refundRequestId: "11111111-1111-4111-8111-111111111111",
      mode: "full",
      reason: "customer_requested",
      note: "Customer asked for a full refund.",
    });
    expect(full.mode).toBe("full");
    expect(full.notifyLearner).toBe(true);
    expect(full.refundMethod).toBe("gateway");

    expect(() =>
      refundPaymentTransactionBodySchema.parse({
        refundRequestId: "11111111-1111-4111-8111-111111111111",
        mode: "partial",
        reason: "duplicate",
        note: "Duplicate charge",
      }),
    ).toThrow();

    const partial = refundPaymentTransactionBodySchema.parse({
      refundRequestId: "11111111-1111-4111-8111-111111111111",
      mode: "partial",
      amountCents: 2500,
      reason: "duplicate",
      note: "Duplicate charge",
      revokeAccess: true,
      notifyLearner: false,
    });
    expect(partial.amountCents).toBe(2500);
    expect(partial.revokeAccess).toBe(true);
  });

  it("requires a UUID request identity and a reference for manual adjustments", () => {
    const body = { reason: "other", note: "Already settled outside the gateway" };
    expect(refundPaymentTransactionBodySchema.safeParse(body).success).toBe(false);
    expect(
      refundPaymentTransactionBodySchema.safeParse({ ...body, refundRequestId: "bad" }).success,
    ).toBe(false);
    const identified = {
      ...body,
      refundRequestId: "11111111-1111-4111-8111-111111111111",
      refundMethod: "manual_adjustment",
    };
    for (const manualReference of [undefined, "", "   ", "a".repeat(201)]) {
      expect(
        refundPaymentTransactionBodySchema.safeParse({ ...identified, manualReference }).success,
      ).toBe(false);
    }
    expect(
      refundPaymentTransactionBodySchema.parse({ ...identified, manualReference: " bank-123 " })
        .manualReference,
    ).toBe("bank-123");
  });

  it("preserves pending refund state and defaults old records to legacy", () => {
    const refund = {
      id: "refund-1",
      amountCents: 2500,
      reason: "duplicate",
      note: null,
      mode: "partial",
      revokeAccess: true,
      notifyLearner: false,
      accessRevoked: false,
      notifyQueued: false,
      actorMembershipId: null,
      createdAt: "2026-07-22T09:05:00.000Z",
    };
    const data = {
      orderId: "11111111-1111-4111-8111-111111111111",
      status: "paid",
      refund,
      refundedAmountCents: 0,
      refundableAmountCents: 7500,
      accessRevoked: false,
      notifyQueued: false,
      gatewayNote: "Awaiting gateway confirmation.",
    };
    const legacy = refundPaymentTransactionResponseSchema.parse({ data });
    expect(legacy.data.refund.status).toBe("legacy_recorded");
    expect(legacy.data.refund.fulfillment).toBe("legacy_recorded");
    const pending = refundPaymentTransactionResponseSchema.parse({
      data: {
        ...data,
        refund: { ...refund, status: "pending", fulfillment: "gateway", gatewayRefundId: "re_123" },
      },
    });
    expect(pending.data.refund.status).toBe("pending");
    expect(pending.data.refundedAmountCents).toBe(0);
    expect(pending.data.refund.gatewayRefundId).toBe("re_123");
  });

  it("validates transaction detail response shape", () => {
    const parsed = paymentTransactionDetailResponseSchema.parse({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        displayId: "11111111",
        membershipId: "22222222-2222-4222-8222-222222222222",
        status: "paid",
        currency: "INR",
        amountCents: 1249900,
        couponAmountCents: 187500,
        taxAmountCents: 190500,
        subtotalCents: 1500000,
        gatewayFeeCents: 25000,
        netSettledCents: 1224900,
        couponCode: "SUMMER15",
        gatewayKey: "stripe",
        externalId: "pi_3Q8xR2Kf",
        invoiceNumber: "INV-26-8F2A",
        paidAt: "2026-07-22T09:08:00.000Z",
        createdAt: "2026-07-22T09:05:00.000Z",
        updatedAt: "2026-07-22T09:08:00.000Z",
        environment: "live",
        learner: {
          membershipId: "22222222-2222-4222-8222-222222222222",
          name: "Priya",
          email: "priya@example.com",
        },
        product: {
          title: "Funded Trader Foundations",
          type: "course",
          sku: "FTF-ONL-2026",
          courseId: null,
          accessStatus: "Granted with payment",
        },
        billing: {
          name: "Priya",
          addressLines: ["Bangalore"],
          taxId: null,
        },
        gateway: {
          provider: "stripe",
          methodLabel: "Visa ending in 4242",
          brand: "Visa",
          last4: "4242",
          networkRef: "ch_3Q8xR2Kf",
        },
        risk: null,
        flow: [
          {
            key: "created",
            label: "Created",
            status: "complete",
            occurredAt: "2026-07-22T09:05:00.000Z",
          },
        ],
        events: [
          {
            id: "e1",
            kind: "order.created",
            label: "Order created",
            description: "Created",
            occurredAt: "2026-07-22T09:05:00.000Z",
            highlight: false,
          },
        ],
        refunds: [],
        refundedAmountCents: 0,
        refundableAmountCents: 1249900,
        canRefund: true,
        canDownloadInvoice: true,
        metadata: { order_id: "8F2A41C9" },
      },
    });
    expect(parsed.data.canRefund).toBe(true);
    expect(parsed.data.reservedRefundAmountCents).toBe(0);
    expect(parsed.data.displayId).toBe("11111111");
  });
});
