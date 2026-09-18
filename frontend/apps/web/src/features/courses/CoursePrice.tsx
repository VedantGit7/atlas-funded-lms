"use client";

import { Money } from "../currency/Money";
import type { CoursePricing } from "./course-pricing";

const DEFAULT_CURRENCY = "USD";

/**
 * Displays a course price, converting the stored amount into the tenant's
 * display currency via live FX rates. Mirrors formatCoursePrice for the
 * non-paid / unpriced cases so behaviour stays consistent.
 */
export function CoursePrice({ course }: { course: CoursePricing }) {
  if (course.accessTier !== "PAID") return <>Free</>;
  if (course.priceCents == null) return <>Paid</>;
  return (
    <Money amount={course.priceCents} currency={course.currency ?? DEFAULT_CURRENCY} minorUnits />
  );
}
