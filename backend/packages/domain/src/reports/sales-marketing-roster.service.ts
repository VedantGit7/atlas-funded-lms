import type { TenantTx } from "@atlas/db";
import { batchesRepository } from "../batches/batches.repository";
import type { ServiceCtx } from "../shared/domain.types";
import {
  affiliateDetailResponseSchema,
  affiliateProductsListResponseSchema,
  affiliatesListResponseSchema,
  couponRedemptionsListResponseSchema,
  couponsListResponseSchema,
  createSalesGroupResponseSchema,
  referredLearnersListResponseSchema,
  referralWalletListResponseSchema,
  salesMarketingOverviewResponseSchema,
  salesProductsListResponseSchema,
  salesPurchasersListResponseSchema,
  type AffiliateDetailQuery,
  type AffiliateProductsQuery,
  type AffiliatesQuery,
  type CouponRedemptionsQuery,
  type CouponsListQuery,
  type ReferralWalletQuery,
  type ReferredLearnersQuery,
  type SalesMarketingOverviewQuery,
  type SalesProductsQuery,
  type SalesPurchasersQuery,
} from "./sales-marketing-roster.dto";
import {
  salesMarketingAffiliateNotFound,
  salesMarketingCouponNotFound,
  salesMarketingGroupFailed,
  salesMarketingProductNotFound,
  salesMarketingReferrerNotFound,
} from "./sales-marketing-roster.errors";
import {
  salesMarketingRosterRepository,
  type PurchaserFilter,
  type SalesMarketingOverviewFilter,
} from "./sales-marketing-roster.repository";

