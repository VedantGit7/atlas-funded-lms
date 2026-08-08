"use client";

import { clientApi } from "../../../lib/client-api";

export const SALES_PURCHASER_COLUMN_OPTIONS = [
  { key: "learner_name", label: "Learner" },
  { key: "email", label: "Email" },
  { key: "amount_cents", label: "Amount" },
  { key: "currency", label: "Currency" },
  { key: "enrolled_type", label: "Enrolment" },
  { key: "coupon_code", label: "Coupon" },
  { key: "payment_order_id", label: "Order" },
  { key: "purchased_at", label: "Purchased on" },
] as const;

export type SalesPurchaserColumnKey = (typeof SALES_PURCHASER_COLUMN_OPTIONS)[number]["key"];

export type SalesSection =
  | "sales"
  | "coupons"
  | "referral-wallet"
  | "affiliate-products"
  | "affiliates";

export type SalesProductItem = {
  courseId: string;
  productTitle: string;
  productType: string;
  revenueCents: number;
  discountCents: number;
  netCents: number;
  currency: string;
  unitsSold: number;
  paidLearnerCount: number;
  trialLearnerCount: number;
  purchaserCount: number;
  avgUnitPriceCents: number;
  revenueSharePercent: number;
};

export type SalesProductsSummary = {
  totalRevenueCents: number;
  totalDiscountCents: number;
  totalNetCents: number;
  totalUnitsSold: number;
  productCount: number;
  avgOrderCents: number;
  currency: string;
  currencies: string[];
  previousTotalRevenueCents: number;
  previousTotalUnitsSold: number;
  revenueChangePercent: number | null;
  unitsChangePercent: number | null;
  windowFrom: string | null;
  windowTo: string | null;
};

export type SalesProductsList = {
  items: SalesProductItem[];
  pageInfo: PageInfo;
  summary: SalesProductsSummary;
  productTypes: string[];
};

export type SalesProductsSortBy =
  | "revenue_cents"
  | "purchaser_count"
  | "product_title"
  | "discount_cents"
  | "net_cents";

export type SalesPurchaserItem = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  amountCents: number;
  discountCents: number;
  currency: string;
  enrolledType: string | null;
  couponCode: string | null;
  purchasedAt: string;
  paymentOrderId: string | null;
  invoiceNumber: string | null;
};

export type SalesPurchasersList = {
  courseId: string;
  productTitle: string;
  productType: string;
  productStatus: string;
  revenueCents: number;
  discountCents: number;
  avgOrderCents: number;
  purchaserCount: number;
  paidLearnerCount: number;
  trialLearnerCount: number;
  discountedOrderCount: number;
  discountedOrderPercent: number;
  currency: string;
  items: SalesPurchaserItem[];
  pageInfo: PageInfo;
  columns: string[];
};

export type CouponListItem = {
  id: string;
  code: string;
  name: string;
  status: string;
  displayStatus: string;
  discountType: string;
  discountValue: number;
  currency: string;
  redemptionCount: number;
  totalUsageLimit: number | null;
  totalDiscountCents: number;
  totalRevenueCents: number;
  netCents: number;
  endsAt: string | null;
  startsAt: string | null;
  createdAt: string;
};

export type CouponsListSummary = {
  totalRevenueCents: number;
  totalDiscountCents: number;
  totalNetCents: number;
  totalRedemptions: number;
  couponCount: number;
  activeCouponCount: number;
  discountPercentOfGross: number;
  avgRedemptionsPerActive: number;
  currency: string;
};

export type CouponsListView = "all" | "active" | "never_used" | "expiring_soon" | "inactive";

export type CouponsListSortBy =
  | "revenue_cents"
  | "discount_cents"
  | "redemption_count"
  | "created_at"
  | "net_cents"
  | "code";

export type CouponsList = {
  items: CouponListItem[];
  pageInfo: PageInfo;
  summary: CouponsListSummary;
};

export type CouponRedemptionItem = {
  id: string;
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  productTitle: string | null;
  courseId: string | null;
  discountCents: number;
  originalAmountCents: number;
  finalAmountCents: number;
  currency: string;
  paymentOrderId: string | null;
  invoiceNumber: string | null;
  appliedAt: string;
};

