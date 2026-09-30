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
} = vi.hoisted(() => ({
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
    findByCode: vi.fn(),
    couponAppliesToCourse: vi.fn(),
    countRedemptionsForMembership: vi.fn(),
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
  fulfillPaidCourseOrder,
  fulfillPaidCourseOrderByExternalId,
  purchaseCheckout,
} from "../../../backend/apps/api/src/server/sales-coupons/sales-coupons.service";
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

function createTx(opts?: { orders?: Map<string, Record<string, unknown>>; claimFails?: boolean }) {
  const orders = opts?.orders ?? new Map<string, Record<string, unknown>>();
  const executeCalls: unknown[][] = [];

  const tx = {
    $executeRawUnsafe: vi.fn(async (...args: unknown[]) => {
      executeCalls.push(args);
      const sql = String(args[0] ?? "");
      if (sql.includes("insert into payment_orders")) {
        const id = String(args[1]);
        orders.set(id, {
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
