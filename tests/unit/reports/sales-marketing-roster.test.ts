import { describe, expect, it } from "vitest";
import {
  AFFILIATE_COLUMNS,
  SALES_PURCHASER_COLUMNS,
  affiliateDetailResponseSchema,
  affiliateProductsListResponseSchema,
  affiliateProductsQuerySchema,
  affiliatesListResponseSchema,
  affiliatesQuerySchema,
  couponRedemptionsListResponseSchema,
  couponRedemptionsQuerySchema,
  couponsListQuerySchema,
  exportSalesMarketingBodySchema,
  referralWalletListResponseSchema,
  referralWalletQuerySchema,
  referredLearnersListResponseSchema,
  salesMarketingOverviewQuerySchema,
  salesMarketingOverviewResponseSchema,
  salesProductsQuerySchema,
  salesPurchasersQuerySchema,
  sendSalesMessageBodySchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";

describe("sales marketing roster dto", () => {
  it("parses sales products query defaults", () => {
    const parsed = salesProductsQuerySchema.parse({ page: "2" });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
    expect(parsed.sortBy).toBe("revenue_cents");
  });

  it("parses sales products date and sort filters", () => {
    const parsed = salesProductsQuerySchema.parse({
      paidFrom: "2026-07-01T00:00:00.000Z",
      paidTo: "2026-08-07T23:59:59.999Z",
      productType: "course",
      sortBy: "net_cents",
      sortDir: "asc",
    });
    expect(parsed.productType).toBe("course");
    expect(parsed.sortBy).toBe("net_cents");
    expect(parsed.sortDir).toBe("asc");
  });

  it("parses coupons list query defaults and filters", () => {
    const defaults = couponsListQuerySchema.parse({});
    expect(defaults.view).toBe("all");
    expect(defaults.sortBy).toBe("revenue_cents");
    expect(defaults.limit).toBe(25);

    const filtered = couponsListQuerySchema.parse({
      view: "expiring_soon",
      discountType: "PERCENT",
      sortBy: "net_cents",
      sortDir: "asc",
      q: "SUMMER",
    });
    expect(filtered.view).toBe("expiring_soon");
    expect(filtered.discountType).toBe("PERCENT");
    expect(filtered.sortBy).toBe("net_cents");
    expect(filtered.q).toBe("SUMMER");
  });

  it("parses purchaser columns and sort", () => {
    const parsed = salesPurchasersQuerySchema.parse({
      columns: "learner_name,purchased_at,coupon_code",
      sortBy: "amount_cents",
      sortDir: "asc",
      enrolledType: "paid",
      q: "jane",
    });
    expect(parsed.columns).toEqual(["learner_name", "purchased_at", "coupon_code"]);
    expect(parsed.sortBy).toBe("amount_cents");
    expect(parsed.enrolledType).toBe("paid");
    expect(parsed.q).toBe("jane");
  });

  it("falls back to all purchaser columns when invalid", () => {
    const parsed = salesPurchasersQuerySchema.parse({ columns: "nope" });
    expect(parsed.columns).toEqual([...SALES_PURCHASER_COLUMNS]);
  });

  it("parses affiliates query and export body", () => {
    const affiliates = affiliatesQuerySchema.parse({
      columns: "learner_name,commission_earned_cents",
      sortBy: "revenue_contribution_cents",
    });
    expect(affiliates.columns).toEqual(["learner_name", "commission_earned_cents"]);
    expect(AFFILIATE_COLUMNS).toContain("coupon_code");

    const exported = exportSalesMarketingBodySchema.parse({
      section: "sales",
      courseId: "11111111-1111-4111-8111-111111111111",
    });
    expect(exported.emailDownloadLink).toBe(true);
    expect(exported.section).toBe("sales");
  });

  it("accepts message body and rejects tenant fields", () => {
    const message = sendSalesMessageBodySchema.parse({
      courseId: "11111111-1111-4111-8111-111111111111",
      subject: "Offer",
      message: "Thanks for purchasing.",
    });
    expect(message.subject).toBe("Offer");

    const couponMessage = sendSalesMessageBodySchema.parse({
      couponId: "22222222-2222-4222-8222-222222222222",
      subject: "Coupon cohort",
      message: "Thanks for redeeming.",
    });
    expect(couponMessage.couponId).toBe("22222222-2222-4222-8222-222222222222");

    expect(() =>
      sendSalesMessageBodySchema.parse({
        subject: "x",
        message: "y",
      }),
    ).toThrow();

    expect(() =>
      sendSalesMessageBodySchema.parse({
        courseId: "11111111-1111-4111-8111-111111111111",
        subject: "x",
        message: "y",
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });

  it("parses coupon redemptions query and response shape", () => {
    const query = couponRedemptionsQuerySchema.parse({
      q: "jane",
      courseId: "11111111-1111-4111-8111-111111111111",
      appliedFrom: "2026-07-01T00:00:00.000Z",
      minFinalAmountCents: "100",
      sortBy: "final_amount_cents",
      sortDir: "asc",
    });
    expect(query.q).toBe("jane");
    expect(query.sortBy).toBe("final_amount_cents");
    expect(query.minFinalAmountCents).toBe(100);

    const response = couponRedemptionsListResponseSchema.parse({
      data: {
        couponId: "11111111-1111-4111-8111-111111111111",
        code: "SUMMER26",
        name: "Summer Sale",
        status: "ACTIVE",
        displayStatus: "ACTIVE",
        discountType: "PERCENT",
        discountValue: 15,
        currency: "INR",
        totalUsageLimit: 200,
        redemptionCount: 84,
        endsAt: "2026-09-30T00:00:00.000Z",
        startsAt: null,
        createdAt: "2026-06-15T00:00:00.000Z",
        summary: {
          totalRevenueCents: 26430000,
          totalDiscountCents: 3964500,
          totalNetCents: 22465500,
          redemptionCount: 84,
          avgOrderCents: 314600,
          firstTimeBuyerCount: 61,
          firstTimeBuyerPercent: 72.6,
          returningBuyerCount: 23,
          currency: "INR",
        },
        products: [
          {
            courseId: "33333333-3333-4333-8333-333333333333",
            productTitle: "Masterclass",
            redemptionCount: 45,
            revenueCents: 14500000,
            discountCents: 2000000,
            sharePercent: 55,
          },
        ],
        trend: [
          {
            date: "2026-09-01",
            redemptionCount: 2,
            revenueCents: 600000,
            discountCents: 90000,
          },
        ],
        items: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            membershipId: "55555555-5555-4555-8555-555555555555",
            learnerName: "Jane",
            email: "jane@example.com",
            productTitle: "Masterclass",
            courseId: "33333333-3333-4333-8333-333333333333",
            discountCents: 39900,
            originalAmountCents: 354500,
            finalAmountCents: 314600,
            currency: "INR",
            paymentOrderId: "66666666-6666-4666-8666-666666666666",
            invoiceNumber: "ORD-8F92A",
            appliedAt: "2026-09-15T14:32:00.000Z",
          },
        ],
        pageInfo: {
          page: 1,
          pageSize: 25,
          totalCount: 84,
          totalPages: 4,
          hasNextPage: true,
          hasPreviousPage: false,
        },
        columns: ["learner_name", "email", "product_title", "discount_cents", "final_amount_cents", "applied_at"],
      },
    });
    expect(response.data.summary.firstTimeBuyerPercent).toBe(72.6);
    expect(response.data.items[0]?.invoiceNumber).toBe("ORD-8F92A");
  });

  it("parses referral wallet query and response summary", () => {
    const query = referralWalletQuerySchema.parse({
      q: "sarah",
      activityFrom: "2026-07-01T00:00:00.000Z",
      activityTo: "2026-08-07T23:59:59.999Z",
      sortBy: "credit_earned",
    });
    expect(query.q).toBe("sarah");
    expect(query.sortBy).toBe("credit_earned");

    const response = referralWalletListResponseSchema.parse({
      data: {
        items: [
          {
            membershipId: "11111111-1111-4111-8111-111111111111",
            learnerName: "Sarah",
            email: "s@example.com",
            referralCode: "SJ-PRO",
            successfulReferrals: 12,
            creditEarned: 500,
            walletBalance: 200,
            referredRevenueCents: 49900,
            signedUpAt: "2026-01-01T00:00:00.000Z",
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
        columns: ["learner_name", "referral_code", "successful_referrals", "credit_earned", "wallet_balance", "signed_up_at"],
        summary: {
          successfulReferrals: 418,
          previousSuccessfulReferrals: 373,
          changePercent: 12,
          creditEarned: 84000,
          creditOutstanding: 31200,
          walletsWithBalance: 214,
          referredRevenueCents: 64290000,
          referrerCount: 214,
          totalLearners: 3412,
          currency: "INR",
          windowFrom: "2026-07-08T00:00:00.000Z",
          windowTo: "2026-08-07T00:00:00.000Z",
          windowLabel: "Last 30 Days",
        },
      },
    });
    expect(response.data.summary.changePercent).toBe(12);
    expect(response.data.items[0]?.referredRevenueCents).toBe(49900);
  });

  it("parses affiliate products query and response summary", () => {
    const query = affiliateProductsQuerySchema.parse({
      q: "trading",
      enabled: "enabled",
      commissionBand: "10_20",
      activityFrom: "2026-07-01T00:00:00.000Z",
      activityTo: "2026-08-07T23:59:59.999Z",
      sortBy: "effective_rate_pct",
    });
    expect(query.enabled).toBe("enabled");
    expect(query.commissionBand).toBe("10_20");
    expect(query.sortBy).toBe("effective_rate_pct");

    const response = affiliateProductsListResponseSchema.parse({
      data: {
        items: [
          {
            courseId: "11111111-1111-4111-8111-111111111111",
            productTitle: "Advanced Trading Masterclass",
            productType: "Course",
            enabled: true,
            commissionRatePct: 20,
            inheritsDefaultRate: false,
            tenantDefaultCommissionPct: 10,
            orderCount: 45,
            revenueCents: 11250000,
            commissionCents: 2250000,
            netCents: 9000000,
            effectiveRatePct: 20,
            activeAffiliateCount: 24,
            unpaidCommissionCents: 1240000,
            publishedAt: "2023-10-12T00:00:00.000Z",
            currency: "INR",
          },
        ],
        pageInfo: {
          page: 1,
          pageSize: 50,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        columns: [
          "product_title",
          "enabled",
          "commission_rate_pct",
          "order_count",
          "revenue_cents",
          "commission_cents",
          "net_cents",
          "effective_rate_pct",
          "published_at",
        ],
        summary: {
          revenueCents: 41890000,
          commissionCents: 6124000,
          netCents: 35766000,
          orderCount: 218,
          avgOrderValueCents: 192100,
          effectiveRatePct: 14.6,
          productsEnabled: 12,
          productsInProgramme: 18,
          productsTotal: 42,
          tenantDefaultCommissionPct: 10,
          currency: "INR",
          windowFrom: "2026-07-08T00:00:00.000Z",
          windowTo: "2026-08-07T00:00:00.000Z",
          windowLabel: "Last 30 Days",
        },
      },
    });
    expect(response.data.summary.effectiveRatePct).toBe(14.6);
    expect(response.data.items[0]?.netCents).toBe(9000000);
  });

  it("parses affiliates query and response summary", () => {
    const query = affiliatesQuerySchema.parse({
      q: "sarah",
      status: "ACTIVE",
      tier: "PREMIUM",
      unpaidBand: "has_unpaid",
      view: "owed",
      activityFrom: "2026-07-01T00:00:00.000Z",
      activityTo: "2026-08-07T23:59:59.999Z",
      sortBy: "unpaid_cents",
    });
    expect(query.view).toBe("owed");
    expect(query.unpaidBand).toBe("has_unpaid");
    expect(query.sortBy).toBe("unpaid_cents");

    const response = affiliatesListResponseSchema.parse({
      data: {
        items: [
          {
            affiliateId: "11111111-1111-4111-8111-111111111111",
            membershipId: "22222222-2222-4222-8222-222222222222",
            learnerName: "Sarah Jenkins",
            email: "sarah@example.com",
            tier: "PREMIUM",
            status: "ACTIVE",
            couponCode: "SJ-SUMMER23",
            revenueContributionCents: 12450000,
            commissionEarnedCents: 1867500,
            unpaidCents: 420000,
            paidCents: 1447500,
            signedUpAt: "2023-01-15T00:00:00.000Z",
            currency: "INR",
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
        columns: [
          "learner_name",
          "email",
          "tier",
          "coupon_code",
          "status",
          "revenue_contribution_cents",
          "commission_earned_cents",
          "unpaid_cents",
          "paid_cents",
          "signed_up_at",
        ],
        summary: {
          revenueCents: 41890000,
          commissionCents: 6124000,
          unpaidCents: 1840000,
          unpaidAffiliateCount: 6,
          paidCents: 4284000,
          activeCount: 34,
          totalCount: 41,
          pendingApprovalCount: 2,
          currency: "INR",
          windowFrom: "2026-07-08T00:00:00.000Z",
          windowTo: "2026-08-07T00:00:00.000Z",
          windowLabel: "Last 30 Days",
        },
      },
    });
    expect(response.data.summary.unpaidAffiliateCount).toBe(6);
    expect(response.data.items[0]?.currency).toBe("INR");

    const detail = affiliateDetailResponseSchema.parse({
      data: {
        affiliate: response.data.items[0],
        earningsTrend: [{ month: "2026-07", commissionCents: 10000, revenueCents: 80000 }],
        orders: [
          {
            commissionId: "33333333-3333-4333-8333-333333333333",
            paymentOrderId: "44444444-4444-4444-8444-444444444444",
            invoiceNumber: "ORD-1",
            learnerName: "Tom",
            learnerEmail: "t@example.com",
            productTitle: "Course",
            orderAmountCents: 99900,
            commissionCents: 19980,
            currency: "INR",
            status: "UNPAID",
            createdAt: "2026-07-01T00:00:00.000Z",
          },
        ],
        ordersTotalCount: 1,
        payouts: [
          {
            payoutId: "55555555-5555-4555-8555-555555555555",
            amountCents: 50000,
            currency: "INR",
            status: "PAID",
            note: null,
            paidAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      },
    });
    expect(detail.data.ordersTotalCount).toBe(1);
    expect(detail.data.earningsTrend[0]?.month).toBe("2026-07");
  });

  it("accepts referred learners response shape", () => {
    const parsed = referredLearnersListResponseSchema.parse({
      data: {
        referrer: {
          membershipId: "11111111-1111-4111-8111-111111111111",
          learnerName: "Sarah",
          email: "s@example.com",
          referralCode: "SJ-PRO",
        },
        items: [
          {
            membershipId: "22222222-2222-4222-8222-222222222222",
            learnerName: "Tom",
            email: "t@example.com",
            signedUpAt: "2026-09-01T00:00:00.000Z",
            firstPurchaseTitle: "Pro Course",
            revenueAttributedCents: 49900,
            creditAwarded: 50,
            currency: "INR",
            status: "QUALIFIED",
          },
        ],
        pageInfo: {
          page: 1,
          pageSize: 100,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        totalCreditAwarded: 50,
        totalRevenueCents: 49900,
        currency: "INR",
      },
    });
    expect(parsed.data.items[0]?.status).toBe("QUALIFIED");
  });

  it("parses sales marketing overview query defaults", () => {
    const parsed = salesMarketingOverviewQuerySchema.parse({});
    expect(parsed.grain).toBe("week");
  });

  it("accepts overview response shape", () => {
    const parsed = salesMarketingOverviewResponseSchema.parse({
      data: {
        summary: {
          attributedRevenueCents: 1000,
          discountGivenCents: 100,
          commissionEarnedCents: 50,
          referralCredit: 10,
          netToTenantCents: 850,
          currency: "INR",
          currencies: ["INR"],
          orderCount: 2,
          previousAttributedRevenueCents: 800,
          changePercent: 25,
          windowLabel: "37 days",
          windowFrom: "2026-07-01T00:00:00.000Z",
          windowTo: "2026-08-07T00:00:00.000Z",
        },
        attribution: {
          directCents: 550,
          couponCents: 250,
          referralCents: 120,
          affiliateCents: 80,
          directPercent: 55,
          couponPercent: 25,
          referralPercent: 12,
          affiliatePercent: 8,
        },
        revenueTrend: [],
        topProducts: [],
        topCoupons: [],
        topAffiliates: [],
        attention: [],
      },
    });
    expect(parsed.data.summary.currency).toBe("INR");
    expect(parsed.data.attribution.directPercent).toBe(55);
  });
});