export type CouponRedemptionProduct = {
  courseId: string | null;
  productTitle: string;
  redemptionCount: number;
  revenueCents: number;
  discountCents: number;
  sharePercent: number;
};

export type CouponRedemptionTrendPoint = {
  date: string;
  redemptionCount: number;
  revenueCents: number;
  discountCents: number;
};

export type CouponRedemptionsSummary = {
  totalRevenueCents: number;
  totalDiscountCents: number;
  totalNetCents: number;
  redemptionCount: number;
  avgOrderCents: number;
  firstTimeBuyerCount: number;
  firstTimeBuyerPercent: number;
  returningBuyerCount: number;
  currency: string;
};

export type CouponRedemptionsPayload = {
  couponId: string;
  code: string;
  name: string;
  status: string;
  displayStatus: string;
  discountType: string;
  discountValue: number;
  currency: string;
  totalUsageLimit: number | null;
  redemptionCount: number;
  endsAt: string | null;
  startsAt: string | null;
  createdAt: string;
  summary: CouponRedemptionsSummary;
  products: CouponRedemptionProduct[];
  trend: CouponRedemptionTrendPoint[];
  items: CouponRedemptionItem[];
  pageInfo: PageInfo;
  columns: string[];
};

export type CouponRedemptionsSortBy =
  | "applied_at"
  | "discount_cents"
  | "learner_name"
  | "final_amount_cents";

export type ReferralWalletItem = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  referralCode: string | null;
  successfulReferrals: number;
  creditEarned: number;
  walletBalance: number;
  referredRevenueCents: number;
  signedUpAt: string | null;
};

export type ReferralWalletSummary = {
  successfulReferrals: number;
  previousSuccessfulReferrals: number;
  changePercent: number | null;
  creditEarned: number;
  creditOutstanding: number;
  walletsWithBalance: number;
  referredRevenueCents: number;
  referrerCount: number;
  totalLearners: number;
  currency: string;
  windowFrom: string;
  windowTo: string;
  windowLabel: string;
};

export type ReferralWalletPayload = {
  items: ReferralWalletItem[];
  pageInfo: PageInfo;
  columns: string[];
  summary: ReferralWalletSummary;
};

export type ReferredLearnerItem = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  signedUpAt: string;
  firstPurchaseTitle: string | null;
  revenueAttributedCents: number;
  creditAwarded: number;
  currency: string;
  status: "QUALIFIED" | "PENDING" | "DISQUALIFIED";
};

export type ReferredLearnersPayload = {
  referrer: {
    membershipId: string;
    learnerName: string | null;
    email: string | null;
    referralCode: string | null;
  };
  items: ReferredLearnerItem[];
  pageInfo: PageInfo;
  totalCreditAwarded: number;
  totalRevenueCents: number;
  currency: string;
};

export type AffiliateProductItem = {
  courseId: string;
  productTitle: string;
  productType: string;
  enabled: boolean;
  commissionRatePct: number;
  inheritsDefaultRate: boolean;
  tenantDefaultCommissionPct: number;
  orderCount: number;
  revenueCents: number;
  commissionCents: number;
  netCents: number;
  effectiveRatePct: number;
  activeAffiliateCount: number;
  unpaidCommissionCents: number;
  publishedAt: string | null;
  currency: string;
};

export type AffiliateProductsSummary = {
  revenueCents: number;
  commissionCents: number;
  netCents: number;
  orderCount: number;
  avgOrderValueCents: number;
  effectiveRatePct: number;
  productsEnabled: number;
  productsInProgramme: number;
  productsTotal: number;
  tenantDefaultCommissionPct: number;
  currency: string;
  windowFrom: string;
  windowTo: string;
  windowLabel: string;
};

export type AffiliateProductsPayload = {
  items: AffiliateProductItem[];
  pageInfo: PageInfo;
  columns: string[];
  summary: AffiliateProductsSummary;
};

export type AffiliateItem = {
  affiliateId: string;
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  tier: string;
  status: string;
  couponCode: string;
  revenueContributionCents: number;
  commissionEarnedCents: number;
  unpaidCents: number;
  paidCents: number;
  signedUpAt: string;
  currency: string;
};

