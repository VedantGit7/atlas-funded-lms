"use client";

import Link from "next/link";
import {
  Calculator,
  GraduationCap,
  Heart,
  Landmark,
  Rocket,
  Scale,
  ShieldAlert,
  Star,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type CourseCardData = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  accessTier: "FREE" | "PAID";
  priceCents: number | null;
  currency: string | null;
  locked: boolean;
  level: "beginner" | "intermediate" | "advanced" | null;
  category: string | null;
  featured: boolean;
  trending: boolean;
  compareAtPriceCents: number | null;
  durationSeconds: number | null;
  studentCount: number;
  instructor: { name: string | null; avatarKey: string | null } | null;
  progressPct: number | null;
  ratingAverage: number | null;
  ratingCount: number;
  enrollmentStatus: "enrolled" | "not_enrolled" | null;
  coverKey?: string | null | undefined;
};

/** Maps a course's category/title to a recognizable icon + design token accent. */
const CATEGORY_VISUALS: Array<{ match: RegExp; Icon: LucideIcon; tone: string }> = [
  { match: /personal|budget|saving|money|wealth/, Icon: Wallet, tone: "var(--success)" },
  { match: /invest|market|trading|portfolio|stock|equit|macro/, Icon: TrendingUp, tone: "var(--primary)" },
  { match: /bank/, Icon: Landmark, tone: "var(--accent)" },
  { match: /account|tax|audit|bookkeep/, Icon: Calculator, tone: "var(--warning)" },
  { match: /law|compliance|govern|ethic|regulat|legal/, Icon: Scale, tone: "var(--primary)" },
  { match: /fintech|crypto|blockchain|tech|algo|\bai\b|data|python/, Icon: Rocket, tone: "var(--accent)" },
  { match: /risk|hedge|derivativ|volatil/, Icon: ShieldAlert, tone: "var(--warning)" },
];

export function courseVisual(category: string | null, title: string): { Icon: LucideIcon; tone: string } {
  const haystack = `${category ?? ""} ${title}`.toLowerCase();
  for (const v of CATEGORY_VISUALS) {
    if (v.match.test(haystack)) return { Icon: v.Icon, tone: v.tone };
  }
  return { Icon: GraduationCap, tone: "var(--primary)" };
}

/** Course covers are stored as direct image URLs; only render ones that look like a URL. */
function isImageUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && /^(https?:\/\/|\/\/|\/)\S/i.test(value.trim());
}

/**
 * Cover media: a token-gradient + category-icon base with the real cover image
 * layered on top when present. If the image fails to load it hides itself,
 * revealing the gradient, so a broken URL never shows a broken image.
 */
