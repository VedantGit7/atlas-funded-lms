import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const actorMembershipId = "018f0000-0000-7000-8000-000000000020";
const courseId = "018f0000-0000-7000-8000-000000000030";

const {
  mockFindCourseAuthProjection,
  mockFindActiveEnrollment,
  mockInsertEnrollment,
  mockPublishEnrollmentCreatedEvent,
  mockPreviewWalletSpend,
  mockSpendWalletCredits,
  mockResolveAffiliateForCheckout,
  mockApplyAffiliateCommission,
  mockApplyReferralPurchaseCredits,
  mockGetLearnerBillingConfigRow,
  mockResolvePaymentProvider,
  mockInsertRedemption,
  mockAuditWrite,
  mockFindCouponByCode,
  mockCouponAppliesToCourse,
  mockCountCouponUses,
  mockLockCouponForRedemption,
  txState,
} = vi.hoisted(() => ({
  // The fake transaction the after-commit step's own transactions run on, and
  // whether one is open (the gateway must never be called inside one).
  txState: { inTx: false, current: null as unknown },
  mockAuditWrite: vi.fn(),
  mockFindCourseAuthProjection: vi.fn(),
  mockFindActiveEnrollment: vi.fn(),
  mockInsertEnrollment: vi.fn(),
  mockPublishEnrollmentCreatedEvent: vi.fn(),
  mockPreviewWalletSpend: vi.fn(),
  mockSpendWalletCredits: vi.fn(),
  mockResolveAffiliateForCheckout: vi.fn(),
  mockApplyAffiliateCommission: vi.fn(),
  mockApplyReferralPurchaseCredits: vi.fn(),
  mockGetLearnerBillingConfigRow: vi.fn(),
  mockResolvePaymentProvider: vi.fn(),
  mockInsertRedemption: vi.fn(),
  mockFindCouponByCode: vi.fn(),
  mockCouponAppliesToCourse: vi.fn(),
  mockCountCouponUses: vi.fn(),
  mockLockCouponForRedemption: vi.fn(),
}));

vi.mock(
  "../../../backend/apps/api/src/server/courses/courses.repository",
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      findCourseAuthProjection: (...args: unknown[]) => mockFindCourseAuthProjection(...args),
    };
  },
);

vi.mock("../../../backend/apps/api/src/server/enrollments/enrollments.repository", () => ({
  findActiveEnrollment: (...args: unknown[]) => mockFindActiveEnrollment(...args),
  insertEnrollment: (...args: unknown[]) => mockInsertEnrollment(...args),
  publishEnrollmentCreatedEvent: (...args: unknown[]) => mockPublishEnrollmentCreatedEvent(...args),
}));

vi.mock("../../../backend/apps/api/src/server/sales-wallet/sales-wallet.service", () => ({
  previewWalletSpend: (...args: unknown[]) => mockPreviewWalletSpend(...args),
  spendWalletCredits: (...args: unknown[]) => mockSpendWalletCredits(...args),
}));

vi.mock("../../../backend/apps/api/src/server/sales-affiliates/sales-affiliates.service", () => ({
  resolveAffiliateForCheckout: (...args: unknown[]) => mockResolveAffiliateForCheckout(...args),
  applyAffiliateCommission: (...args: unknown[]) => mockApplyAffiliateCommission(...args),
}));

vi.mock("../../../backend/apps/api/src/server/sales-referrals/sales-referrals.service", () => ({
  applyReferralPurchaseCredits: (...args: unknown[]) => mockApplyReferralPurchaseCredits(...args),
}));

vi.mock("@atlas/db", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenantTx: async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    txState.inTx = true;
    try {
      return await fn(txState.current);
    } finally {
      txState.inTx = false;
    }
  },
}));

vi.mock("@atlas/audit", () => ({
  auditWriter: { write: (...args: unknown[]) => mockAuditWrite(...args) },
}));

vi.mock("@atlas/domain-config/repositories/learner-billing.repository", () => ({
  getLearnerBillingConfigRow: (...args: unknown[]) => mockGetLearnerBillingConfigRow(...args),
}));

vi.mock("@atlas/domain/payments/payment-provider.registry", () => ({
  PaymentProviderNotConfiguredError: class PaymentProviderNotConfiguredError extends Error {
    constructor(message?: string) {
      super(message ?? "No published default payment gateway is configured.");
      this.name = "PaymentProviderNotConfiguredError";
    }
  },
  resolvePaymentProvider: (...args: unknown[]) => mockResolvePaymentProvider(...args),
}));

vi.mock("../../../backend/apps/api/src/server/sales-coupons/sales-coupons.repository", () => ({
  salesCouponsRepository: {
    findByCode: (...args: unknown[]) => mockFindCouponByCode(...args),
    couponAppliesToCourse: (...args: unknown[]) => mockCouponAppliesToCourse(...args),
    countCouponUses: (...args: unknown[]) => mockCountCouponUses(...args),
    lockCouponForRedemption: (...args: unknown[]) => mockLockCouponForRedemption(...args),
    insertRedemption: (...args: unknown[]) => mockInsertRedemption(...args),
    list: vi.fn(),
    summary: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    replaceCourses: vi.fn(),
    setStatus: vi.fn(),
    delete: vi.fn(),
    listCourseIds: vi.fn(),
    listRedemptions: vi.fn(),
    countRedemptions: vi.fn(),
    listPublicForCourse: vi.fn(),
    listPerformance: vi.fn(),
  },
}));

