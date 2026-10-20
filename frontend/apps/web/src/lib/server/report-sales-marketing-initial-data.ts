import "server-only";
import {
  AFFILIATES_DEFAULTS,
  AFFILIATE_PRODUCTS_DEFAULTS,
  COUPON_REDEMPTIONS_DEFAULTS,
  REFERRAL_WALLET_DEFAULTS,
  SALES_COUPONS_DEFAULTS,
  SALES_PRODUCTS_DEFAULTS,
  SALES_PURCHASERS_DEFAULTS,
  affiliateProductsPath,
  affiliatesPath,
  couponRedemptionsPath,
  dateInputToEndIso,
  dateInputToStartIso,
  referralWalletPath,
  salesCouponsPath,
  salesMarketingRangeBefore,
  salesProductsPath,
  salesPurchasersPath,
  type AffiliateProductsPayload,
  type AffiliatesPayload,
  type CouponRedemptionsPayload,
  type CouponsList,
  type ReferralWalletPayload,
  type SalesProductsList,
  type SalesPurchasersList,
} from "../../features/admin/reports/admin-sales-marketing-roster-api";
import { loadReportInitialData, type ReportInitialDataInRange } from "./report-initial-data";

/*
 * The first data each Sales & Marketing panel and detail page shows, loaded
 * on the server so the page arrives filled in. Every path is the one the
 * page's own first browser load would request, so the page can skip that
 * load; each resolves null on failure and the page then loads in the browser
 * as before.
 */

async function loadInRange<T>(
  range: { from: string; to: string },
  path: string,
): Promise<ReportInitialDataInRange<T> | null> {
  const loaded = await loadReportInitialData<T>(path);
  return loaded === null ? null : { ...loaded, range };
}

/** Sales by product over its default range. */
export function loadSalesProductsData() {
  const { rangeDays, ...defaults } = SALES_PRODUCTS_DEFAULTS;
  const range = salesMarketingRangeBefore(rangeDays);
  return loadInRange<SalesProductsList>(
    range,
    salesProductsPath({
      ...defaults,
      paidFrom: dateInputToStartIso(range.from),
      paidTo: dateInputToEndIso(range.to),
    }),
  );
}

export function loadSalesCouponsData() {
  return loadReportInitialData<CouponsList>(salesCouponsPath(SALES_COUPONS_DEFAULTS));
}

/** Referral and wallet over its default activity range. */
export function loadReferralWalletData() {
  const { rangeDays, ...defaults } = REFERRAL_WALLET_DEFAULTS;
  const range = salesMarketingRangeBefore(rangeDays);
  return loadInRange<ReferralWalletPayload>(
    range,
    referralWalletPath({
      ...defaults,
      activityFrom: dateInputToStartIso(range.from),
      activityTo: dateInputToEndIso(range.to),
    }),
  );
}

/** Affiliate products over their default activity range. */
export function loadAffiliateProductsData() {
  const { rangeDays, ...defaults } = AFFILIATE_PRODUCTS_DEFAULTS;
  const range = salesMarketingRangeBefore(rangeDays);
  return loadInRange<AffiliateProductsPayload>(
    range,
    affiliateProductsPath({
      ...defaults,
      activityFrom: dateInputToStartIso(range.from),
      activityTo: dateInputToEndIso(range.to),
    }),
  );
}

/** Affiliates over their default activity range. */
export function loadAffiliatesData() {
  const { rangeDays, ...defaults } = AFFILIATES_DEFAULTS;
  const range = salesMarketingRangeBefore(rangeDays);
  return loadInRange<AffiliatesPayload>(
    range,
    affiliatesPath({
      ...defaults,
      activityFrom: dateInputToStartIso(range.from),
      activityTo: dateInputToEndIso(range.to),
    }),
  );
}

/** A product's first page of purchasers. */
export function loadSalesPurchasersData(courseId: string) {
  return loadReportInitialData<SalesPurchasersList>(
    salesPurchasersPath(courseId, SALES_PURCHASERS_DEFAULTS),
  );
}

/** A coupon's first page of redemptions. */
export function loadCouponRedemptionsData(couponId: string) {
  return loadReportInitialData<CouponRedemptionsPayload>(
    couponRedemptionsPath(couponId, COUPON_REDEMPTIONS_DEFAULTS),
  );
}