function pageInfo(totalCount: number, page: number, limit: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  return {
    page,
    pageSize: limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function slugifyKey(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "sales"}-${Date.now().toString(36)}`;
}

function toPurchaserFilter(
  courseId: string,
  input: Partial<{
    learnerName?: string;
    email?: string;
    q?: string;
    enrolledType?: string;
    purchasedFrom?: string;
    purchasedTo?: string;
  }>,
): PurchaserFilter {
  const filter: PurchaserFilter = { courseId };
  if (input.learnerName) filter.learnerName = input.learnerName;
  if (input.email) filter.email = input.email;
  if (input.q) filter.q = input.q;
  if (input.enrolledType) filter.enrolledType = input.enrolledType;
  if (input.purchasedFrom) filter.purchasedFrom = input.purchasedFrom;
  if (input.purchasedTo) filter.purchasedTo = input.purchasedTo;
  return filter;
}

export async function listSalesProducts(tx: TenantTx, _ctx: ServiceCtx, query: SalesProductsQuery) {
  const filter = {
    q: query.q,
    paidFrom: query.paidFrom,
    paidTo: query.paidTo,
    productType: query.productType,
    currency: query.currency,
  };

  const windowFrom = query.paidFrom ? new Date(query.paidFrom) : null;
  const windowTo = query.paidTo ? new Date(query.paidTo) : null;
  let previousFilter: typeof filter | null = null;
  if (windowFrom && windowTo) {
    const durationMs = Math.max(windowTo.getTime() - windowFrom.getTime(), 24 * 60 * 60 * 1000);
    const previousTo = new Date(windowFrom.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - durationMs);
    previousFilter = {
      ...filter,
      paidFrom: previousFrom.toISOString(),
      paidTo: previousTo.toISOString(),
    };
  }

  const [totalCount, rows, summary, previousSummary, productTypes] = await Promise.all([
    salesMarketingRosterRepository.countSalesProducts(tx, query),
    salesMarketingRosterRepository.listSalesProducts(tx, query),
    salesMarketingRosterRepository.getSalesProductsSummary(tx, filter),
    previousFilter
      ? salesMarketingRosterRepository.getSalesProductsSummary(tx, previousFilter)
      : Promise.resolve({
          total_revenue_cents: 0,
          total_discount_cents: 0,
          total_units_sold: 0,
          product_count: 0,
          currencies: [] as string[],
        }),
    salesMarketingRosterRepository.listSalesProductTypes(tx, filter),
  ]);

  const currency =
    query.currency?.toUpperCase() ?? summary.currencies[0] ?? rows[0]?.currency ?? "INR";

  const totalRevenue = summary.total_revenue_cents;
  const changePercent = (current: number, previous: number): number | null => {
    if (previous === 0) return current > 0 ? 100 : null;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  };

  return salesProductsListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        courseId: row.course_id,
        productTitle: row.product_title,
        productType: row.product_type,
        revenueCents: row.revenue_cents,
        discountCents: row.discount_cents,
        netCents: row.net_cents,
        currency: row.currency,
        unitsSold: row.units_sold,
        paidLearnerCount: row.paid_learner_count,
        trialLearnerCount: row.trial_learner_count,
        purchaserCount: row.purchaser_count,
        avgUnitPriceCents: row.avg_unit_price_cents,
        revenueSharePercent:
          totalRevenue <= 0 ? 0 : Math.round((row.revenue_cents / totalRevenue) * 1000) / 10,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      summary: {
        totalRevenueCents: summary.total_revenue_cents,
        totalDiscountCents: summary.total_discount_cents,
        totalNetCents: Math.max(0, summary.total_revenue_cents - summary.total_discount_cents),
        totalUnitsSold: summary.total_units_sold,
        productCount: summary.product_count,
        avgOrderCents:
          summary.total_units_sold === 0
            ? 0
            : Math.round(summary.total_revenue_cents / summary.total_units_sold),
        currency,
        currencies: summary.currencies.length > 0 ? summary.currencies : [currency],
        previousTotalRevenueCents: previousSummary.total_revenue_cents,
        previousTotalUnitsSold: previousSummary.total_units_sold,
        revenueChangePercent: previousFilter
          ? changePercent(summary.total_revenue_cents, previousSummary.total_revenue_cents)
          : null,
        unitsChangePercent: previousFilter
          ? changePercent(summary.total_units_sold, previousSummary.total_units_sold)
          : null,
        windowFrom: windowFrom?.toISOString() ?? null,
        windowTo: windowTo?.toISOString() ?? null,
      },
      productTypes,
    },
  });
}

export async function listSalesPurchasers(
  tx: TenantTx,
  _ctx: ServiceCtx,
  courseId: string,
  query: SalesPurchasersQuery,
) {
  const product = await salesMarketingRosterRepository.findSalesProduct(tx, courseId);
  if (!product) throw salesMarketingProductNotFound();

  const filter = toPurchaserFilter(courseId, {
    ...(query.learnerName ? { learnerName: query.learnerName } : {}),
    ...(query.email ? { email: query.email } : {}),
    ...(query.q ? { q: query.q } : {}),
    ...(query.enrolledType ? { enrolledType: query.enrolledType } : {}),
    ...(query.purchasedFrom ? { purchasedFrom: query.purchasedFrom } : {}),
    ...(query.purchasedTo ? { purchasedTo: query.purchasedTo } : {}),
  });

  const [totalCount, rows] = await Promise.all([
    salesMarketingRosterRepository.countPurchasers(tx, filter),
    salesMarketingRosterRepository.listPurchasers(tx, courseId, query),
  ]);

  const purchaserCount = Math.max(
    product.purchaser_count,
    product.paid_learner_count + product.trial_learner_count,
  );
  const discountedOrderPercent =
    product.purchaser_count === 0
      ? 0
      : Math.round((product.discounted_order_count / product.purchaser_count) * 1000) / 10;

  return salesPurchasersListResponseSchema.parse({
    data: {
      courseId: product.course_id,
      productTitle: product.product_title,
      productType: product.product_type,
      productStatus: product.product_status,
      revenueCents: product.revenue_cents,
      discountCents: product.discount_cents,
      avgOrderCents: product.avg_unit_price_cents,
      purchaserCount,
      paidLearnerCount: product.paid_learner_count,
      trialLearnerCount: product.trial_learner_count,
      discountedOrderCount: product.discounted_order_count,
      discountedOrderPercent,
      currency: product.currency,
      items: rows.map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        amountCents: row.amount_cents,
        discountCents: row.discount_cents,
        currency: row.currency,
        enrolledType: row.enrolled_type,
        couponCode: row.coupon_code,
        purchasedAt: row.purchased_at.toISOString(),
        paymentOrderId: row.payment_order_id,
        invoiceNumber: row.invoice_number,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
    },
  });
}

export async function resolveSalesPurchaserMembershipIds(
  tx: TenantTx,
  input: {
    courseId?: string;
    couponId?: string;
    membershipIds?: string[];
    learnerName?: string;
    email?: string;
    q?: string;
    enrolledType?: string;
    purchasedFrom?: string;
    purchasedTo?: string;
    appliedFrom?: string;
    appliedTo?: string;
    courseFilterId?: string;
  },
): Promise<string[]> {
  if (input.membershipIds && input.membershipIds.length > 0) {
    return [...new Set(input.membershipIds)];
  }
  if (input.couponId) {
    return salesMarketingRosterRepository.listCouponRedeemerMembershipIds(tx, input.couponId, {
      ...(input.learnerName ? { learnerName: input.learnerName } : {}),
      ...(input.q ? { q: input.q } : {}),
      ...(input.courseFilterId ? { courseId: input.courseFilterId } : {}),
      ...(input.appliedFrom ? { appliedFrom: input.appliedFrom } : {}),
      ...(input.appliedTo ? { appliedTo: input.appliedTo } : {}),
    });
  }
  if (!input.courseId) {
    return [];
  }
  return salesMarketingRosterRepository.listPurchaserMembershipIds(
    tx,
    toPurchaserFilter(input.courseId, input),
  );
}

export async function createSalesPurchaserGroup(
  tx: TenantTx,
  _ctx: ServiceCtx,
  input: {
    courseId?: string;
    couponId?: string;
    title: string;
    description?: string;
    membershipIds?: string[];
    learnerName?: string;
    email?: string;
    q?: string;
    enrolledType?: string;
    purchasedFrom?: string;
    purchasedTo?: string;
    appliedFrom?: string;
    appliedTo?: string;
    courseFilterId?: string;
  },
) {
  const membershipIds = await resolveSalesPurchaserMembershipIds(tx, input);
  if (membershipIds.length === 0) {
    throw salesMarketingGroupFailed(
      input.couponId
        ? "No redeemers matched the current filters."
        : "No purchasers matched the current filters.",
    );
  }

  let courseId = input.courseId ?? null;
  if (!courseId && input.couponId) {
    const products = await salesMarketingRosterRepository.listCouponRedemptionProducts(
      tx,
      input.couponId,
    );
    courseId = products.find((p) => p.course_id)?.course_id ?? null;
  }

  const batch = await batchesRepository.insertBatch(tx, {
    key: slugifyKey(input.title),
    name: input.title,
    courseId,
    status: "ACTIVE",
    metadataJson: {
      source: "sales_marketing_report",
      description: input.description ?? null,
      createdFrom: "reports.sales-marketing",
      ...(input.couponId ? { couponId: input.couponId } : {}),
    },
  });

  let memberCount = 0;
  for (const membershipId of membershipIds) {
    await batchesRepository.assignMember(tx, {
      batchId: batch.id,
      membershipId,
    });
    memberCount += 1;
  }

  return createSalesGroupResponseSchema.parse({
    data: {
      batchId: batch.id,
      key: batch.key,
      name: batch.name,
      memberCount,
    },
  });
}

export async function listSalesCoupons(tx: TenantTx, _ctx: ServiceCtx, query: CouponsListQuery) {
  const [totalCount, rows, summary] = await Promise.all([
    salesMarketingRosterRepository.countCoupons(tx, query),
    salesMarketingRosterRepository.listCoupons(tx, query),
    salesMarketingRosterRepository.getCouponsSummary(tx, query),
  ]);

  const gross = summary.total_revenue_cents;
  const discountPercentOfGross =
    gross === 0 ? 0 : Math.round((summary.total_discount_cents / gross) * 1000) / 10;
  const avgRedemptionsPerActive =
    summary.active_coupon_count === 0
      ? 0
      : Math.round((summary.total_redemptions / summary.active_coupon_count) * 10) / 10;

  return couponsListResponseSchema.parse({
    data: {
      items: rows.map((row) => {
        const capReached =
          row.total_usage_limit != null && row.redemption_count >= row.total_usage_limit;
        const displayStatus = capReached
          ? "CAP_REACHED"
          : row.status === "INACTIVE"
            ? "ARCHIVED"
            : row.status;
        return {
          id: row.id,
          code: row.code,
          name: row.name,
          status: row.status,
          displayStatus,
          discountType: row.discount_type,
          discountValue: row.discount_value,
          currency: row.currency,
          redemptionCount: row.redemption_count,
          totalUsageLimit: row.total_usage_limit,
          totalDiscountCents: row.total_discount_cents,
          totalRevenueCents: row.total_revenue_cents,
          netCents: row.total_revenue_cents - row.total_discount_cents,
          endsAt: row.ends_at ? row.ends_at.toISOString() : null,
          startsAt: row.starts_at ? row.starts_at.toISOString() : null,
          createdAt: row.created_at.toISOString(),
        };
      }),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      summary: {
        totalRevenueCents: summary.total_revenue_cents,
        totalDiscountCents: summary.total_discount_cents,
        totalNetCents: summary.total_revenue_cents - summary.total_discount_cents,
        totalRedemptions: summary.total_redemptions,
        couponCount: summary.coupon_count,
        activeCouponCount: summary.active_coupon_count,
        discountPercentOfGross,
        avgRedemptionsPerActive,
        currency: summary.currency,
      },
    },
  });
}

export async function listCouponRedemptions(
  tx: TenantTx,
  _ctx: ServiceCtx,
  couponId: string,
  query: CouponRedemptionsQuery,
) {
  const coupon = await salesMarketingRosterRepository.findCoupon(tx, couponId);
  if (!coupon) throw salesMarketingCouponNotFound();

  const [totalCount, rows, products, trend, firstTimeBuyerCount] = await Promise.all([
    salesMarketingRosterRepository.countRedemptions(tx, couponId, query),
    salesMarketingRosterRepository.listRedemptions(tx, couponId, query),
    salesMarketingRosterRepository.listCouponRedemptionProducts(tx, couponId),
    salesMarketingRosterRepository.listCouponRedemptionTrend(tx, couponId),
    salesMarketingRosterRepository.countCouponFirstTimeBuyers(tx, couponId),
  ]);

  const revenue = coupon.total_revenue_cents;
  const discount = coupon.total_discount_cents;
  const redemptions = coupon.redemption_count;
  const avgOrderCents = redemptions === 0 ? 0 : Math.round(revenue / redemptions);
  const firstTimeBuyerPercent =
    redemptions === 0 ? 0 : Math.round((firstTimeBuyerCount / redemptions) * 1000) / 10;
  const returningBuyerCount = Math.max(0, redemptions - firstTimeBuyerCount);
  const capReached =
    coupon.total_usage_limit != null && coupon.redemption_count >= coupon.total_usage_limit;
  const displayStatus = capReached
    ? "CAP_REACHED"
    : coupon.status === "INACTIVE"
      ? "ARCHIVED"
      : coupon.status;
  const totalProductRevenue = products.reduce((sum, p) => sum + p.revenue_cents, 0);

  return couponRedemptionsListResponseSchema.parse({
    data: {
      couponId: coupon.id,
      code: coupon.code,
      name: coupon.name,
      status: coupon.status,
      displayStatus,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      currency: coupon.currency,
      totalUsageLimit: coupon.total_usage_limit,
      redemptionCount: coupon.redemption_count,
      endsAt: coupon.ends_at ? coupon.ends_at.toISOString() : null,
      startsAt: coupon.starts_at ? coupon.starts_at.toISOString() : null,
      createdAt: coupon.created_at.toISOString(),
      summary: {
        totalRevenueCents: revenue,
        totalDiscountCents: discount,
        totalNetCents: revenue - discount,
        redemptionCount: redemptions,
        avgOrderCents,
        firstTimeBuyerCount,
        firstTimeBuyerPercent,
        returningBuyerCount,
        currency: coupon.currency,
      },
      products: products.map((p) => ({
        courseId: p.course_id,
        productTitle: p.product_title,
        redemptionCount: p.redemption_count,
        revenueCents: p.revenue_cents,
        discountCents: p.discount_cents,
        sharePercent:
          totalProductRevenue === 0
            ? 0
            : Math.round((p.revenue_cents / totalProductRevenue) * 1000) / 10,
      })),
      trend: trend.map((t) => ({
        date: t.date,
        redemptionCount: t.redemption_count,
        revenueCents: t.revenue_cents,
        discountCents: t.discount_cents,
      })),
      items: rows.map((row) => ({
        id: row.id,
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        productTitle: row.product_title,
        courseId: row.course_id,
        discountCents: row.discount_cents,
        originalAmountCents: row.original_amount_cents,
        finalAmountCents: row.final_amount_cents,
        currency: row.currency,
        paymentOrderId: row.payment_order_id,
        invoiceNumber: row.invoice_number,
        appliedAt: row.applied_at.toISOString(),
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
    },
  });
}

export async function listReferralWalletRoster(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ReferralWalletQuery,
) {
  const windowTo = query.activityTo ? new Date(query.activityTo) : new Date();
  const windowFrom = query.activityFrom
    ? new Date(query.activityFrom)
    : new Date(windowTo.getTime() - 30 * 24 * 60 * 60 * 1000);
  const durationMs = Math.max(windowTo.getTime() - windowFrom.getTime(), 24 * 60 * 60 * 1000);
  const previousTo = new Date(windowFrom.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - durationMs);

  const [totalCount, rows, summary] = await Promise.all([
    salesMarketingRosterRepository.countReferralWallet(tx, query),
    salesMarketingRosterRepository.listReferralWallet(tx, query),
    salesMarketingRosterRepository.getReferralWalletSummary(
      tx,
      windowFrom.toISOString(),
      windowTo.toISOString(),
      previousFrom.toISOString(),
      previousTo.toISOString(),
    ),
  ]);

  const days = Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)));
  const changePercent =
    summary.previous_successful_referrals === 0
      ? summary.successful_referrals > 0
        ? 100
        : null
      : Math.round(
          ((summary.successful_referrals - summary.previous_successful_referrals) /
            summary.previous_successful_referrals) *
            1000,
        ) / 10;

  return referralWalletListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        referralCode: row.referral_code,
        successfulReferrals: row.successful_referrals,
        creditEarned: row.credit_earned,
        walletBalance: row.wallet_balance,
        referredRevenueCents: row.referred_revenue_cents,
        signedUpAt: row.signed_up_at?.toISOString() ?? null,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
      summary: {
        successfulReferrals: summary.successful_referrals,
        previousSuccessfulReferrals: summary.previous_successful_referrals,
        changePercent,
        creditEarned: summary.credit_earned,
        creditOutstanding: summary.credit_outstanding,
        walletsWithBalance: summary.wallets_with_balance,
        referredRevenueCents: summary.referred_revenue_cents,
        referrerCount: summary.referrer_count,
        totalLearners: summary.total_learners,
        currency: summary.currency,
        windowFrom: windowFrom.toISOString(),
        windowTo: windowTo.toISOString(),
        windowLabel: days === 30 ? "Last 30 Days" : `${days} days`,
      },
    },
  });
}

export async function listReferredLearners(
  tx: TenantTx,
  _ctx: ServiceCtx,
  membershipId: string,
  query: ReferredLearnersQuery,
) {
  const referrer = await salesMarketingRosterRepository.findReferrer(tx, membershipId);
  if (!referrer) throw salesMarketingReferrerNotFound();

  const [totalCount, rows, totals] = await Promise.all([
    salesMarketingRosterRepository.countReferredLearners(tx, membershipId),
    salesMarketingRosterRepository.listReferredLearners(tx, membershipId, query),
    salesMarketingRosterRepository.getReferrerDrilldownTotals(tx, membershipId),
  ]);

  return referredLearnersListResponseSchema.parse({
    data: {
      referrer: {
        membershipId: referrer.membership_id,
        learnerName: referrer.learner_name,
        email: referrer.email,
        referralCode: referrer.referral_code,
      },
      items: rows.map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        signedUpAt: row.signed_up_at.toISOString(),
        firstPurchaseTitle: row.first_purchase_title,
        revenueAttributedCents: row.revenue_attributed_cents,
        creditAwarded: row.credit_awarded,
        currency: row.currency,
        status: row.status,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      totalCreditAwarded: totals.total_credit_awarded,
      totalRevenueCents: totals.total_revenue_cents,
      currency: totals.currency,
    },
  });
}

export async function listAffiliateProductsRoster(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: AffiliateProductsQuery,
) {
  const windowTo = query.activityTo ? new Date(query.activityTo) : new Date();
  const windowFrom = query.activityFrom
    ? new Date(query.activityFrom)
    : new Date(windowTo.getTime() - 30 * 24 * 60 * 60 * 1000);
  const durationMs = Math.max(windowTo.getTime() - windowFrom.getTime(), 24 * 60 * 60 * 1000);
  const days = Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)));
  const activityFromIso = windowFrom.toISOString();
  const activityToIso = windowTo.toISOString();

  const [totalCount, rows, summary] = await Promise.all([
    salesMarketingRosterRepository.countAffiliateProducts(tx, query),
    salesMarketingRosterRepository.listAffiliateProducts(tx, query, activityFromIso, activityToIso),
    salesMarketingRosterRepository.getAffiliateProductsSummary(tx, activityFromIso, activityToIso),
  ]);

  const netCents = Math.max(0, summary.revenue_cents - summary.commission_cents);
  const effectiveRatePct =
    summary.revenue_cents <= 0
      ? 0
      : Math.round((summary.commission_cents * 1000) / summary.revenue_cents) / 10;
  const avgOrderValueCents =
    summary.order_count <= 0 ? 0 : Math.round(summary.revenue_cents / summary.order_count);

  return affiliateProductsListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        courseId: row.course_id,
        productTitle: row.product_title,
        productType: row.product_type,
        enabled: row.enabled,
        commissionRatePct: row.commission_rate_pct,
        inheritsDefaultRate: row.inherits_default_rate,
        tenantDefaultCommissionPct: row.tenant_default_commission_pct,
        orderCount: row.order_count,
        revenueCents: row.revenue_cents,
        commissionCents: row.commission_cents,
        netCents: row.net_cents,
        effectiveRatePct: row.effective_rate_pct,
        activeAffiliateCount: row.active_affiliate_count,
        unpaidCommissionCents: row.unpaid_commission_cents,
        publishedAt: row.published_at?.toISOString() ?? null,
        currency: row.currency,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
      summary: {
        revenueCents: summary.revenue_cents,
        commissionCents: summary.commission_cents,
        netCents,
        orderCount: summary.order_count,
        avgOrderValueCents,
        effectiveRatePct,
        productsEnabled: summary.products_enabled,
        productsInProgramme: summary.products_in_programme,
        productsTotal: summary.products_total,
        tenantDefaultCommissionPct: summary.tenant_default_commission_pct,
        currency: summary.currency,
        windowFrom: activityFromIso,
        windowTo: activityToIso,
        windowLabel: days === 30 ? "Last 30 Days" : `${days} days`,
      },
    },
  });
}

export async function listAffiliatesRoster(tx: TenantTx, _ctx: ServiceCtx, query: AffiliatesQuery) {
  const windowTo = query.activityTo ? new Date(query.activityTo) : new Date();
  const windowFrom = query.activityFrom
    ? new Date(query.activityFrom)
    : new Date(windowTo.getTime() - 30 * 24 * 60 * 60 * 1000);
  const durationMs = Math.max(windowTo.getTime() - windowFrom.getTime(), 24 * 60 * 60 * 1000);
  const days = Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)));
  const activityFromIso = windowFrom.toISOString();
  const activityToIso = windowTo.toISOString();

  const [totalCount, rows, summary] = await Promise.all([
    salesMarketingRosterRepository.countAffiliates(tx, query, activityFromIso, activityToIso),
    salesMarketingRosterRepository.listAffiliates(tx, query, activityFromIso, activityToIso),
    salesMarketingRosterRepository.getAffiliatesSummary(tx, activityFromIso, activityToIso),
  ]);

  return affiliatesListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        affiliateId: row.affiliate_id,
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        tier: row.tier,
        status: row.status,
        couponCode: row.coupon_code,
        revenueContributionCents: row.revenue_contribution_cents,
        commissionEarnedCents: row.commission_earned_cents,
        unpaidCents: row.unpaid_cents,
        paidCents: row.paid_cents,
        signedUpAt: row.signed_up_at.toISOString(),
        currency: row.currency,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
      summary: {
        revenueCents: summary.revenue_cents,
        commissionCents: summary.commission_cents,
        unpaidCents: summary.unpaid_cents,
        unpaidAffiliateCount: summary.unpaid_affiliate_count,
        paidCents: summary.paid_cents,
        activeCount: summary.active_count,
        totalCount: summary.total_count,
        pendingApprovalCount: summary.pending_approval_count,
        currency: summary.currency,
        windowFrom: activityFromIso,
        windowTo: activityToIso,
        windowLabel: days === 30 ? "Last 30 Days" : `${days} days`,
      },
    },
  });
}

export async function getAffiliateDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  affiliateId: string,
  query: AffiliateDetailQuery,
) {
  const affiliate = await salesMarketingRosterRepository.findAffiliateById(tx, affiliateId);
  if (!affiliate) throw salesMarketingAffiliateNotFound();

  const [orders, ordersTotalCount, payouts, earningsTrend] = await Promise.all([
    salesMarketingRosterRepository.listAffiliateAttributedOrders(
      tx,
      affiliateId,
      query.ordersLimit,
    ),
    salesMarketingRosterRepository.countAffiliateAttributedOrders(tx, affiliateId),
    salesMarketingRosterRepository.listAffiliatePayoutHistory(tx, affiliateId, query.payoutsLimit),
    salesMarketingRosterRepository.listAffiliateEarningsTrend(tx, affiliateId),
  ]);

  return affiliateDetailResponseSchema.parse({
    data: {
      affiliate: {
        affiliateId: affiliate.affiliate_id,
        membershipId: affiliate.membership_id,
        learnerName: affiliate.learner_name,
        email: affiliate.email,
        tier: affiliate.tier,
        status: affiliate.status,
        couponCode: affiliate.coupon_code,
        revenueContributionCents: affiliate.revenue_contribution_cents,
        commissionEarnedCents: affiliate.commission_earned_cents,
        unpaidCents: affiliate.unpaid_cents,
        paidCents: affiliate.paid_cents,
        signedUpAt: affiliate.signed_up_at.toISOString(),
        currency: affiliate.currency,
      },
      earningsTrend: earningsTrend.map((point) => ({
        month: point.month,
        commissionCents: point.commission_cents,
        revenueCents: point.revenue_cents,
      })),
      orders: orders.map((order) => ({
        commissionId: order.commission_id,
        paymentOrderId: order.payment_order_id,
        invoiceNumber: order.invoice_number,
        learnerName: order.learner_name,
        learnerEmail: order.learner_email,
        productTitle: order.product_title,
        orderAmountCents: order.order_amount_cents,
        commissionCents: order.commission_cents,
        currency: order.currency,
        status: order.status,
        createdAt: order.created_at.toISOString(),
      })),
      ordersTotalCount,
      payouts: payouts.map((payout) => ({
        payoutId: payout.payout_id,
        amountCents: payout.amount_cents,
        currency: payout.currency,
        status: payout.status,
        note: payout.note,
        paidAt: payout.paid_at.toISOString(),
      })),
    },
  });
}

function resolveSalesMarketingOverviewWindow(query: SalesMarketingOverviewQuery): {
  windowFrom: Date;
  windowTo: Date;
  windowLabel: string;
  filter: SalesMarketingOverviewFilter;
} {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 36 * 24 * 60 * 60 * 1000);
  const windowFrom = query.paidFrom ? new Date(query.paidFrom) : defaultFrom;
  const windowTo = query.paidTo ? new Date(query.paidTo) : now;
  const days = Math.max(
    1,
    Math.round((windowTo.getTime() - windowFrom.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  const windowLabel =
    query.paidFrom || query.paidTo ? (days <= 40 ? `${days} days` : "Selected range") : "37 days";

  const filter: SalesMarketingOverviewFilter = {
    paidFrom: windowFrom.toISOString(),
    paidTo: windowTo.toISOString(),
  };
  if (query.currency) filter.currency = query.currency.toUpperCase();

  return { windowFrom, windowTo, windowLabel, filter };
}

function previousSalesMarketingWindow(
  windowFrom: Date,
  windowTo: Date,
): {
  from: Date;
  to: Date;
} {
  const durationMs = Math.max(windowTo.getTime() - windowFrom.getTime(), 24 * 60 * 60 * 1000);
  const to = new Date(windowFrom.getTime() - 1);
  const from = new Date(to.getTime() - durationMs);
  return { from, to };
}

function attributionPercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuidOrNull(value: string | null): string | null {
  if (!value) return null;
  return UUID_RE.test(value) ? value : null;
}

export async function getSalesMarketingOverview(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: SalesMarketingOverviewQuery,
) {
  const { windowFrom, windowTo, windowLabel, filter } = resolveSalesMarketingOverviewWindow(query);
  const previous = previousSalesMarketingWindow(windowFrom, windowTo);
  const previousFilter: SalesMarketingOverviewFilter = {
    paidFrom: previous.from.toISOString(),
    paidTo: previous.to.toISOString(),
  };
  if (filter.currency) previousFilter.currency = filter.currency;

  const [
    summary,
    previousRevenue,
    attribution,
    revenueTrend,
    topProducts,
    topCoupons,
    topAffiliates,
    attentionRaw,
  ] = await Promise.all([
    salesMarketingRosterRepository.getOverviewSummary(tx, filter),
    salesMarketingRosterRepository.getOverviewCollectedInWindow(tx, previousFilter),
    salesMarketingRosterRepository.getOverviewAttribution(tx, filter),
    salesMarketingRosterRepository.getOverviewRevenueTrend(tx, filter, query.grain),
    salesMarketingRosterRepository.getOverviewTopProducts(tx, filter),
    salesMarketingRosterRepository.getOverviewTopCoupons(tx, filter),
    salesMarketingRosterRepository.getOverviewTopAffiliates(tx, filter),
    salesMarketingRosterRepository.getOverviewAttention(tx),
  ]);

  const currency = filter.currency ?? summary.currencies[0] ?? "INR";

  const changePercent =
    previousRevenue === 0
      ? summary.attributed_revenue_cents > 0
        ? 100
        : null
      : Math.round(
          ((summary.attributed_revenue_cents - previousRevenue) / previousRevenue) * 1000,
        ) / 10;

  const attributionTotal =
    attribution.direct_cents +
    attribution.coupon_cents +
    attribution.referral_cents +
    attribution.affiliate_cents;

  const attention: Array<{
    key: string;
    label: string;
    href: string;
    count: number | null;
  }> = [];

  if (attentionRaw.unpaid_commission_count > 0) {
    attention.push({
      key: "unpaid_payouts",
      label: `Review ${attentionRaw.unpaid_commission_count} pending affiliate payouts`,
      href: "/admin/reports/sales-marketing?tab=affiliates",
      count: attentionRaw.unpaid_commission_count,
    });
  }
  if (attentionRaw.over_limit_coupon_count > 0) {
    attention.push({
      key: "over_limit_coupons",
      label: `${attentionRaw.over_limit_coupon_count} coupon${attentionRaw.over_limit_coupon_count === 1 ? "" : "s"} used beyond limit`,
      href: "/admin/reports/sales-marketing?tab=coupons",
      count: attentionRaw.over_limit_coupon_count,
    });
  }
  if (attentionRaw.pending_referral_count > 0) {
    attention.push({
      key: "pending_referrals",
      label: `Verify ${attentionRaw.pending_referral_count} pending referral attribution${attentionRaw.pending_referral_count === 1 ? "" : "s"}`,
      href: "/admin/reports/sales-marketing?tab=referral-wallet",
      count: attentionRaw.pending_referral_count,
    });
  }
  if (attentionRaw.pending_affiliate_request_count > 0) {
    attention.push({
      key: "pending_affiliate_requests",
      label: `Review ${attentionRaw.pending_affiliate_request_count} affiliate request${attentionRaw.pending_affiliate_request_count === 1 ? "" : "s"}`,
      href: "/admin/reports/sales-marketing?tab=affiliates",
      count: attentionRaw.pending_affiliate_request_count,
    });
  }

  const netToTenantCents =
    summary.attributed_revenue_cents -
    summary.discount_given_cents -
    summary.commission_earned_cents;

  return salesMarketingOverviewResponseSchema.parse({
    data: {
      summary: {
        attributedRevenueCents: summary.attributed_revenue_cents,
        discountGivenCents: summary.discount_given_cents,
        commissionEarnedCents: summary.commission_earned_cents,
        referralCredit: summary.referral_credit,
        netToTenantCents,
        currency,
        currencies: summary.currencies.length > 0 ? summary.currencies : [currency],
        orderCount: summary.order_count,
        previousAttributedRevenueCents: previousRevenue,
        changePercent,
        windowLabel,
        windowFrom: windowFrom.toISOString(),
        windowTo: windowTo.toISOString(),
      },
      attribution: {
        directCents: attribution.direct_cents,
        couponCents: attribution.coupon_cents,
        referralCents: attribution.referral_cents,
        affiliateCents: attribution.affiliate_cents,
        directPercent: attributionPercent(attribution.direct_cents, attributionTotal),
        couponPercent: attributionPercent(attribution.coupon_cents, attributionTotal),
        referralPercent: attributionPercent(attribution.referral_cents, attributionTotal),
        affiliatePercent: attributionPercent(attribution.affiliate_cents, attributionTotal),
      },
      revenueTrend: revenueTrend.map((row) => ({
        date: row.date,
        directCents: row.direct_cents,
        couponCents: row.coupon_cents,
        referralCents: row.referral_cents,
        affiliateCents: row.affiliate_cents,
        totalCents: row.total_cents,
        orderCount: row.order_count,
      })),
      topProducts: topProducts.map((row) => ({
        courseId: asUuidOrNull(row.course_id),
        productTitle: row.product_title,
        productType: row.product_type,
        purchaserCount: row.purchaser_count,
        revenueCents: row.revenue_cents,
        discountCents: row.discount_cents,
        netCents: row.net_cents,
      })),
      topCoupons: topCoupons.map((row) => ({
        id: row.id,
        code: row.code,
        uses: row.uses,
        generatedCents: row.generated_cents,
      })),
      topAffiliates: topAffiliates.map((row) => ({
        affiliateId: row.affiliate_id,
        name: row.name,
        commissionCents: row.commission_cents,
        unpaidCents: row.unpaid_cents,
      })),
      attention,
    },
  });
}