import {
  completeCheckoutPurchase,
  planCheckoutPurchase,
  purchaseCheckout,
} from "../../../backend/apps/api/src/server/sales-coupons/checkout-purchase.service";
import {
  fulfillPaidCourseOrder,
  fulfillPaidCourseOrderByExternalId,
} from "../../../backend/apps/api/src/server/sales-coupons/order-fulfillment.service";
import {
  computeRazorpayWebhookSignature,
  createRazorpayPaymentProvider,
} from "../../../backend/packages/domain/src/payments/adapters/razorpay.adapter";

const ctx = { tenantId, actorMembershipId, requestId: "req-1" };

function paidCourseProjection() {
  return {
    id: courseId,
    tenantId,
    slug: "paid-course",
    title: "Paid Course",
    description: null,
    status: "PUBLISHED",
    metadataJson: { accessTier: "PAID", priceCents: 5000, currency: "USD" },
    createdByMembershipId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createTx(opts?: {
  orders?: Map<string, Record<string, unknown>>;
  claimFails?: boolean;
  /** The tenant's active domains, for return-URL checks (audit M4). */
  domains?: readonly string[];
}) {
  const orders = opts?.orders ?? new Map<string, Record<string, unknown>>();
  const executeCalls: unknown[][] = [];
  const domains = new Set(opts?.domains ?? ["app.test"]);

  const tx = {
    $queryRaw: vi.fn(async (sql: TemplateStringsArray, ...values: unknown[]) => {
      if (sql.join("?").includes("from tenant_domains")) {
        return [{ ok: domains.has(String(values[0])) }];
      }
      return [];
    }),
    $executeRawUnsafe: vi.fn(async (...args: unknown[]) => {
      executeCalls.push(args);
      const sql = String(args[0] ?? "");
      if (sql.includes("insert into payment_orders")) {
        const id = String(args[1]);
        orders.set(id, {
          gateway_key: sql.includes("gateway_key") ? String(args[7]) : null,
          id,
          membership_id: String(args[2]),
          external_id: String(args[3]),
          amount_cents: Number(args[4]),
          currency: String(args[5]),
          status: sql.includes("'pending'") ? "pending" : "paid",
          metadata_json: JSON.parse(String(args[6])),
          invoice_number: sql.includes("$10") ? String(args[10] ?? null) : null,
          tax_amount_cents: Number(args[9] ?? 0),
          coupon_amount_cents: Number(args[8] ?? 0),
        });
      }
      if (sql.includes("update payment_orders") && sql.includes("external_id = $2")) {
        const id = String(args[1]);
        const existing = orders.get(id);
        if (existing) {
          existing["external_id"] = String(args[2]);
        }
      }
      if (sql.includes("update payment_orders") && sql.includes("'duplicatePayment'")) {
        const row = orders.get(String(args[1]));
        if (row) {
          const meta = (row["metadata_json"] as Record<string, unknown>) ?? {};
          row["metadata_json"] = {
            ...meta,
            duplicatePayment: { existingEnrollmentId: String(args[2]), refundRequired: true },
          };
        }
      }
      if (sql.includes("update payment_orders") && sql.includes("paymentMismatch")) {
        const existing = orders.get(String(args[1]));
        if (existing) {
          const meta = (existing["metadata_json"] as Record<string, unknown>) ?? {};
          existing["metadata_json"] = { ...meta, paymentMismatch: JSON.parse(String(args[2])) };
        }
      }
      return 1;
    }),
    $queryRawUnsafe: vi.fn(async (...args: unknown[]) => {
      const sql = String(args[0] ?? "");
      if (sql.includes("select status, gateway_key, metadata_json from payment_orders")) {
        const row = orders.get(String(args[1]));
        return row ? [row] : [];
      }
      if (sql.includes("'checkoutSession'") && sql.includes("update payment_orders")) {
        const row = orders.get(String(args[1]));
        if (!row || !String(row["external_id"]).startsWith("pending_")) return [];
        row["external_id"] = String(args[2]);
        const meta = (row["metadata_json"] as Record<string, unknown>) ?? {};
        row["metadata_json"] = { ...meta, checkoutSession: JSON.parse(String(args[3])) };
        return [{ id: row["id"] }];
      }
      if (sql.includes("'duplicatePayment'") && sql.includes("update payment_orders")) {
        return [];
      }
      if (sql.includes("status = 'pending'") && sql.includes("membership_id = $1")) {
        return [...orders.values()]
          .filter(
            (row) =>
              row["status"] === "pending" &&
              row["membership_id"] === String(args[1]) &&
              row["gateway_key"] === String(args[2]) &&
              row["amount_cents"] === Number(args[3]) &&
              (row["metadata_json"] as Record<string, unknown>)["courseId"] === String(args[5]),
          )
          .map((row) => ({ id: row["id"] }));
      }
      if (sql.includes("update learner_billing_config")) {
        return [{ prefix: "INV", next_number: 42 }];
      }
      if (sql.includes("from payment_orders") && sql.includes("where external_id = $1")) {
        const externalId = String(args[1]);
        return [...orders.values()].filter((row) => row["external_id"] === externalId).slice(0, 2);
      }
      if (sql.includes("from payment_orders") && sql.includes("where id = $1")) {
        const id = String(args[1]);
        const row = orders.get(id);
        return row ? [row] : [];
      }
      if (sql.includes("update payment_orders") && sql.includes("status = 'paid'")) {
        if (opts?.claimFails) return [];
        const id = String(args[1]);
        const row = orders.get(id);
        if (!row || row["status"] === "paid") return [];
        row["status"] = "paid";
        row["invoice_number"] = row["invoice_number"] ?? String(args[2]);
        const meta = (row["metadata_json"] as Record<string, unknown>) ?? {};
        row["metadata_json"] = { ...meta, fulfillmentApplied: true };
        return [{ id }];
      }
      if (sql.includes("from sales_coupon_redemptions")) {
        return [];
      }
      return [];
    }),
  };

  txState.current = tx;
  return { tx: tx as never, orders, executeCalls };
}

describe("purchaseCheckout PaymentProvider flow", () => {
  beforeEach(() => {
    mockFindCourseAuthProjection.mockReset();
    mockFindActiveEnrollment.mockReset();
    mockInsertEnrollment.mockReset();
    mockPublishEnrollmentCreatedEvent.mockReset();
    mockPreviewWalletSpend.mockReset();
    mockSpendWalletCredits.mockReset();
    mockResolveAffiliateForCheckout.mockReset();
    mockApplyAffiliateCommission.mockReset();
    mockApplyReferralPurchaseCredits.mockReset();
    mockGetLearnerBillingConfigRow.mockReset();
    mockResolvePaymentProvider.mockReset();
    mockInsertRedemption.mockReset();

    mockFindCourseAuthProjection.mockResolvedValue(paidCourseProjection());
    mockFindActiveEnrollment.mockResolvedValue(null);
    mockInsertEnrollment.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000050",
      enrolledAt: new Date(),
      created: true,
    });
    mockPublishEnrollmentCreatedEvent.mockResolvedValue(undefined);
    mockPreviewWalletSpend.mockResolvedValue({
      enabled: false,
      creditsApplied: 0,
      discountCents: 0,
      availableBalance: 0,
      creditValueCents: 100,
      maxCreditsPerOrder: null,
    });
    mockResolveAffiliateForCheckout.mockResolvedValue(null);
    mockGetLearnerBillingConfigRow.mockResolvedValue({
      gst_enabled: false,
      gst_percentage: null,
    });
    mockApplyReferralPurchaseCredits.mockResolvedValue(undefined);
    mockSpendWalletCredits.mockResolvedValue(undefined);
    mockInsertRedemption.mockResolvedValue("redemption-1");
  });

  it("creates a pending order and does not enroll when amount due > 0", async () => {
    const createCheckout = vi.fn(async () => ({
      checkoutUrl: "https://checkout.stripe.test/session",
      externalId: "cs_test_123",
    }));
    mockResolvePaymentProvider.mockResolvedValue({
      gatewayKey: "stripe",
      gatewayId: "gw-1",
      provider: { createCheckout, parseWebhook: vi.fn() },
    });

    const { tx, orders } = createTx();
    const result = await purchaseCheckout(tx, ctx, {
      courseId,
      deviceType: "WEB",
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });

    expect(result.data.checkoutUrl).toBe("https://checkout.stripe.test/session");
    expect(result.data.enrollmentId).toBeNull();
    expect(result.data.created).toBe(false);
    expect(mockInsertEnrollment).not.toHaveBeenCalled();
    expect(createCheckout).toHaveBeenCalledOnce();

    const order = [...orders.values()][0];
    expect(order?.["status"]).toBe("pending");
    expect(order?.["amount_cents"]).toBe(5000);
    expect(order?.["external_id"]).toBe("cs_test_123");
  });

  it("enrolls immediately for a $0 checkout (full discount)", async () => {
    mockFindCourseAuthProjection.mockResolvedValue({
      ...paidCourseProjection(),
      metadataJson: { accessTier: "PAID", priceCents: 0, currency: "USD" },
    });

    const { tx } = createTx();
    const result = await purchaseCheckout(tx, ctx, {
      courseId,
      deviceType: "WEB",
    });

    expect(result.data.checkoutUrl).toBeNull();
    expect(result.data.enrollmentId).toBe("018f0000-0000-7000-8000-000000000050");
    expect(result.data.created).toBe(true);
    expect(mockInsertEnrollment).toHaveBeenCalledOnce();
    expect(mockResolvePaymentProvider).not.toHaveBeenCalled();
  });

  it("returns clientCheckout for razorpay without enrolling", async () => {
    const createCheckout = vi.fn(async () => ({
      externalId: "order_rzp_123",
      checkoutUrl: null,
      clientCheckout: {
        provider: "razorpay" as const,
        keyId: "rzp_test_key",
        orderId: "order_rzp_123",
        amountCents: 5000,
        currency: "INR",
        name: "Paid Course",
        description: "Paid Course",
        notes: { courseId, paymentOrderId: "ignored" },
      },
    }));
    mockResolvePaymentProvider.mockResolvedValue({
      gatewayKey: "razorpay",
      gatewayId: "gw-rzp",
      provider: { createCheckout, parseWebhook: vi.fn() },
    });

    const { tx, orders } = createTx();
    const result = await purchaseCheckout(tx, ctx, {
      courseId,
      deviceType: "WEB",
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });

    expect(result.data.checkoutUrl).toBeNull();
    expect(result.data.clientCheckout?.provider).toBe("razorpay");
    expect(result.data.clientCheckout?.orderId).toBe("order_rzp_123");
    // C1: even if a provider returns notes, the response schema must strip them before they can
    // reach Checkout.js and come back browser-controlled in the payment webhook.
    expect(result.data.clientCheckout).not.toHaveProperty("notes");
    expect(result.data.enrollmentId).toBeNull();
    expect(result.data.created).toBe(false);
    expect(mockInsertEnrollment).not.toHaveBeenCalled();
    expect(createCheckout).toHaveBeenCalledOnce();

    const order = [...orders.values()][0];
    expect(order?.["status"]).toBe("pending");
    expect(order?.["external_id"]).toBe("order_rzp_123");
  });
  it("fulfillPaidCourseOrder is idempotent for already-paid orders", async () => {
    const order = {
      id: "018f0000-0000-7000-8000-000000000060",
      membership_id: actorMembershipId,
      external_id: "cs_test_paid",
      amount_cents: 5000,
      currency: "USD",
      status: "paid",
      metadata_json: {
        kind: "course_checkout",
        courseId,
        courseTitle: "Paid Course",
        productTitle: "Paid Course",
        productType: "course",
        couponId: null,
        couponCode: null,
        affiliateId: null,
        affiliateCode: null,
        affiliateCommissionPct: null,
        originalAmountCents: 5000,
        discountCents: 0,
        walletCreditsApplied: 0,
        walletDiscountCents: 0,
        taxAmountCents: 0,
        amountAfterCouponCents: 5000,
        finalAmountCents: 5000,
        fulfillmentApplied: true,
      },
      invoice_number: "INV-00042",
      tax_amount_cents: 0,
      coupon_amount_cents: 0,
    };

    mockInsertEnrollment
      .mockResolvedValueOnce({
        id: "018f0000-0000-7000-8000-000000000050",
        enrolledAt: new Date(),
        created: true,
      })
      .mockResolvedValueOnce({
        id: "018f0000-0000-7000-8000-000000000050",
        enrolledAt: new Date(),
        created: false,
      });

    const { tx } = createTx();
    const first = await fulfillPaidCourseOrder(tx, ctx, order);
    const second = await fulfillPaidCourseOrder(tx, ctx, order);

    expect(first.enrollmentId).toBe(second.enrollmentId);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(mockSpendWalletCredits).not.toHaveBeenCalled();
    expect(mockInsertRedemption).not.toHaveBeenCalled();
    expect(mockApplyReferralPurchaseCredits).not.toHaveBeenCalled();
  });
});

