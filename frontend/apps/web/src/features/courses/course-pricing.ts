export type CourseAccessTier = "FREE" | "PAID";

export type CoursePricing = {
  accessTier: CourseAccessTier;
  priceCents: number | null;
  currency: string | null;
};

const DEFAULT_CURRENCY = "USD";

/**
 * Formats a course price for display. Returns "Free" for the free tier and a
 * localized currency amount for paid courses. Falls back to a neutral label
 * when a paid course has no price configured yet.
 */
export function formatCoursePrice(pricing: CoursePricing): string {
  if (pricing.accessTier !== "PAID") {
    return "Free";
  }

  if (pricing.priceCents == null) {
    return "Paid";
  }

  const currency = pricing.currency ?? DEFAULT_CURRENCY;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(pricing.priceCents / 100);
  } catch {
    return `${(pricing.priceCents / 100).toFixed(2)} ${currency}`;
  }
}
