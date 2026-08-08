import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

function parseColumns(allowed: readonly string[], value: unknown): string[] {
  const allowedSet = new Set<string>(allowed);
  if (Array.isArray(value)) {
    const selected = value.filter(
      (column): column is string => typeof column === "string" && allowedSet.has(column),
    );
    return selected.length > 0 ? selected : [...allowed];
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return [...allowed];
  }
  const selected = value
    .split(",")
    .map((part) => part.trim())
    .filter((column) => allowedSet.has(column));
  return selected.length > 0 ? selected : [...allowed];
}

const pageInfoSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const SALES_PURCHASER_COLUMNS = [
  "learner_name",
  "email",
  "amount_cents",
  "currency",
  "enrolled_type",
  "coupon_code",
  "payment_order_id",
  "purchased_at",
] as const;

export type SalesPurchaserColumn = (typeof SALES_PURCHASER_COLUMNS)[number];

export const COUPON_USAGE_COLUMNS = [
  "learner_name",
  "email",
  "product_title",
  "discount_cents",
  "final_amount_cents",
  "payment_order_id",
  "applied_at",
] as const;

export const REFERRAL_WALLET_COLUMNS = [
  "learner_name",
  "email",
  "referral_code",
  "successful_referrals",
  "credit_earned",
  "wallet_balance",
  "signed_up_at",
] as const;

export const AFFILIATE_COLUMNS = [
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
] as const;

export const AFFILIATE_PRODUCT_COLUMNS = [
  "product_title",
  "enabled",
  "commission_rate_pct",
  "order_count",
  "revenue_cents",
  "commission_cents",
  "net_cents",
  "effective_rate_pct",
  "published_at",
] as const;

/* ---------- Sales products ---------- */

export const SALES_PRODUCTS_SORT = [
  "revenue_cents",
  "purchaser_count",
  "product_title",
  "discount_cents",
  "net_cents",
] as const;