describe("fulfillPaidCourseOrderByExternalId (audit finding C1)", () => {
  const cheapOrderId = "018f0000-0000-7000-8000-0000000000a1";
  const expensiveOrderId = "018f0000-0000-7000-8000-0000000000b2";
  const expensiveCourseId = "018f0000-0000-7000-8000-0000000000c3";

  function pendingOrder(args: {
    id: string;
    externalId: string;
    amountCents: number;
    courseId: string;
    currency?: string;
  }): Record<string, unknown> {
    return {
      id: args.id,
      membership_id: actorMembershipId,
      external_id: args.externalId,
      amount_cents: args.amountCents,
      currency: args.currency ?? "INR",
      status: "pending",
      metadata_json: {
        kind: "course_checkout",
        courseId: args.courseId,
        courseTitle: "Course",
        productTitle: "Course",
        productType: "course",
        originalAmountCents: args.amountCents,
        discountCents: 0,
        walletCreditsApplied: 0,
        walletDiscountCents: 0,
        taxAmountCents: 0,
        amountAfterCouponCents: args.amountCents,
        finalAmountCents: args.amountCents,
      },
      invoice_number: null,
      tax_amount_cents: 0,
      coupon_amount_cents: 0,
    };
  }

  function twoPendingOrders() {
    const orders = new Map<string, Record<string, unknown>>();
    orders.set(
      cheapOrderId,
      pendingOrder({
        id: cheapOrderId,
        externalId: "order_cheap",
        amountCents: 1_000,
        courseId,
      }),
    );
    orders.set(
      expensiveOrderId,
      pendingOrder({
        id: expensiveOrderId,
        externalId: "order_expensive",
        amountCents: 1_000_000,
        courseId: expensiveCourseId,
      }),
    );
    return orders;
  }

  beforeEach(() => {
    mockInsertEnrollment.mockReset();
    mockPublishEnrollmentCreatedEvent.mockReset();
    mockApplyReferralPurchaseCredits.mockReset();
    mockInsertEnrollment.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000050",
      enrolledAt: new Date(),
      created: true,
    });
  });

  it("fulfils only the order bound to the paid gateway reference, never a hinted one", async () => {
    const orders = twoPendingOrders();
    const { tx } = createTx({ orders });

    // The attacker pays for the cheap order. Whatever they put in checkout notes, the only order
    // that may be fulfilled is the one the server bound to this Razorpay order id at checkout.
    const result = await fulfillPaidCourseOrderByExternalId(tx, ctx, {
      externalId: "order_cheap",
      amountCents: 1_000,
      currency: "INR",
    });

    expect(result?.paymentOrderId).toBe(cheapOrderId);
    expect(orders.get(cheapOrderId)?.["status"]).toBe("paid");
    expect(orders.get(expensiveOrderId)?.["status"]).toBe("pending");
    expect(orders.get(expensiveOrderId)?.["external_id"]).toBe("order_expensive");
    expect(mockInsertEnrollment).toHaveBeenCalledOnce();
    expect(mockInsertEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({ courseId, membershipId: actorMembershipId }),
    );
  });

  it("end to end: a signed webhook for the cheap order with notes naming the expensive one", async () => {
    const orders = twoPendingOrders();
    const { tx } = createTx({ orders });
    const webhookSecret = "whsec_rzp";
    const provider = createRazorpayPaymentProvider({
      keyId: "rzp_test_key",
      secretKey: "rzp_test_secret",
      webhookSecret,
    });

    // Exactly what Razorpay signs after the attacker edits Checkout.js notes and pays ₹10.
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_attack",
            order_id: "order_cheap",
            status: "captured",
            amount: 1_000,
            currency: "INR",
            notes: { paymentOrderId: expensiveOrderId },
          },
        },
      },
    });
    const parsed = await provider.parseWebhook({
      rawBody,
      signature: computeRazorpayWebhookSignature(rawBody, webhookSecret),
    });

    // Passed through whole, as the webhook route does, so a hint cannot sneak back in.
    await fulfillPaidCourseOrderByExternalId(tx, ctx, parsed);

    expect(orders.get(expensiveOrderId)?.["status"]).toBe("pending");
    expect(orders.get(expensiveOrderId)?.["external_id"]).toBe("order_expensive");
    expect(orders.get(cheapOrderId)?.["status"]).toBe("paid");
    expect(mockInsertEnrollment).not.toHaveBeenCalledWith(
      expect.objectContaining({ courseId: expensiveCourseId }),
    );
  });

  it("never rewrites an order's gateway reference", async () => {
    const orders = twoPendingOrders();
    const { tx, executeCalls } = createTx({ orders });

    await fulfillPaidCourseOrderByExternalId(tx, ctx, {
      externalId: "order_cheap",
      amountCents: 1_000,
      currency: "INR",
    });

    const rebinds = executeCalls.filter((call) => String(call[0]).includes("set external_id"));
    expect(rebinds).toHaveLength(0);
  });

  it("does not fulfil when the captured amount differs from the order amount", async () => {
    const orders = twoPendingOrders();
    const { tx } = createTx({ orders });

    const result = await fulfillPaidCourseOrderByExternalId(tx, ctx, {
      externalId: "order_expensive",
      amountCents: 1_000,
      currency: "INR",
    });

    expect(result).toBeNull();
    const order = orders.get(expensiveOrderId);
    expect(order?.["status"]).toBe("pending");
    expect(mockInsertEnrollment).not.toHaveBeenCalled();
    expect(
      (order?.["metadata_json"] as Record<string, Record<string, unknown>>)["paymentMismatch"],
    ).toMatchObject({
      externalId: "order_expensive",
      capturedAmountCents: 1_000,
      capturedCurrency: "INR",
    });
  });

  it("does not fulfil when the captured currency differs from the order currency", async () => {
    const orders = twoPendingOrders();
    const { tx } = createTx({ orders });

    const result = await fulfillPaidCourseOrderByExternalId(tx, ctx, {
      externalId: "order_cheap",
      amountCents: 1_000,
      currency: "USD",
    });

    expect(result).toBeNull();
    expect(orders.get(cheapOrderId)?.["status"]).toBe("pending");
    expect(mockInsertEnrollment).not.toHaveBeenCalled();
  });

  it("matches currency case-insensitively", async () => {
    const orders = twoPendingOrders();
    const { tx } = createTx({ orders });

    const result = await fulfillPaidCourseOrderByExternalId(tx, ctx, {
      externalId: "order_cheap",
      amountCents: 1_000,
      currency: "inr",
    });

    expect(result?.paymentOrderId).toBe(cheapOrderId);
  });

  it("fails closed when the gateway did not report the captured amount", async () => {
    const orders = twoPendingOrders();
    const { tx } = createTx({ orders });

    const result = await fulfillPaidCourseOrderByExternalId(tx, ctx, {
      externalId: "order_cheap",
      amountCents: null,
      currency: null,
    });

    expect(result).toBeNull();
    expect(orders.get(cheapOrderId)?.["status"]).toBe("pending");
    expect(mockInsertEnrollment).not.toHaveBeenCalled();
  });

  it("fails closed when the reference matches more than one order", async () => {
    const orders = twoPendingOrders();
    const expensive = orders.get(expensiveOrderId);
    if (expensive) expensive["external_id"] = "order_cheap";
    const { tx } = createTx({ orders });

    const result = await fulfillPaidCourseOrderByExternalId(tx, ctx, {
      externalId: "order_cheap",
      amountCents: 1_000,
      currency: "INR",
    });

    expect(result).toBeNull();
    expect(orders.get(cheapOrderId)?.["status"]).toBe("pending");
    expect(orders.get(expensiveOrderId)?.["status"]).toBe("pending");
    expect(mockInsertEnrollment).not.toHaveBeenCalled();
  });

  it("returns null for a reference no order carries", async () => {
    const orders = twoPendingOrders();
    const { tx } = createTx({ orders });

    const result = await fulfillPaidCourseOrderByExternalId(tx, ctx, {
      externalId: "order_unknown",
      amountCents: 1_000,
      currency: "INR",
    });

    expect(result).toBeNull();
    expect(mockInsertEnrollment).not.toHaveBeenCalled();
  });

  it("is idempotent when the same paid webhook is delivered twice", async () => {
    const orders = twoPendingOrders();
    const { tx } = createTx({ orders });
    const payment = { externalId: "order_cheap", amountCents: 1_000, currency: "INR" };

    const first = await fulfillPaidCourseOrderByExternalId(tx, ctx, payment);
    mockInsertEnrollment.mockResolvedValueOnce({
      id: "018f0000-0000-7000-8000-000000000050",
      enrolledAt: new Date(),
      created: false,
    });
    const second = await fulfillPaidCourseOrderByExternalId(tx, ctx, payment);

    expect(first?.paymentOrderId).toBe(cheapOrderId);
    expect(second?.paymentOrderId).toBe(cheapOrderId);
    expect(mockApplyReferralPurchaseCredits).toHaveBeenCalledOnce();
  });
});

