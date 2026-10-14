import { salesMarketingRosterProductsRepository } from "./sales-marketing-roster-products.repository";
import { salesMarketingRosterCouponsRepository } from "./sales-marketing-roster-coupons.repository";
import { salesMarketingRosterReferralsRepository } from "./sales-marketing-roster-referrals.repository";
import { salesMarketingRosterAffiliatesRepository } from "./sales-marketing-roster-affiliates.repository";
import { salesMarketingRosterOverviewRepository } from "./sales-marketing-roster-overview.repository";

export type SalesProductRow = {
  course_id: string;
  product_title: string;
  product_type: string;
  product_status: string;
  revenue_cents: number;
  discount_cents: number;
  net_cents: number;
  currency: string;
  units_sold: number;
  paid_learner_count: number;
  trial_learner_count: number;
  purchaser_count: number;
  discounted_order_count: number;
  avg_unit_price_cents: number;
};

export type SalesPurchaserRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  amount_cents: number;
  discount_cents: number;
  currency: string;
  enrolled_type: string | null;
  coupon_code: string | null;
  purchased_at: Date;
  payment_order_id: string | null;
  invoice_number: string | null;
};

export type CouponRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  discount_type: string;
  discount_value: number;
  currency: string;
  redemption_count: number;
  total_discount_cents: number;
  total_revenue_cents: number;
  total_usage_limit: number | null;
  ends_at: Date | null;
  starts_at: Date | null;
  created_at: Date;
};

export type CouponRedemptionRow = {
  id: string;
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  product_title: string | null;
  course_id: string | null;
  discount_cents: number;
  original_amount_cents: number;
  final_amount_cents: number;
  currency: string;
  payment_order_id: string | null;
  invoice_number: string | null;
  applied_at: Date;
};

export type ReferralWalletRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  referral_code: string | null;
  successful_referrals: number;
  credit_earned: number;
  wallet_balance: number;
  referred_revenue_cents: number;
  signed_up_at: Date | null;
};

export type AffiliateProductRow = {
  course_id: string;
  product_title: string;
  product_type: string;
  enabled: boolean;
  commission_rate_pct: number;
  inherits_default_rate: boolean;
  tenant_default_commission_pct: number;
  order_count: number;
  revenue_cents: number;
  commission_cents: number;
  net_cents: number;
  effective_rate_pct: number;
  active_affiliate_count: number;
  unpaid_commission_cents: number;
  published_at: Date | null;
  currency: string;
};

export type AffiliateRow = {
  affiliate_id: string;
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  tier: string;
  status: string;
  coupon_code: string;
  revenue_contribution_cents: number;
  commission_earned_cents: number;
  unpaid_cents: number;
  paid_cents: number;
  signed_up_at: Date;
  currency: string;
};

export type PurchaserFilter = {
  courseId: string;
  learnerName?: string;
  email?: string;
  q?: string;
  enrolledType?: string;
  purchasedFrom?: string;
  purchasedTo?: string;
};

export type SalesMarketingOverviewFilter = {
  paidFrom: string;
  paidTo: string;
  currency?: string;
};

/** The sales and marketing roster queries, kept in one file per report area. */
export const salesMarketingRosterRepository = {
  ...salesMarketingRosterProductsRepository,
  ...salesMarketingRosterCouponsRepository,
  ...salesMarketingRosterReferralsRepository,
  ...salesMarketingRosterAffiliatesRepository,
  ...salesMarketingRosterOverviewRepository,
};