export type AffiliatesSummary = {
  revenueCents: number;
  commissionCents: number;
  unpaidCents: number;
  unpaidAffiliateCount: number;
  paidCents: number;
  activeCount: number;
  totalCount: number;
  pendingApprovalCount: number;
  currency: string;
  windowFrom: string;
  windowTo: string;
  windowLabel: string;
};

export type AffiliatesPayload = {
  items: AffiliateItem[];
  pageInfo: PageInfo;
  columns: string[];
  summary: AffiliatesSummary;
};

export type AffiliateAttributedOrder = {
  commissionId: string;
  paymentOrderId: string;
  invoiceNumber: string | null;
  learnerName: string | null;
  learnerEmail: string | null;
  productTitle: string;
  orderAmountCents: number;
  commissionCents: number;
  currency: string;
  status: string;
  createdAt: string;
};

export type AffiliatePayoutHistoryItem = {
  payoutId: string;
  amountCents: number;
  currency: string;
  status: string;
  note: string | null;
  paidAt: string;
};

export type AffiliateEarningsPoint = {
  month: string;
  commissionCents: number;
  revenueCents: number;
};

export type AffiliateDetailPayload = {
  affiliate: AffiliateItem;
  earningsTrend: AffiliateEarningsPoint[];
  orders: AffiliateAttributedOrder[];
  ordersTotalCount: number;
  payouts: AffiliatePayoutHistoryItem[];
};

