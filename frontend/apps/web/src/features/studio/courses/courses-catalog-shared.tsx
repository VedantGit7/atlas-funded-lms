import type { LucideIcon } from "lucide-react";

export {
  cardClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../components/studio-dashboard-shared";

export { fieldClassName } from "../../../app/admin/branding/_components/branding-admin-shared";

export const catalogSearchClassName =
  "w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--admin-on-surface)] outline-none transition-all placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

export const catalogFilterButtonClassName =
  "inline-flex items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]";

export const catalogStatCardClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm transition-[box-shadow,border-color] duration-200 hover:shadow-md";

export type CourseCatalogStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

export type CourseCatalogStats = {
  total: number;
  published: number;
  unpublished: number;
  inReview: number;
};

export function summarizeCourseCatalogStats(
  courses: Array<{ status: CourseCatalogStatus }>,
): CourseCatalogStats {
  let published = 0;
  let unpublished = 0;
  let inReview = 0;

  for (const course of courses) {
    if (course.status === "PUBLISHED") published += 1;
    if (course.status === "DRAFT") unpublished += 1;
    if (course.status === "REVIEW") inReview += 1;
  }

  return {
    total: courses.length,
    published,
    unpublished,
    inReview,
  };
}

export function courseCardStatusLabel(status: CourseCatalogStatus): string {
  if (status === "PUBLISHED") return "Published";
  if (status === "REVIEW") return "In review";
  if (status === "ARCHIVED") return "Archived";
  return "Unpublished";
}

export function courseAgeDays(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 1;
  return Math.max(1, Math.ceil((Date.now() - created) / (1000 * 60 * 60 * 24)));
}

export function formatCoursePrice(course: {
  accessTier?: "FREE" | "PAID" | undefined;
  priceCents?: number | null | undefined;
  currency?: string | null | undefined;
  tags?: Record<string, unknown> | undefined;
}): string {
  const accessTier = course.accessTier ?? course.tags?.["accessTier"];
  const priceCents = course.priceCents ?? course.tags?.["priceCents"];
  const currency =
    typeof course.currency === "string"
      ? course.currency
      : typeof course.tags?.["currency"] === "string"
        ? course.tags["currency"]
        : "USD";

  if (accessTier === "PAID" && typeof priceCents === "number" && priceCents > 0) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(priceCents / 100);
    } catch {
      return `${(priceCents / 100).toFixed(0)} ${currency}`;
    }
  }

  return "Free";
}

export function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
}) {
  return (
    <div className={catalogStatCardClassName}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">{label}</p>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-[var(--admin-on-surface)]">{value}</p>
    </div>
  );
}
