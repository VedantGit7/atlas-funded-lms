"use client";

import { Money } from "../../currency/Money";

/**
 * Studio catalog price display. Derives access tier / price / currency the same
 * way formatCoursePrice does, then converts the amount into the tenant display
 * currency via live FX rates. Falls back to "Free" for unpriced courses.
 */
export function StudioCoursePrice({
  course,
}: {
  course: {
    accessTier?: "FREE" | "PAID" | undefined;
    priceCents?: number | null | undefined;
    currency?: string | null | undefined;
    tags?: Record<string, unknown> | undefined;
  };
}) {
  const accessTier = course.accessTier ?? course.tags?.["accessTier"];
  const priceCents = course.priceCents ?? course.tags?.["priceCents"];
  const currency =
    typeof course.currency === "string"
      ? course.currency
      : typeof course.tags?.["currency"] === "string"
        ? course.tags["currency"]
        : "USD";

  if (accessTier === "PAID" && typeof priceCents === "number" && priceCents > 0) {
    return <Money amount={priceCents} currency={currency} minorUnits />;
  }
  return <>Free</>;
}