describe("checkout return URLs and audit (audit M4)", () => {
  beforeEach(() => {
    mockFindCourseAuthProjection.mockResolvedValue(paidCourseProjection());
    mockFindActiveEnrollment.mockResolvedValue(null);
    mockGetLearnerBillingConfigRow.mockResolvedValue(null);
    mockAuditWrite.mockReset();
    mockResolvePaymentProvider.mockResolvedValue({
      gatewayKey: "stripe",
      gatewayId: "gw-1",
      provider: {
        createCheckout: vi.fn(async () => ({
          externalId: "cs_test_m4",
          checkoutUrl: "https://checkout.stripe.test/session",
        })),
        parseWebhook: vi.fn(),
      },
    });
  });

  it.each([
    ["another site", "https://evil.example/phish"],
    ["plain http on a public domain", "http://app.test.example/success"],
    ["embedded credentials", "https://user:pass@app.test/success"],
    ["a non-default port on a public domain", "https://academy.example:8443/success"],
    ["not a URL scheme the gateway should follow", "javascript:alert(1)"],
  ])("refuses %s and creates no order", async (_label, successUrl) => {
    const { tx, orders } = createTx({ domains: ["app.test", "academy.example"] });
    await expect(
      purchaseCheckout(tx, ctx, {
        courseId,
        deviceType: "WEB",
        successUrl,
        cancelUrl: "https://app.test/cancel",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(orders.size).toBe(0);
    expect(mockAuditWrite).not.toHaveBeenCalled();
  });

  it("checks the cancel URL too", async () => {
    const { tx, orders } = createTx();
    await expect(
      purchaseCheckout(tx, ctx, {
        courseId,
        deviceType: "WEB",
        successUrl: "https://app.test/success",
        cancelUrl: "https://evil.example/cancel",
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("cancelUrl") });
    expect(orders.size).toBe(0);
  });

  it("accepts the tenant's own domain, and http with a port on development hosts", async () => {
    const { tx } = createTx({ domains: ["academy.localhost"] });
    const result = await purchaseCheckout(tx, ctx, {
      courseId,
      deviceType: "WEB",
      successUrl: "http://academy.localhost:3000/courses/x?checkout=success",
      cancelUrl: "http://academy.localhost:3000/courses/x?checkout=cancelled",
    });
    expect(result.data.checkoutUrl).toBe("https://checkout.stripe.test/session");
  });

  it("audits the paid order it creates", async () => {
    const { tx } = createTx();
    const result = await purchaseCheckout(tx, ctx, {
      courseId,
      deviceType: "WEB",
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
    expect(mockAuditWrite).toHaveBeenCalledOnce();
    expect(mockAuditWrite.mock.calls[0]?.[2]).toMatchObject({
      action: "checkout.order.created",
      target: { type: "payment_order", id: result.data.paymentOrderId },
      after: { courseId, amountCents: 5000, currency: "USD", gatewayKey: "stripe" },
    });
  });

  it("audits a fully discounted order, which has no gateway", async () => {
    mockFindCourseAuthProjection.mockResolvedValue({
      ...paidCourseProjection(),
      metadataJson: { accessTier: "PAID", priceCents: 0, currency: "USD" },
    });
    const { tx } = createTx();
    await purchaseCheckout(tx, ctx, { courseId, deviceType: "WEB" });
    expect(mockAuditWrite.mock.calls[0]?.[2]).toMatchObject({
      action: "checkout.order.created",
      after: { amountCents: 0, gatewayKey: null },
    });
  });
});

describe("one open checkout per learner and course, gateway after commit (audit M4)", () => {
  const body = {
    courseId,
    deviceType: "WEB" as const,
    successUrl: "https://app.test/success",
    cancelUrl: "https://app.test/cancel",
  };
  let createCheckout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFindCourseAuthProjection.mockResolvedValue(paidCourseProjection());
    mockFindActiveEnrollment.mockResolvedValue(null);
    mockGetLearnerBillingConfigRow.mockResolvedValue(null);
    mockAuditWrite.mockReset();
    let sessions = 0;
    createCheckout = vi.fn(async (input: { paymentOrderId: string }) => {
      sessions += 1;
      return {
        externalId: `cs_test_${String(sessions)}`,
        checkoutUrl: `https://checkout.stripe.test/${input.paymentOrderId}/${String(sessions)}`,
        calledInsideTransaction: txState.inTx,
      };
    });
    mockResolvePaymentProvider.mockResolvedValue({
      gatewayKey: "stripe",
      gatewayId: "gw-1",
      provider: { createCheckout, parseWebhook: vi.fn() },
    });
  });

  it("calls the gateway with no transaction open, with a per-order idempotency key", async () => {
    const { tx, orders } = createTx();
    const result = await purchaseCheckout(tx, ctx, body);
    const order = orders.get(result.data.paymentOrderId);

    expect(createCheckout).toHaveBeenCalledOnce();
    expect(createCheckout.mock.calls[0]?.[0]).toMatchObject({
      idempotencyKey: `atlas-checkout-${result.data.paymentOrderId}`,
    });
    expect(await createCheckout.mock.results[0]?.value).toMatchObject({
      calledInsideTransaction: false,
    });
    expect(order?.["external_id"]).toBe("cs_test_1");
    expect(order?.["metadata_json"]).toMatchObject({
      checkoutSession: { checkoutUrl: result.data.checkoutUrl },
    });
  });

  it("reuses the open order for the same price instead of opening a second", async () => {
    const { tx, orders } = createTx();
    const first = await purchaseCheckout(tx, ctx, body);
    const second = await purchaseCheckout(tx, ctx, body);

    expect(second.data.paymentOrderId).toBe(first.data.paymentOrderId);
    expect(second.data.checkoutUrl).toBe(first.data.checkoutUrl);
    expect(orders.size).toBe(1);
    expect(createCheckout).toHaveBeenCalledOnce();
    expect(mockAuditWrite).toHaveBeenCalledOnce();
  });

  it("opens a new order when the price differs", async () => {
    const { tx, orders } = createTx();
    const first = await purchaseCheckout(tx, ctx, body);
    mockFindCourseAuthProjection.mockResolvedValue({
      ...paidCourseProjection(),
      metadataJson: { accessTier: "PAID", priceCents: 4000, currency: "USD" },
    });
    const second = await purchaseCheckout(tx, ctx, body);

    expect(second.data.paymentOrderId).not.toBe(first.data.paymentOrderId);
    expect(orders.size).toBe(2);
  });

  it("returns the recorded session on a replay without calling the gateway again", async () => {
    const { tx } = createTx();
    const plan = await planCheckoutPurchase(tx, ctx, body);
    const first = await completeCheckoutPurchase(plan, ctx);
    const replay = await completeCheckoutPurchase(plan, ctx);

    expect(replay.data.checkoutUrl).toBe(first.data.checkoutUrl);
    expect(createCheckout).toHaveBeenCalledOnce();
  });

  it("marks a payment for a course the learner already holds for refund, without side effects", async () => {
    const orders = new Map<string, Record<string, unknown>>();
    const { tx } = createTx({ orders });
    const orderId = "018f0000-0000-7000-8000-0000000000d1";
    orders.set(orderId, {
      id: orderId,
      membership_id: actorMembershipId,
      external_id: "cs_dup",
      amount_cents: 5000,
      currency: "USD",
      status: "pending",
      invoice_number: null,
      tax_amount_cents: 0,
      coupon_amount_cents: 1000,
      metadata_json: {
        kind: "course_checkout",
        courseId,
        courseTitle: "Paid Course",
        productTitle: "Paid Course",
        productType: "course",
        couponId: "018f0000-0000-7000-8000-0000000000c1",
        couponCode: "SAVE10",
        affiliateId: null,
        affiliateCode: "AFF1",
        affiliateCommissionPct: 10,
        originalAmountCents: 6000,
        discountCents: 1000,
        walletCreditsApplied: 5,
        walletDiscountCents: 500,
        taxAmountCents: 0,
        amountAfterCouponCents: 5000,
        finalAmountCents: 5000,
      },
    });
    mockFindActiveEnrollment.mockResolvedValue({
      id: "018f0000-0000-7000-8000-0000000000e1",
      status: "active",
      enrolledAt: new Date(),
    });
    mockSpendWalletCredits.mockReset();
    mockApplyAffiliateCommission.mockReset();
    mockApplyReferralPurchaseCredits.mockReset();
    mockInsertEnrollment.mockReset();

    const result = await fulfillPaidCourseOrder(tx, ctx, orders.get(orderId) as never);

    expect(result).toEqual({
      enrollmentId: "018f0000-0000-7000-8000-0000000000e1",
      created: false,
      paymentOrderId: orderId,
    });
    expect(orders.get(orderId)?.["status"]).toBe("paid");
    expect(orders.get(orderId)?.["metadata_json"]).toMatchObject({
      duplicatePayment: { refundRequired: true },
    });
    expect(mockSpendWalletCredits).not.toHaveBeenCalled();
    expect(mockApplyAffiliateCommission).not.toHaveBeenCalled();
    expect(mockApplyReferralPurchaseCredits).not.toHaveBeenCalled();
    expect(mockInsertRedemption).not.toHaveBeenCalled();
    expect(mockInsertEnrollment).not.toHaveBeenCalled();
    expect(mockAuditWrite.mock.calls.at(-1)?.[2]).toMatchObject({
      action: "checkout.order.duplicate_payment",
    });
  });
});

describe("coupon limits (audit M1)", () => {
  const couponId = "018f0000-0000-7000-8000-0000000000c1";

  function couponOrder(orders: Map<string, Record<string, unknown>>) {
    const orderId = "018f0000-0000-7000-8000-0000000000d2";
    orders.set(orderId, {
      id: orderId,
      membership_id: actorMembershipId,
      external_id: "cs_m1",
      amount_cents: 4000,
      currency: "USD",
      status: "pending",
      invoice_number: null,
      tax_amount_cents: 0,
      coupon_amount_cents: 1000,
      metadata_json: {
        kind: "course_checkout",
        courseId,
        courseTitle: "Paid Course",
        productTitle: "Paid Course",
        productType: "course",
        couponId,
        couponCode: "SAVE20",
        affiliateId: null,
        affiliateCode: null,
        affiliateCommissionPct: null,
        originalAmountCents: 5000,
        discountCents: 1000,
        walletCreditsApplied: 0,
        walletDiscountCents: 0,
        taxAmountCents: 0,
        amountAfterCouponCents: 4000,
        finalAmountCents: 4000,
      },
    });
    return orderId;
  }

  beforeEach(() => {
    mockFindActiveEnrollment.mockReset();
    mockFindActiveEnrollment.mockResolvedValue(null);
    mockInsertEnrollment.mockReset();
    mockInsertEnrollment.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000050",
      enrolledAt: new Date(),
      created: true,
    });
    mockInsertRedemption.mockReset();
    mockInsertRedemption.mockResolvedValue("redemption-1");
    mockLockCouponForRedemption.mockReset();
    mockAuditWrite.mockReset();
    mockApplyReferralPurchaseCredits.mockResolvedValue(undefined);
  });

  it("honours a paid order that takes the coupon over its limit, and records it", async () => {
    const orders = new Map<string, Record<string, unknown>>();
    const { tx } = createTx({ orders });
    const orderId = couponOrder(orders);
    mockLockCouponForRedemption.mockResolvedValue({
      totalUsageLimit: 1,
      perLearnerLimit: 1,
      totalRedemptions: 1,
      memberRedemptions: 0,
    });

    const result = await fulfillPaidCourseOrder(tx, ctx, orders.get(orderId) as never);

    expect(result).toMatchObject({ created: true, paymentOrderId: orderId });
    expect(mockInsertRedemption).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ couponId, paymentOrderId: orderId, discountCents: 1000 }),
    );
    expect(mockInsertEnrollment).toHaveBeenCalledOnce();
    expect(mockAuditWrite.mock.calls.at(-1)?.[2]).toMatchObject({
      action: "coupon.redeemed_over_limit",
      target: { type: "sales_coupon", id: couponId },
      metadata: { paymentOrderId: orderId, exceeded: ["total"] },
    });
  });

  it("records nothing extra for a redemption within the limit", async () => {
    const orders = new Map<string, Record<string, unknown>>();
    const { tx } = createTx({ orders });
    const orderId = couponOrder(orders);
    mockLockCouponForRedemption.mockResolvedValue({
      totalUsageLimit: 5,
      perLearnerLimit: 1,
      totalRedemptions: 2,
      memberRedemptions: 0,
    });

    await fulfillPaidCourseOrder(tx, ctx, orders.get(orderId) as never);

    expect(mockInsertRedemption).toHaveBeenCalledOnce();
    expect(mockAuditWrite).not.toHaveBeenCalled();
  });

  it("enrols the buyer when the coupon was deleted after the order was priced", async () => {
    const orders = new Map<string, Record<string, unknown>>();
    const { tx } = createTx({ orders });
    const orderId = couponOrder(orders);
    mockLockCouponForRedemption.mockResolvedValue(null);

    const result = await fulfillPaidCourseOrder(tx, ctx, orders.get(orderId) as never);

    expect(result).toMatchObject({ created: true });
    expect(orders.get(orderId)?.["status"]).toBe("paid");
    expect(mockInsertRedemption).not.toHaveBeenCalled();
    expect(mockAuditWrite.mock.calls.at(-1)?.[2]).toMatchObject({
      action: "coupon.redemption_skipped",
      target: { type: "payment_order", id: orderId },
    });
  });

  it("refuses the checkout before payment when the locked count finds no free use", async () => {
    mockFindCourseAuthProjection.mockResolvedValue(paidCourseProjection());
    mockResolveAffiliateForCheckout.mockResolvedValue(null);
    mockFindCouponByCode.mockResolvedValue({
      id: couponId,
      code: "SAVE20",
      name: "Save 20",
      status: "ACTIVE",
      discount_type: "PERCENT",
      discount_value: 20,
      max_discount_cents: null,
      currency: "USD",
      starts_at: null,
      ends_at: null,
      total_usage_limit: 1,
      per_learner_limit: 1,
      min_purchase_cents: null,
      visibility: "PRIVATE",
      device_type: "ALL",
      applies_to_all_courses: true,
    });
    mockCouponAppliesToCourse.mockResolvedValue(true);
    // Free at quote time; taken by another checkout by the time this one holds
    // the coupon's lock.
    mockCountCouponUses.mockImplementation(async (_tx: unknown, args: { lock: boolean }) => ({
      totalUsageLimit: 1,
      perLearnerLimit: 1,
      totalUses: args.lock ? 1 : 0,
      memberUses: 0,
    }));
    mockResolvePaymentProvider.mockReset();

    const { tx, orders } = createTx();
    await expect(
      planCheckoutPurchase(tx, ctx, {
        courseId,
        deviceType: "WEB",
        couponCode: "save20",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      }),
    ).rejects.toMatchObject({ message: "This coupon has reached its usage limit." });

    expect(mockCountCouponUses).toHaveBeenLastCalledWith(
      tx,
      expect.objectContaining({ couponId, membershipId: actorMembershipId, courseId, lock: true }),
    );
    expect(orders.size).toBe(0);
    expect(mockResolvePaymentProvider).not.toHaveBeenCalled();
  });
});
