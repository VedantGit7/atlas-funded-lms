export type CouponStatus = "DRAFT" | "ACTIVE" | "INACTIVE";
export type CouponDiscountType = "PERCENT" | "FIXED";
export type CouponVisibility = "PUBLIC" | "PRIVATE";
export type CouponDeviceType = "ALL" | "WEB" | "MOBILE";

export type CouponDto = {
  id: string;
  code: string;
  name: string;
  status: CouponStatus;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountCents: number | null;
  currency: string;
  startsAt: string | null;
  endsAt: string | null;
  totalUsageLimit: number | null;
  perLearnerLimit: number;
  minPurchaseCents: number | null;
  visibility: CouponVisibility;
  deviceType: CouponDeviceType;
  appliesToAllCourses: boolean;
  courseIds: string[];
  courseCount: number;
  redemptionCount: number;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CouponsListSummary = {
  activeCount: number;
  draftCount: number;
  inactiveCount: number;
  totalCount: number;
  totalRedemptions: number;
  totalDiscountCents: number;
  totalRevenueCents: number;
};

export type CouponRedemptionDto = {
  id: string;
  learnerName: string;
  courseTitle: string | null;
  discountCents: number;
  originalAmountCents: number;
  finalAmountCents: number;
  currency: string;
  createdAt: string;
};

export type CouponFormValues = {
  code: string;
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountCents: number | null;
  currency: string;
  startsAt: string;
  endsAt: string;
  totalUsageLimit: number | null;
  perLearnerLimit: number;
  minPurchaseCents: number | null;
  visibility: CouponVisibility;
  deviceType: CouponDeviceType;
  appliesToAllCourses: boolean;
  courseIds: string[];
};

export type PriceBreakdown = {
  courseId: string;
  courseTitle: string;
  currency: string;
  originalAmountCents: number;
  discountCents: number;
  walletCreditsApplied?: number;
  walletDiscountCents?: number;
  finalAmountCents: number;
  coupon: {
    id: string;
    code: string;
    name: string;
    discountType: CouponDiscountType;
    discountValue: number;
  } | null;
};

export type PublicCouponDto = {
  id: string;
  code: string;
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountCents: number | null;
  currency: string;
};

export type CouponPerformanceItem = {
  couponId: string;
  code: string;
  name: string;
  status: CouponStatus;
  redemptionCount: number;
  totalDiscountCents: number;
  totalRevenueCents: number;
  currency: string;
};

export const COUPONS_LIST_HREF = "/admin/sales/coupons";
export const COUPONS_CREATE_HREF = "/admin/sales/coupons/create";
export const ADMIN_SALES_HREF = "/admin/sales";

export const EMPTY_COUPONS_SUMMARY: CouponsListSummary = {
  activeCount: 0,
  draftCount: 0,
  inactiveCount: 0,
  totalCount: 0,
  totalRedemptions: 0,
  totalDiscountCents: 0,
  totalRevenueCents: 0,
};

export function couponHref(id: string) {
  return `/admin/sales/coupons/${id}`;
}

export function couponEditHref(id: string) {
  return couponHref(id);
}

export function emptyCouponForm(): CouponFormValues {
  return {
    code: "",
    name: "",
    discountType: "PERCENT",
    discountValue: 10,
    maxDiscountCents: null,
    currency: "USD",
    startsAt: "",
    endsAt: "",
    totalUsageLimit: null,
    perLearnerLimit: 1,
    minPurchaseCents: null,
    visibility: "PRIVATE",
    deviceType: "ALL",
    appliesToAllCourses: true,
    courseIds: [],
  };
}

export function couponToForm(coupon: CouponDto): CouponFormValues {
  return {
    code: coupon.code,
    name: coupon.name,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscountCents: coupon.maxDiscountCents,
    currency: coupon.currency,
    startsAt: coupon.startsAt ? coupon.startsAt.slice(0, 16) : "",
    endsAt: coupon.endsAt ? coupon.endsAt.slice(0, 16) : "",
    totalUsageLimit: coupon.totalUsageLimit,
    perLearnerLimit: coupon.perLearnerLimit,
    minPurchaseCents: coupon.minPurchaseCents,
    visibility: coupon.visibility,
    deviceType: coupon.deviceType,
    appliesToAllCourses: coupon.appliesToAllCourses,
    courseIds: coupon.courseIds,
  };
}

export function formToPayload(values: CouponFormValues) {
  const toIso = (local: string) => {
    const trimmed = local.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    discountType: values.discountType,
    discountValue: values.discountValue,
    maxDiscountCents: values.maxDiscountCents,
    currency: values.currency.trim().toUpperCase() || "USD",
    startsAt: toIso(values.startsAt),
    endsAt: toIso(values.endsAt),
    totalUsageLimit: values.totalUsageLimit,
    perLearnerLimit: values.perLearnerLimit,
    minPurchaseCents: values.minPurchaseCents,
    visibility: values.visibility,
    deviceType: values.deviceType,
    appliesToAllCourses: values.appliesToAllCourses,
    courseIds: values.appliesToAllCourses ? [] : values.courseIds,
  };
}

export function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function centsToDollarInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

export function dollarInputToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function formatCouponDiscount(
  coupon: Pick<CouponDto, "discountType" | "discountValue" | "currency" | "maxDiscountCents">,
) {
  if (coupon.discountType === "PERCENT") {
    const cap =
      coupon.maxDiscountCents != null
        ? `, max ${formatMoney(coupon.maxDiscountCents, coupon.currency)}`
        : "";
    return `${coupon.discountValue}% off${cap}`;
  }
  return `${formatMoney(coupon.discountValue, coupon.currency)} off`;
}

export function formatCouponDate(value: string | null | undefined): string {
  if (!value) return "No expiry";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatCouponDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCouponRelativeTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const suffix = diffMs >= 0 ? "left" : "ago";
  if (mins < 60) return `${mins}m ${suffix}`;
  if (hours < 48) return `${hours}h ${suffix}`;
  return `${days}d ${suffix}`;
}

export function couponStatusLabel(status: CouponStatus): string {
  if (status === "ACTIVE") return "Active";
  if (status === "DRAFT") return "Draft";
  return "Inactive";
}

export function couponScopeLabel(
  coupon: Pick<CouponDto, "appliesToAllCourses" | "courseCount" | "courseIds">,
): string {
  if (coupon.appliesToAllCourses) return "All courses";
  const count = coupon.courseCount || coupon.courseIds.length;
  if (count === 1) return "1 course";
  return `${count} courses`;
}

export function couponUsageLabel(
  coupon: Pick<CouponDto, "redemptionCount" | "totalUsageLimit">,
): string {
  if (coupon.totalUsageLimit == null) {
    return `${coupon.redemptionCount} / Unlimited`;
  }
  return `${coupon.redemptionCount} / ${coupon.totalUsageLimit}`;
}

export function generateCouponCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function formatCouponCount(value: number): string {
  if (value >= 1000) {
    const scaled = value / 1000;
    const text = scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1);
    return `${text.replace(/\.0$/, "")}k`;
  }
  return String(value);
}

export function couponLiveSummary(values: CouponFormValues): string {
  const discount =
    values.discountType === "PERCENT"
      ? `${values.discountValue}% discount`
      : `${formatMoney(values.discountValue, values.currency || "USD")} discount`;
  const cap =
    values.discountType === "PERCENT" && values.maxDiscountCents != null
      ? `, up to a maximum of ${formatMoney(values.maxDiscountCents, values.currency || "USD")}`
      : "";
  const scope = values.appliesToAllCourses
    ? "all courses"
    : `${values.courseIds.length || "selected"} course${values.courseIds.length === 1 ? "" : "s"}`;
  const visibility =
    values.visibility === "PUBLIC" ? "visible at checkout" : "private (code entry only)";
  return `Learners will receive a ${discount}${cap} on eligible purchases. Currently scoped to ${scope} and ${visibility}.`;
}
