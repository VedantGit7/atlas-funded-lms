import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ paths: [] as string[], fail: false }));
vi.mock("../../../frontend/apps/web/src/lib/server-api", () => ({
  serverApi: {
    get: (path: string) => {
      state.paths.push(path);
      return state.fail
        ? Promise.reject(new Error("The report is unavailable."))
        : Promise.resolve({ data: { path } });
    },
  },
}));

const sales =
  await import("../../../frontend/apps/web/src/lib/server/report-sales-marketing-initial-data");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-17T07:30:00.000Z"));
  state.paths = [];
  state.fail = false;
});

afterEach(() => {
  vi.useRealTimers();
});

const S = "/api/v1/reports/sales-marketing";
const FROM = "2026-09-17T00%3A00%3A00.000Z";
const TO = "2026-10-17T23%3A59%3A59.999Z";

/*
 * Each Sales & Marketing panel and detail page skips its first browser load
 * when the server sent data, so the server must ask for exactly what that
 * load would have. These are the requests the pages made in the browser
 * before they were server-rendered.
 */
describe("Sales & Marketing initial data", () => {
  it("asks for what each panel's and detail page's first browser load would", async () => {
    await sales.loadSalesProductsData();
    await sales.loadSalesCouponsData();
    await sales.loadReferralWalletData();
    await sales.loadAffiliateProductsData();
    await sales.loadAffiliatesData();
    await sales.loadSalesPurchasersData("course-1");
    await sales.loadCouponRedemptionsData("coupon-1");
    expect(state.paths).toEqual([
      `${S}/sales?paidFrom=${FROM}&paidTo=${TO}&sortBy=revenue_cents&sortDir=desc&page=1&limit=25`,
      `${S}/coupons?view=all&sortBy=revenue_cents&sortDir=desc&page=1&limit=25`,
      `${S}/referral-wallet?activityFrom=${FROM}&activityTo=${TO}&sortBy=successful_referrals&sortDir=desc&page=1&limit=25`,
      `${S}/affiliate-products?enabled=all&commissionBand=any&activityFrom=${FROM}&activityTo=${TO}&sortBy=revenue_cents&sortDir=desc&page=1&limit=50`,
      `${S}/affiliates?view=all&activityFrom=${FROM}&activityTo=${TO}&sortDir=desc&page=1&limit=25`,
      `${S}/sales/course-1/purchasers?columns=learner_name%2Camount_cents%2Cenrolled_type%2Ccoupon_code%2Cpayment_order_id%2Cpurchased_at&page=1&limit=25`,
      `${S}/coupons/coupon-1/redemptions?sortBy=applied_at&sortDir=desc&page=1&limit=25`,
    ]);
  });

  it("starts the ranged panels on the range they counted", async () => {
    const range = { from: "2026-09-17", to: "2026-10-17" };
    await expect(sales.loadSalesProductsData()).resolves.toMatchObject({ range });
    await expect(sales.loadReferralWalletData()).resolves.toMatchObject({ range });
    await expect(sales.loadAffiliateProductsData()).resolves.toMatchObject({ range });
    await expect(sales.loadAffiliatesData()).resolves.toMatchObject({ range });
  });

  it("keeps ids inside their own path segments", async () => {
    await sales.loadSalesPurchasersData("a/b");
    await sales.loadCouponRedemptionsData("c?d");
    expect(state.paths.map((path) => path.split("?")[0])).toEqual([
      `${S}/sales/a%2Fb/purchasers`,
      `${S}/coupons/c%3Fd/redemptions`,
    ]);
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.fail = true;
    await expect(sales.loadSalesProductsData()).resolves.toBeNull();
    await expect(sales.loadSalesCouponsData()).resolves.toBeNull();
    await expect(sales.loadReferralWalletData()).resolves.toBeNull();
    await expect(sales.loadAffiliateProductsData()).resolves.toBeNull();
    await expect(sales.loadAffiliatesData()).resolves.toBeNull();
    await expect(sales.loadSalesPurchasersData("course-1")).resolves.toBeNull();
    await expect(sales.loadCouponRedemptionsData("coupon-1")).resolves.toBeNull();
  });
});