export type AffiliatePendingRequest = {
  id: string;
  membershipId: string;
  displayName: string | null;
  email: string | null;
  status: string;
  note: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type SalesMarketingOverviewGrain = "day" | "week" | "month";

export type SalesMarketingOverview = {
  summary: {
    attributedRevenueCents: number;
    discountGivenCents: number;
    commissionEarnedCents: number;
    referralCredit: number;
    netToTenantCents: number;
    currency: string;
    currencies: string[];
    orderCount: number;
    previousAttributedRevenueCents: number;
    changePercent: number | null;
    windowLabel: string;
    windowFrom: string;
    windowTo: string;
  };
  attribution: {
    directCents: number;
    couponCents: number;
    referralCents: number;
    affiliateCents: number;
    directPercent: number;
    couponPercent: number;
    referralPercent: number;
    affiliatePercent: number;
  };
  revenueTrend: Array<{
    date: string;
    directCents: number;
    couponCents: number;
    referralCents: number;
    affiliateCents: number;
    totalCents: number;
    orderCount: number;
  }>;
  topProducts: Array<{
    courseId: string | null;
    productTitle: string;
    productType: string;
    purchaserCount: number;
    revenueCents: number;
    discountCents: number;
    netCents: number;
  }>;
  topCoupons: Array<{
    id: string;
    code: string;
    uses: number;
    generatedCents: number;
  }>;
  topAffiliates: Array<{
    affiliateId: string;
    name: string;
    commissionCents: number;
    unpaidCents: number;
  }>;
  attention: Array<{
    key: string;
    label: string;
    href: string;
    count: number | null;
  }>;
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
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

export function formatMoney(cents: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export async function fetchSalesMarketingOverview(filters: {
  paidFrom?: string | undefined;
  paidTo?: string | undefined;
  currency?: string | undefined;
  grain?: SalesMarketingOverviewGrain | undefined;
}) {
  return clientApi.get<{ data: SalesMarketingOverview }>(
    `/api/v1/reports/sales-marketing/overview${buildQuery({
      paidFrom: filters.paidFrom,
      paidTo: filters.paidTo,
      currency: filters.currency,
      grain: filters.grain,
    })}`,
  );
}

export async function fetchSalesProducts(filters?: {
  q?: string | undefined;
  paidFrom?: string | undefined;
  paidTo?: string | undefined;
  productType?: string | undefined;
  currency?: string | undefined;
  sortBy?: SalesProductsSortBy | undefined;
  sortDir?: "asc" | "desc" | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{ data: SalesProductsList }>(
    `/api/v1/reports/sales-marketing/sales${buildQuery({
      q: filters?.q,
      paidFrom: filters?.paidFrom,
      paidTo: filters?.paidTo,
      productType: filters?.productType,
      currency: filters?.currency,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function fetchSalesPurchasers(
  courseId: string,
  filters: {
    learnerName?: string | undefined;
    email?: string | undefined;
    q?: string | undefined;
    enrolledType?: string | undefined;
    purchasedFrom?: string | undefined;
    purchasedTo?: string | undefined;
    sortBy?: string | undefined;
    sortDir?: "asc" | "desc" | undefined;
    columns?: SalesPurchaserColumnKey[] | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  },
) {
  return clientApi.get<{ data: SalesPurchasersList }>(
    `/api/v1/reports/sales-marketing/sales/${courseId}/purchasers${buildQuery({
      learnerName: filters.learnerName,
      email: filters.email,
      q: filters.q,
      enrolledType: filters.enrolledType,
      purchasedFrom: filters.purchasedFrom,
      purchasedTo: filters.purchasedTo,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      columns: filters.columns?.join(","),
      page: filters.page ?? 1,
      limit: filters.limit ?? 25,
    })}`,
  );
}

export async function fetchSalesCoupons(filters?: {
  q?: string | undefined;
  status?: string | undefined;
  discountType?: string | undefined;
  view?: CouponsListView | undefined;
  sortBy?: CouponsListSortBy | undefined;
  sortDir?: "asc" | "desc" | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{ data: CouponsList }>(
    `/api/v1/reports/sales-marketing/coupons${buildQuery({
      q: filters?.q,
      status: filters?.status,
      discountType: filters?.discountType,
      view: filters?.view,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function fetchCouponRedemptions(
  couponId: string,
  filters?: {
    learnerName?: string | undefined;
    q?: string | undefined;
    courseId?: string | undefined;
    appliedFrom?: string | undefined;
    appliedTo?: string | undefined;
    minFinalAmountCents?: number | undefined;
    maxFinalAmountCents?: number | undefined;
    sortBy?: CouponRedemptionsSortBy | undefined;
    sortDir?: "asc" | "desc" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  },
) {
  return clientApi.get<{ data: CouponRedemptionsPayload }>(
    `/api/v1/reports/sales-marketing/coupons/${couponId}/redemptions${buildQuery({
      learnerName: filters?.learnerName,
      q: filters?.q,
      courseId: filters?.courseId,
      appliedFrom: filters?.appliedFrom,
      appliedTo: filters?.appliedTo,
      minFinalAmountCents: filters?.minFinalAmountCents,
      maxFinalAmountCents: filters?.maxFinalAmountCents,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function fetchReferralWallet(filters?: {
  q?: string | undefined;
  signedUpFrom?: string | undefined;
  signedUpTo?: string | undefined;
  activityFrom?: string | undefined;
  activityTo?: string | undefined;
  minCreditEarned?: number | undefined;
  minWalletBalance?: number | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{ data: ReferralWalletPayload }>(
    `/api/v1/reports/sales-marketing/referral-wallet${buildQuery({
      q: filters?.q,
      signedUpFrom: filters?.signedUpFrom,
      signedUpTo: filters?.signedUpTo,
      activityFrom: filters?.activityFrom,
      activityTo: filters?.activityTo,
      minCreditEarned: filters?.minCreditEarned,
      minWalletBalance: filters?.minWalletBalance,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function fetchReferredLearners(
  membershipId: string,
  filters?: { page?: number | undefined; limit?: number | undefined },
) {
  return clientApi.get<{ data: ReferredLearnersPayload }>(
    `/api/v1/reports/sales-marketing/referral-wallet/${membershipId}/referred${buildQuery({
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 100,
    })}`,
  );
}

export async function fetchAffiliateProducts(filters?: {
  q?: string | undefined;
  enabled?: "all" | "enabled" | "disabled" | undefined;
  commissionBand?: "any" | "below_10" | "10_20" | "above_20" | undefined;
  activityFrom?: string | undefined;
  activityTo?: string | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{ data: AffiliateProductsPayload }>(
    `/api/v1/reports/sales-marketing/affiliate-products${buildQuery({
      q: filters?.q,
      enabled: filters?.enabled,
      commissionBand: filters?.commissionBand,
      activityFrom: filters?.activityFrom,
      activityTo: filters?.activityTo,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 50,
    })}`,
  );
}

export async function upsertAffiliateProduct(body: {
  courseId: string;
  enabled: boolean;
  standardCommissionPct?: number | null | undefined;
  standardDiscountPct?: number | null | undefined;
  premiumCommissionPct?: number | null | undefined;
  premiumDiscountPct?: number | null | undefined;
}) {
  return clientApi.put<{
    data: {
      items: Array<{
        courseId: string;
        courseTitle: string | null;
        enabled: boolean;
        standardDiscountPct: number | null;
        standardCommissionPct: number | null;
        premiumDiscountPct: number | null;
        premiumCommissionPct: number | null;
        updatedAt: string;
      }>;
    };
  }>("/api/v1/sales/affiliates/products", body, "affiliate-product-upsert", {
    successMessage: body.enabled ? "Affiliate programme enabled." : "Affiliate programme disabled.",
  });
}

export async function fetchAffiliates(filters?: {
  q?: string | undefined;
  status?: string | undefined;
  tier?: string | undefined;
  unpaidBand?: string | undefined;
  view?: string | undefined;
  activityFrom?: string | undefined;
  activityTo?: string | undefined;
  signedUpFrom?: string | undefined;
  signedUpTo?: string | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{ data: AffiliatesPayload }>(
    `/api/v1/reports/sales-marketing/affiliates${buildQuery({
      q: filters?.q,
      status: filters?.status,
      tier: filters?.tier,
      unpaidBand: filters?.unpaidBand,
      view: filters?.view,
      activityFrom: filters?.activityFrom,
      activityTo: filters?.activityTo,
      signedUpFrom: filters?.signedUpFrom,
      signedUpTo: filters?.signedUpTo,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    })}`,
  );
}

export async function fetchAffiliateDetail(
  affiliateId: string,
  filters?: { ordersLimit?: number | undefined; payoutsLimit?: number | undefined },
) {
  return clientApi.get<{ data: AffiliateDetailPayload }>(
    `/api/v1/reports/sales-marketing/affiliates/${affiliateId}${buildQuery({
      ordersLimit: filters?.ordersLimit ?? 25,
      payoutsLimit: filters?.payoutsLimit ?? 20,
    })}`,
  );
}

export async function fetchPendingAffiliateRequests() {
  return clientApi.get<{ data: { items: AffiliatePendingRequest[] } }>(
    "/api/v1/sales/affiliates/requests?status=PENDING&limit=100",
  );
}

export async function reviewAffiliateRequest(requestId: string, action: "approve" | "reject") {
  return clientApi.post(
    `/api/v1/sales/affiliates/requests/${requestId}/review`,
    { action },
    "affiliate-request-review",
    {
      successMessage: action === "approve" ? "Affiliate approved." : "Affiliate request declined.",
    },
  );
}

export async function updateAffiliatePartner(
  affiliateId: string,
  body: { status?: "ACTIVE" | "INACTIVE" | undefined; tier?: "STANDARD" | "PREMIUM" | undefined },
) {
  return clientApi.put(
    `/api/v1/sales/affiliates/partners/${affiliateId}`,
    body,
    "affiliate-partner-update",
    {
      successMessage:
        body.status === "INACTIVE"
          ? "Affiliate suspended."
          : body.status === "ACTIVE"
            ? "Affiliate reactivated."
            : "Affiliate updated.",
    },
  );
}

export async function recordAffiliatePayout(body: {
  affiliateId: string;
  note?: string | null | undefined;
}) {
  return clientApi.post("/api/v1/sales/affiliates/payouts", body, "affiliate-payout-record", {
    successMessage: "Payout recorded.",
  });
}

export async function exportSalesMarketingReport(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/sales-marketing/export",
    body,
    "sales-marketing-export",
    { successMessage: "Sales & Marketing export queued." },
  );
}

export async function sendSalesMarketingMessage(body: Record<string, unknown>) {
  return clientApi.post<{
    data: { deliveredCount: number; skippedCount: number; recipientCount: number };
  }>("/api/v1/reports/sales-marketing/messages", body, "sales-marketing-message", {
    successMessage: "Message queued for matched purchasers.",
  });
}

export async function createSalesMarketingGroup(body: Record<string, unknown>) {
  return clientApi.post<{
    data: { batchId: string; key: string; name: string; memberCount: number };
  }>("/api/v1/reports/sales-marketing/groups", body, "sales-marketing-group", {
    successMessage: "Group created from purchasers.",
  });
}