export function CoverArt({
  coverKey,
  category,
  title,
  className = "",
  iconClassName = "h-12 w-12",
  children,
}: {
  coverKey: string | null | undefined;
  category: string | null;
  title: string;
  className?: string;
  iconClassName?: string;
  children?: React.ReactNode;
}) {
  const { Icon, tone } = courseVisual(category, title);
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${tone} 26%, var(--card)), var(--card))` }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon
          className={`${iconClassName} transition-transform duration-500 group-hover:scale-110`}
          style={{ color: tone, opacity: 0.85 }}
          aria-hidden="true"
        />
      </div>
      {isImageUrl(coverKey) ? (
        <img
          src={coverKey}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      {children}
    </div>
  );
}

function formatMoney(cents: number, currency: string | null): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatDuration(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 1) {
    const rounded = Math.round(hours * 10) / 10;
    return `${String(rounded % 1 === 0 ? Math.round(rounded) : rounded)}h`;
  }
  return `${String(Math.max(1, Math.round(seconds / 60)))}m`;
}

const LEVEL_LABEL: Record<NonNullable<CourseCardData["level"]>, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

type CourseCardProps = {
  course: CourseCardData;
  wishlisted: boolean;
  onToggleWishlist: (id: string) => void;
};

export function CourseCard({ course, wishlisted, onToggleWishlist }: CourseCardProps) {
  const { tone } = courseVisual(course.category, course.title);
  const enrolled = course.enrollmentStatus === "enrolled";
  const discountPct =
    course.compareAtPriceCents != null &&
    course.priceCents != null &&
    course.compareAtPriceCents > course.priceCents
      ? Math.round((1 - course.priceCents / course.compareAtPriceCents) * 100)
      : null;
  const instructorName = course.instructor?.name?.trim() || "Course team";

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 motion-safe:hover:-translate-y-1 hover:shadow-lg">
      <Link href={`/courses/${course.id}`} className="flex flex-1 flex-col focus:outline-none">
        {/* Media (real cover image over token-gradient + category-icon fallback) */}
        <CoverArt coverKey={course.coverKey} category={course.category} title={course.title} className="aspect-video w-full">
          {course.level ? (
            <span className="absolute left-3 top-3 rounded-full bg-card/90 px-3 py-1 text-xs font-bold text-primary backdrop-blur">
              {LEVEL_LABEL[course.level]}
            </span>
          ) : null}
          {course.featured || course.trending ? (
            <span
              className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-primary-foreground backdrop-blur"
              style={{ background: "var(--primary)", marginTop: course.level ? "2rem" : "0" }}
            >
              {course.featured ? "Featured" : "Trending"}
            </span>
          ) : null}
          {course.durationSeconds ? (
            <span className="absolute bottom-3 right-3 rounded bg-foreground/70 px-2 py-1 text-[10px] font-bold uppercase text-background backdrop-blur">
              {formatDuration(course.durationSeconds)}
            </span>
          ) : null}
        </CoverArt>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-bold leading-snug text-foreground">
            {course.title}
          </h3>

          <div className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground"
              style={{ background: `color-mix(in srgb, ${tone} 70%, var(--foreground))` }}
              aria-hidden="true"
            >
              {initials(instructorName)}
            </span>
            <span className="truncate text-sm text-muted-foreground">{instructorName}</span>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {course.ratingAverage != null ? (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-[var(--warning)]" fill="currentColor" aria-hidden="true" />
                <span className="font-bold text-foreground">{course.ratingAverage.toFixed(1)}</span>
                {course.ratingCount > 0 ? <span>({course.ratingCount.toLocaleString()})</span> : null}
              </span>
            ) : (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">New</span>
            )}
            {course.studentCount > 0 ? (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {course.studentCount.toLocaleString()}
              </span>
            ) : null}
          </div>

          {/* Footer: progress (enrolled) or price */}
          <div className="mt-auto pt-1">
            {enrolled ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {course.progressPct != null ? `${String(course.progressPct)}% complete` : "In progress"}
                  </span>
                  <span className="font-bold text-primary">Continue</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${String(course.progressPct ?? 0)}%` }}
                  />
                </div>
              </div>
            ) : course.accessTier === "FREE" || course.priceCents == null ? (
              <span className="text-lg font-extrabold text-[var(--success)]">Free</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold text-primary">{formatMoney(course.priceCents, course.currency)}</span>
                {course.compareAtPriceCents != null && course.compareAtPriceCents > course.priceCents ? (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatMoney(course.compareAtPriceCents, course.currency)}
                  </span>
                ) : null}
                {discountPct != null ? (
                  <span
                    className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: "color-mix(in srgb, var(--success) 16%, transparent)", color: "var(--success)" }}
                  >
                    {discountPct}% off
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Wishlist */}
      <button
        type="button"
        onClick={() => {
          onToggleWishlist(course.id);
        }}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={wishlisted}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-muted-foreground backdrop-blur transition-all hover:text-[var(--destructive)] motion-safe:scale-90 motion-safe:opacity-0 motion-safe:group-hover:scale-100 motion-safe:group-hover:opacity-100 aria-pressed:scale-100 aria-pressed:opacity-100 aria-pressed:text-[var(--destructive)]"
      >
        <Heart className="h-4 w-4" fill={wishlisted ? "currentColor" : "none"} aria-hidden="true" />
      </button>
    </article>
  );
}