export const salesProductsQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    paidFrom: z.string().datetime().optional(),
    paidTo: z.string().datetime().optional(),
    productType: z.string().trim().min(1).max(64).optional(),
    currency: z.string().trim().min(1).max(8).optional(),
    sortBy: z.enum(SALES_PRODUCTS_SORT).default("revenue_cents"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type SalesProductsQuery = z.output<typeof salesProductsQuerySchema>;

export const salesProductItemSchema = z
  .object({
    courseId: z.string().uuid(),
    productTitle: z.string(),
    productType: z.string(),
    revenueCents: z.number().int().nonnegative(),
    discountCents: z.number().int().nonnegative(),
    netCents: z.number().int().nonnegative(),
    currency: z.string(),
    unitsSold: z.number().int().nonnegative(),
    paidLearnerCount: z.number().int().nonnegative(),
    trialLearnerCount: z.number().int().nonnegative(),
    purchaserCount: z.number().int().nonnegative(),
    avgUnitPriceCents: z.number().int().nonnegative(),
    revenueSharePercent: z.number().nonnegative(),
  })
  .strict();

export const salesProductsListResponseSchema = z.object({
  data: z.object({
    items: z.array(salesProductItemSchema),
    pageInfo: pageInfoSchema,
    summary: z.object({
      totalRevenueCents: z.number().int().nonnegative(),
      totalDiscountCents: z.number().int().nonnegative(),
      totalNetCents: z.number().int().nonnegative(),
      totalUnitsSold: z.number().int().nonnegative(),
      productCount: z.number().int().nonnegative(),
      avgOrderCents: z.number().int().nonnegative(),
      currency: z.string(),
      currencies: z.array(z.string()),
      previousTotalRevenueCents: z.number().int().nonnegative(),
      previousTotalUnitsSold: z.number().int().nonnegative(),
      revenueChangePercent: z.number().nullable(),
      unitsChangePercent: z.number().nullable(),
      windowFrom: z.string().datetime().nullable(),
      windowTo: z.string().datetime().nullable(),
    }),
    productTypes: z.array(z.string()),
  }),
});

export const salesCourseIdParamsSchema = z
  .object({
    courseId: z.string().uuid(),
  })
  .strict();

export const salesPurchasersQuerySchema = rejectClientTenantFields
  .extend({
    learnerName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    enrolledType: z.string().trim().min(1).max(40).optional(),
    purchasedFrom: z.string().datetime().optional(),
    purchasedTo: z.string().datetime().optional(),
    sortBy: z.enum(["purchased_at", "amount_cents", "learner_name"]).default("purchased_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(
      (value) => parseColumns(SALES_PURCHASER_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type SalesPurchasersQuery = z.output<typeof salesPurchasersQuerySchema>;

export const salesPurchaserItemSchema = z
  .object({
    membershipId: z.string().uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    amountCents: z.number().int().nonnegative(),
    discountCents: z.number().int().nonnegative(),
    currency: z.string(),
    enrolledType: z.string().nullable(),
    couponCode: z.string().nullable(),
    purchasedAt: z.string().datetime(),
    paymentOrderId: z.string().uuid().nullable(),
    invoiceNumber: z.string().nullable(),
  })
  .strict();

export const salesPurchasersListResponseSchema = z.object({
  data: z.object({
    courseId: z.string().uuid(),
    productTitle: z.string(),
    productType: z.string(),
    productStatus: z.string(),
    revenueCents: z.number().int().nonnegative(),
    discountCents: z.number().int().nonnegative(),
    avgOrderCents: z.number().int().nonnegative(),
    purchaserCount: z.number().int().nonnegative(),
    paidLearnerCount: z.number().int().nonnegative(),
    trialLearnerCount: z.number().int().nonnegative(),
    discountedOrderCount: z.number().int().nonnegative(),
    discountedOrderPercent: z.number().nonnegative(),
    currency: z.string(),
    items: z.array(salesPurchaserItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
  }),
});

/* ---------- Coupons ---------- */

export const COUPON_LIST_VIEWS = [
  "all",
  "active",
  "never_used",
  "expiring_soon",
  "inactive",
] as const;

export const couponsListQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).optional(),
    discountType: z.enum(["PERCENT", "FIXED"]).optional(),
    view: z.enum(COUPON_LIST_VIEWS).default("all"),
    sortBy: z
      .enum([
        "revenue_cents",
        "discount_cents",
        "redemption_count",
        "created_at",
        "net_cents",
        "code",
      ])
      .default("revenue_cents"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type CouponsListQuery = z.output<typeof couponsListQuerySchema>;

export const couponListItemSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    status: z.string(),
    displayStatus: z.string(),
    discountType: z.string(),
    discountValue: z.number(),
    currency: z.string(),
    redemptionCount: z.number().int().nonnegative(),
    totalUsageLimit: z.number().int().positive().nullable(),
    totalDiscountCents: z.number().int().nonnegative(),
    totalRevenueCents: z.number().int().nonnegative(),
    netCents: z.number().int(),
    endsAt: z.string().datetime().nullable(),
    startsAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const couponsListSummarySchema = z
  .object({
    totalRevenueCents: z.number().int().nonnegative(),
    totalDiscountCents: z.number().int().nonnegative(),
    totalNetCents: z.number().int(),
    totalRedemptions: z.number().int().nonnegative(),
    couponCount: z.number().int().nonnegative(),
    activeCouponCount: z.number().int().nonnegative(),
    discountPercentOfGross: z.number().nonnegative(),
    avgRedemptionsPerActive: z.number().nonnegative(),
    currency: z.string(),
  })
  .strict();

export const couponsListResponseSchema = z.object({
  data: z.object({
    items: z.array(couponListItemSchema),
    pageInfo: pageInfoSchema,
    summary: couponsListSummarySchema,
  }),
});

export const couponIdParamsSchema = z
  .object({
    couponId: z.string().uuid(),
  })
  .strict();

export const couponRedemptionsQuerySchema = rejectClientTenantFields
  .extend({
    learnerName: z.string().trim().min(1).max(200).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    courseId: z.string().uuid().optional(),
    appliedFrom: z.string().datetime().optional(),
    appliedTo: z.string().datetime().optional(),
    minFinalAmountCents: z.coerce.number().int().min(0).optional(),
    maxFinalAmountCents: z.coerce.number().int().min(0).optional(),
    couponApplied: z.boolean().optional(),
    sortBy: z
      .enum(["applied_at", "discount_cents", "learner_name", "final_amount_cents"])
      .default("applied_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(
      (value) => parseColumns(COUPON_USAGE_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type CouponRedemptionsQuery = z.output<typeof couponRedemptionsQuerySchema>;

export const couponRedemptionItemSchema = z
  .object({
    id: z.string().uuid(),
    membershipId: z.string().uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    productTitle: z.string().nullable(),
    courseId: z.string().uuid().nullable(),
    discountCents: z.number().int().nonnegative(),
    originalAmountCents: z.number().int().nonnegative(),
    finalAmountCents: z.number().int().nonnegative(),
    currency: z.string(),
    paymentOrderId: z.string().uuid().nullable(),
    invoiceNumber: z.string().nullable(),
    appliedAt: z.string().datetime(),
  })
  .strict();

export const couponRedemptionProductBreakdownSchema = z
  .object({
    courseId: z.string().uuid().nullable(),
    productTitle: z.string(),
    redemptionCount: z.number().int().nonnegative(),
    revenueCents: z.number().int().nonnegative(),
    discountCents: z.number().int().nonnegative(),
    sharePercent: z.number().nonnegative(),
  })
  .strict();

export const couponRedemptionTrendPointSchema = z
  .object({
    date: z.string(),
    redemptionCount: z.number().int().nonnegative(),
    revenueCents: z.number().int().nonnegative(),
    discountCents: z.number().int().nonnegative(),
  })
  .strict();

export const couponRedemptionsSummarySchema = z
  .object({
    totalRevenueCents: z.number().int().nonnegative(),
    totalDiscountCents: z.number().int().nonnegative(),
    totalNetCents: z.number().int(),
    redemptionCount: z.number().int().nonnegative(),
    avgOrderCents: z.number().int().nonnegative(),
    firstTimeBuyerCount: z.number().int().nonnegative(),
    firstTimeBuyerPercent: z.number().nonnegative(),
    returningBuyerCount: z.number().int().nonnegative(),
    currency: z.string(),
  })
  .strict();

export const couponRedemptionsListResponseSchema = z.object({
  data: z.object({
    couponId: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    status: z.string(),
    displayStatus: z.string(),
    discountType: z.string(),
    discountValue: z.number(),
    currency: z.string(),
    totalUsageLimit: z.number().int().positive().nullable(),
    redemptionCount: z.number().int().nonnegative(),
    endsAt: z.string().datetime().nullable(),
    startsAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    summary: couponRedemptionsSummarySchema,
    products: z.array(couponRedemptionProductBreakdownSchema),
    trend: z.array(couponRedemptionTrendPointSchema),
    items: z.array(couponRedemptionItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
  }),
});

/* ---------- Referral & Wallet ---------- */

export const referralWalletQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    signedUpFrom: z.string().datetime().optional(),
    signedUpTo: z.string().datetime().optional(),
    activityFrom: z.string().datetime().optional(),
    activityTo: z.string().datetime().optional(),
    minCreditEarned: z.coerce.number().int().min(0).optional(),
    minWalletBalance: z.coerce.number().int().min(0).optional(),
    sortBy: z
      .enum([
        "signed_up_at",
        "successful_referrals",
        "credit_earned",
        "wallet_balance",
        "referred_revenue_cents",
        "learner_name",
      ])
      .default("successful_referrals"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(
      (value) => parseColumns(REFERRAL_WALLET_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ReferralWalletQuery = z.output<typeof referralWalletQuerySchema>;

export const referralWalletItemSchema = z
  .object({
    membershipId: z.string().uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    referralCode: z.string().nullable(),
    successfulReferrals: z.number().int().nonnegative(),
    creditEarned: z.number().int().nonnegative(),
    walletBalance: z.number().int().nonnegative(),
    referredRevenueCents: z.number().int().nonnegative(),
    signedUpAt: z.string().datetime().nullable(),
  })
  .strict();

export const referralWalletSummarySchema = z
  .object({
    successfulReferrals: z.number().int().nonnegative(),
    previousSuccessfulReferrals: z.number().int().nonnegative(),
    changePercent: z.number().nullable(),
    creditEarned: z.number().int().nonnegative(),
    creditOutstanding: z.number().int().nonnegative(),
    walletsWithBalance: z.number().int().nonnegative(),
    referredRevenueCents: z.number().int().nonnegative(),
    referrerCount: z.number().int().nonnegative(),
    totalLearners: z.number().int().nonnegative(),
    currency: z.string(),
    windowFrom: z.string().datetime(),
    windowTo: z.string().datetime(),
    windowLabel: z.string(),
  })
  .strict();

export const referralWalletListResponseSchema = z.object({
  data: z.object({
    items: z.array(referralWalletItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
    summary: referralWalletSummarySchema,
  }),
});

export const referrerMembershipIdParamsSchema = z
  .object({
    membershipId: z.string().uuid(),
  })
  .strict();

export const referredLearnersQuerySchema = rejectClientTenantFields
  .extend({
    limit: z.coerce.number().int().min(1).max(200).default(100),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ReferredLearnersQuery = z.output<typeof referredLearnersQuerySchema>;

export const referredLearnerItemSchema = z
  .object({
    membershipId: z.string().uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    signedUpAt: z.string().datetime(),
    firstPurchaseTitle: z.string().nullable(),
    revenueAttributedCents: z.number().int().nonnegative(),
    creditAwarded: z.number().int().nonnegative(),
    currency: z.string(),
    status: z.enum(["QUALIFIED", "PENDING", "DISQUALIFIED"]),
  })
  .strict();

export const referredLearnersListResponseSchema = z.object({
  data: z.object({
    referrer: z.object({
      membershipId: z.string().uuid(),
      learnerName: z.string().nullable(),
      email: z.string().nullable(),
      referralCode: z.string().nullable(),
    }),
    items: z.array(referredLearnerItemSchema),
    pageInfo: pageInfoSchema,
    totalCreditAwarded: z.number().int().nonnegative(),
    totalRevenueCents: z.number().int().nonnegative(),
    currency: z.string(),
  }),
});

/* ---------- Affiliate products ---------- */

export const AFFILIATE_PRODUCTS_SORT = [
  "published_at",
  "revenue_cents",
  "commission_cents",
  "order_count",
  "commission_rate_pct",
  "effective_rate_pct",
  "product_title",
] as const;

export const affiliateProductsQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    enabled: z.enum(["all", "enabled", "disabled"]).default("all"),
    commissionBand: z.enum(["any", "below_10", "10_20", "above_20"]).default("any"),
    activityFrom: z.string().datetime().optional(),
    activityTo: z.string().datetime().optional(),
    publishedFrom: z.string().datetime().optional(),
    publishedTo: z.string().datetime().optional(),
    sortBy: z.enum(AFFILIATE_PRODUCTS_SORT).default("revenue_cents"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(
      (value) => parseColumns(AFFILIATE_PRODUCT_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type AffiliateProductsQuery = z.output<typeof affiliateProductsQuerySchema>;

export const affiliateProductItemSchema = z
  .object({
    courseId: z.string().uuid(),
    productTitle: z.string(),
    productType: z.string(),
    enabled: z.boolean(),
    commissionRatePct: z.number().nonnegative(),
    inheritsDefaultRate: z.boolean(),
    tenantDefaultCommissionPct: z.number().nonnegative(),
    orderCount: z.number().int().nonnegative(),
    revenueCents: z.number().int().nonnegative(),
    commissionCents: z.number().int().nonnegative(),
    netCents: z.number().int().nonnegative(),
    effectiveRatePct: z.number().nonnegative(),
    activeAffiliateCount: z.number().int().nonnegative(),
    unpaidCommissionCents: z.number().int().nonnegative(),
    publishedAt: z.string().datetime().nullable(),
    currency: z.string(),
  })
  .strict();

export const affiliateProductsSummarySchema = z
  .object({
    revenueCents: z.number().int().nonnegative(),
    commissionCents: z.number().int().nonnegative(),
    netCents: z.number().int().nonnegative(),
    orderCount: z.number().int().nonnegative(),
    avgOrderValueCents: z.number().int().nonnegative(),
    effectiveRatePct: z.number().nonnegative(),
    productsEnabled: z.number().int().nonnegative(),
    productsInProgramme: z.number().int().nonnegative(),
    productsTotal: z.number().int().nonnegative(),
    tenantDefaultCommissionPct: z.number().nonnegative(),
    currency: z.string(),
    windowFrom: z.string().datetime(),
    windowTo: z.string().datetime(),
    windowLabel: z.string(),
  })
  .strict();

export const affiliateProductsListResponseSchema = z.object({
  data: z.object({
    items: z.array(affiliateProductItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
    summary: affiliateProductsSummarySchema,
  }),
});

/* ---------- Affiliates ---------- */

export const AFFILIATES_SORT = [
  "signed_up_at",
  "revenue_contribution_cents",
  "commission_earned_cents",
  "unpaid_cents",
  "paid_cents",
  "learner_name",
] as const;

export const affiliatesQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    tier: z.enum(["STANDARD", "PREMIUM"]).optional(),
    unpaidBand: z.enum(["any", "has_unpaid", "zero", "above_1000"]).default("any"),
    view: z.enum(["all", "owed", "top", "suspended"]).default("all"),
    activityFrom: z.string().datetime().optional(),
    activityTo: z.string().datetime().optional(),
    signedUpFrom: z.string().datetime().optional(),
    signedUpTo: z.string().datetime().optional(),
    sortBy: z.enum(AFFILIATES_SORT).default("commission_earned_cents"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(
      (value) => parseColumns(AFFILIATE_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type AffiliatesQuery = z.output<typeof affiliatesQuerySchema>;

export const affiliateItemSchema = z
  .object({
    affiliateId: z.string().uuid(),
    membershipId: z.string().uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    tier: z.string(),
    status: z.string(),
    couponCode: z.string(),
    revenueContributionCents: z.number().int().nonnegative(),
    commissionEarnedCents: z.number().int().nonnegative(),
    unpaidCents: z.number().int().nonnegative(),
    paidCents: z.number().int().nonnegative(),
    signedUpAt: z.string().datetime(),
    currency: z.string(),
  })
  .strict();

export const affiliatesSummarySchema = z
  .object({
    revenueCents: z.number().int().nonnegative(),
    commissionCents: z.number().int().nonnegative(),
    unpaidCents: z.number().int().nonnegative(),
    unpaidAffiliateCount: z.number().int().nonnegative(),
    paidCents: z.number().int().nonnegative(),
    activeCount: z.number().int().nonnegative(),
    totalCount: z.number().int().nonnegative(),
    pendingApprovalCount: z.number().int().nonnegative(),
    currency: z.string(),
    windowFrom: z.string().datetime(),
    windowTo: z.string().datetime(),
    windowLabel: z.string(),
  })
  .strict();

export const affiliatesListResponseSchema = z.object({
  data: z.object({
    items: z.array(affiliateItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
    summary: affiliatesSummarySchema,
  }),
});

export const affiliateIdParamsSchema = z
  .object({
    affiliateId: z.string().uuid(),
  })
  .strict();

export const affiliateDetailQuerySchema = rejectClientTenantFields
  .extend({
    ordersLimit: z.coerce.number().int().min(1).max(100).default(25),
    payoutsLimit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type AffiliateDetailQuery = z.output<typeof affiliateDetailQuerySchema>;

export const affiliateAttributedOrderSchema = z
  .object({
    commissionId: z.string().uuid(),
    paymentOrderId: z.string().uuid(),
    invoiceNumber: z.string().nullable(),
    learnerName: z.string().nullable(),
    learnerEmail: z.string().nullable(),
    productTitle: z.string(),
    orderAmountCents: z.number().int().nonnegative(),
    commissionCents: z.number().int().nonnegative(),
    currency: z.string(),
    status: z.string(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const affiliatePayoutHistoryItemSchema = z
  .object({
    payoutId: z.string().uuid(),
    amountCents: z.number().int().nonnegative(),
    currency: z.string(),
    status: z.string(),
    note: z.string().nullable(),
    paidAt: z.string().datetime(),
  })
  .strict();

export const affiliateEarningsPointSchema = z
  .object({
    month: z.string(),
    commissionCents: z.number().int().nonnegative(),
    revenueCents: z.number().int().nonnegative(),
  })
  .strict();

export const affiliateDetailResponseSchema = z.object({
  data: z.object({
    affiliate: affiliateItemSchema,
    earningsTrend: z.array(affiliateEarningsPointSchema),
    orders: z.array(affiliateAttributedOrderSchema),
    ordersTotalCount: z.number().int().nonnegative(),
    payouts: z.array(affiliatePayoutHistoryItemSchema),
  }),
});

/* ---------- Actions ---------- */

export const exportSalesMarketingBodySchema = rejectClientTenantFields
  .extend({
    section: z.enum([
      "sales",
      "coupons",
      "referral-wallet",
      "affiliate-products",
      "affiliates",
    ]),
    courseId: z.string().uuid().optional(),
    couponId: z.string().uuid().optional(),
    q: z.string().trim().min(1).max(200).optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    purchasedFrom: z.string().datetime().optional(),
    purchasedTo: z.string().datetime().optional(),
    columns: z.array(z.string().min(1)).min(1).max(30).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportSalesMarketingResponseSchema = z.object({
  data: z.object({
    runId: z.string().uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});

export const sendSalesMessageBodySchema = rejectClientTenantFields
  .extend({
    courseId: z.string().uuid().optional(),
    couponId: z.string().uuid().optional(),
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(10000),
    membershipIds: z.array(z.string().uuid()).min(1).max(2000).optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    enrolledType: z.string().trim().min(1).max(40).optional(),
    purchasedFrom: z.string().datetime().optional(),
    purchasedTo: z.string().datetime().optional(),
    appliedFrom: z.string().datetime().optional(),
    appliedTo: z.string().datetime().optional(),
    courseFilterId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasSelection = (value.membershipIds?.length ?? 0) > 0;
    if (!hasSelection && !value.courseId && !value.couponId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide courseId, couponId, or membershipIds.",
        path: ["courseId"],
      });
    }
  });

export const sendSalesMessageResponseSchema = z.object({
  data: z.object({
    deliveredCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    recipientCount: z.number().int().nonnegative(),
  }),
});

export const createSalesGroupBodySchema = rejectClientTenantFields
  .extend({
    courseId: z.string().uuid().optional(),
    couponId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(256),
    description: z.string().trim().max(2000).optional(),
    membershipIds: z.array(z.string().uuid()).min(1).max(2000).optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    enrolledType: z.string().trim().min(1).max(40).optional(),
    purchasedFrom: z.string().datetime().optional(),
    purchasedTo: z.string().datetime().optional(),
    appliedFrom: z.string().datetime().optional(),
    appliedTo: z.string().datetime().optional(),
    courseFilterId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasSelection = (value.membershipIds?.length ?? 0) > 0;
    if (!hasSelection && !value.courseId && !value.couponId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide courseId, couponId, or membershipIds.",
        path: ["courseId"],
      });
    }
  });

export const createSalesGroupResponseSchema = z.object({
  data: z.object({
    batchId: z.string().uuid(),
    key: z.string(),
    name: z.string(),
    memberCount: z.number().int().nonnegative(),
  }),
});

/* ---------- Overview ---------- */

export const SALES_MARKETING_OVERVIEW_GRAINS = ["day", "week", "month"] as const;
export type SalesMarketingOverviewGrain = (typeof SALES_MARKETING_OVERVIEW_GRAINS)[number];

export const salesMarketingOverviewQuerySchema = rejectClientTenantFields
  .extend({
    paidFrom: z.string().datetime().optional(),
    paidTo: z.string().datetime().optional(),
    currency: z.string().trim().min(1).max(8).optional(),
    grain: z.enum(SALES_MARKETING_OVERVIEW_GRAINS).default("week"),
  })
  .strict();

export type SalesMarketingOverviewQuery = z.output<typeof salesMarketingOverviewQuerySchema>;

export const salesMarketingOverviewResponseSchema = z.object({
  data: z.object({
    summary: z.object({
      attributedRevenueCents: z.number().int().nonnegative(),
      discountGivenCents: z.number().int().nonnegative(),
      commissionEarnedCents: z.number().int().nonnegative(),
      referralCredit: z.number().int().nonnegative(),
      netToTenantCents: z.number().int(),
      currency: z.string(),
      currencies: z.array(z.string()),
      orderCount: z.number().int().nonnegative(),
      previousAttributedRevenueCents: z.number().int().nonnegative(),
      changePercent: z.number().nullable(),
      windowLabel: z.string(),
      windowFrom: z.string().datetime(),
      windowTo: z.string().datetime(),
    }),
    attribution: z.object({
      directCents: z.number().int().nonnegative(),
      couponCents: z.number().int().nonnegative(),
      referralCents: z.number().int().nonnegative(),
      affiliateCents: z.number().int().nonnegative(),
      directPercent: z.number().nonnegative(),
      couponPercent: z.number().nonnegative(),
      referralPercent: z.number().nonnegative(),
      affiliatePercent: z.number().nonnegative(),
    }),
    revenueTrend: z.array(
      z.object({
        date: z.string(),
        directCents: z.number().int().nonnegative(),
        couponCents: z.number().int().nonnegative(),
        referralCents: z.number().int().nonnegative(),
        affiliateCents: z.number().int().nonnegative(),
        totalCents: z.number().int().nonnegative(),
        orderCount: z.number().int().nonnegative(),
      }),
    ),
    topProducts: z.array(
      z.object({
        courseId: z.string().uuid().nullable(),
        productTitle: z.string(),
        productType: z.string(),
        purchaserCount: z.number().int().nonnegative(),
        revenueCents: z.number().int().nonnegative(),
        discountCents: z.number().int().nonnegative(),
        netCents: z.number().int().nonnegative(),
      }),
    ),
    topCoupons: z.array(
      z.object({
        id: z.string().uuid(),
        code: z.string(),
        uses: z.number().int().nonnegative(),
        generatedCents: z.number().int().nonnegative(),
      }),
    ),
    topAffiliates: z.array(
      z.object({
        affiliateId: z.string().uuid(),
        name: z.string(),
        commissionCents: z.number().int().nonnegative(),
        unpaidCents: z.number().int().nonnegative(),
      }),
    ),
    attention: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        href: z.string(),
        count: z.number().int().nonnegative().nullable(),
      }),
    ),
  }),
});
