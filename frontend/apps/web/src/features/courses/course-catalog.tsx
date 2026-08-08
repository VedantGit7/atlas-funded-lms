"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { clientApi } from "../../lib/client-api";
import { CourseCard, CoverArt, courseVisual, type CourseCardData } from "./course-card";
import type { CourseFilterValues } from "./course-filters";

type PageInfo = { nextCursor: string | null; hasNextPage: boolean };
type CourseListResponse = { data: { items: CourseCardData[]; pageInfo: PageInfo } };

type CourseCatalogProps = {
  initialItems: CourseCardData[];
  pageInfo: PageInfo;
  initialFilters: CourseFilterValues;
};

const SORT_OPTIONS = [
  { value: "updated_desc", label: "Newest" },
  { value: "title_asc", label: "A to Z" },
  { value: "title_desc", label: "Z to A" },
] as const;

const PRICE_FACETS = [
  { value: "all", label: "All" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
] as const;

const DURATION_FACETS = [
  { value: "all", label: "Any length" },
  { value: "short", label: "Under 2h" },
  { value: "medium", label: "2 to 6h" },
  { value: "long", label: "6h+" },
] as const;

const LEVEL_FACETS = [
  { value: "all", label: "All levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

type PriceFacet = (typeof PRICE_FACETS)[number]["value"];
type DurationFacet = (typeof DURATION_FACETS)[number]["value"];
type LevelFacet = (typeof LEVEL_FACETS)[number]["value"];

const WISHLIST_KEY = "atlas.courses.wishlist";

function buildServerParams(filters: CourseFilterValues): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.dimension) params.set("dimension", filters.dimension);
  if (filters.persona) params.set("persona", filters.persona);
  if (filters.certificate) params.set("certificate", filters.certificate);
  if (filters.sort) params.set("sort", filters.sort);
  return params;
}

const chipBase =
  "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors";
const chipActive = "bg-primary text-primary-foreground shadow-sm";
const chipIdle = "border border-border text-muted-foreground hover:border-primary hover:text-primary";

export function CourseCatalog({ initialItems, pageInfo, initialFilters }: CourseCatalogProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [items, setItems] = useState<CourseCardData[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(pageInfo.nextCursor);
  const [hasNextPage, setHasNextPage] = useState<boolean>(pageInfo.hasNextPage);
  const [loadingMore, setLoadingMore] = useState(false);

  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [refine, setRefine] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [level, setLevel] = useState<LevelFacet>("all");
  const [price, setPrice] = useState<PriceFacet>("all");
  const [duration, setDuration] = useState<DurationFacet>("all");
  const [heroQuery, setHeroQuery] = useState(initialFilters.q ?? "");

  const featuredRef = useRef<HTMLDivElement>(null);

  // Server filters remount this component; keep local paging state in sync.
  useEffect(() => {
    setItems(initialItems);
    setCursor(pageInfo.nextCursor);
    setHasNextPage(pageInfo.hasNextPage);
  }, [initialItems, pageInfo.nextCursor, pageInfo.hasNextPage]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WISHLIST_KEY);
      if (raw) setWishlist(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore malformed storage
    }
  }, []);

  function toggleWishlist(id: string) {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(WISHLIST_KEY, JSON.stringify([...next]));
      } catch {
        // ignore write failures (private mode, quota)
      }
      return next;
    });
  }

  function pushFilters(
    patch: Partial<Record<"q" | "stage" | "dimension" | "persona" | "certificate" | "sort", string | undefined>>,
  ) {
    const params = buildServerParams(initialFilters);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = buildServerParams(initialFilters);
      params.set("cursor", cursor);
      const res = await clientApi.get<CourseListResponse>(`/api/v1/courses?${params.toString()}`);
      setItems((prev) => [...prev, ...res.data.items]);
      setCursor(res.data.pageInfo.nextCursor);
      setHasNextPage(res.data.pageInfo.hasNextPage);
    } catch {
      // Surface nothing destructive; the button stays available to retry.
    } finally {
      setLoadingMore(false);
    }
  }

  // Distinct real categories present in the loaded data.
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      if (item.category) {
        const key = item.category.toLowerCase();
        if (!seen.has(key)) seen.set(key, item.category);
      }
    }
    return [...seen.values()];
  }, [items]);

  const featured = useMemo(() => items.filter((c) => c.featured || c.trending), [items]);

  const visible = useMemo(() => {
    const needle = refine.trim().toLowerCase();
    return items.filter((c) => {
      if (category !== "all" && (c.category ?? "").toLowerCase() !== category) return false;
      if (level !== "all" && c.level !== level) return false;
      if (price === "free" && !(c.accessTier === "FREE" || c.priceCents == null)) return false;
      if (price === "paid" && (c.accessTier === "FREE" || c.priceCents == null)) return false;
      if (duration !== "all") {
        const secs = c.durationSeconds ?? 0;
        if (duration === "short" && !(secs > 0 && secs < 7200)) return false;
        if (duration === "medium" && !(secs >= 7200 && secs <= 21600)) return false;
        if (duration === "long" && !(secs > 21600)) return false;
      }
      if (needle && !c.title.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, refine, category, level, price, duration]);

  const popular = useMemo(
    () => [...items].filter((c) => c.studentCount > 0).sort((a, b) => b.studentCount - a.studentCount).slice(0, 6),
    [items],
  );

  function scrollFeatured(direction: -1 | 1) {
    featuredRef.current?.scrollBy({ left: direction * 420, behavior: "smooth" });
  }

  return (
    <div className="space-y-10">
      {/* Hero band */}
      <section
        className="relative overflow-hidden rounded-3xl border border-border px-6 py-12 text-center sm:py-16"
        style={{
          background:
            "radial-gradient(120% 120% at 0% 0%, color-mix(in srgb, var(--primary) 8%, transparent), transparent 55%), radial-gradient(120% 120% at 100% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 55%), var(--card)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl motion-safe:animate-pulse"
          style={{ background: "color-mix(in srgb, var(--primary) 30%, transparent)" }}
        />
        <div className="relative mx-auto max-w-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Find your next course</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Build real financial skills with courses from your academy.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              pushFilters({ q: heroQuery.trim() || undefined });
            }}
            className="group relative mx-auto mt-6 max-w-xl"
          >
            <Search
              className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary"
              aria-hidden="true"
            />
            <input
              type="search"
              value={heroQuery}
              onChange={(event) => {
                setHeroQuery(event.target.value);
              }}
              placeholder="Search for 'risk management' or 'financial modeling'..."
              aria-label="Search courses"
              className="h-14 w-full rounded-full border-2 border-border bg-background pl-14 pr-28 text-base text-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--primary)_15%,transparent)]"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 motion-safe:active:scale-95"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Category strip (real categories in the data) */}
      {categories.length > 0 ? (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => {
              setCategory("all");
            }}
            className={`${chipBase} ${category === "all" ? chipActive : chipIdle}`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            All topics
          </button>
          {categories.map((cat) => {
            const { Icon } = courseVisual(cat, "");
            const active = category === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategory(active ? "all" : cat.toLowerCase());
                }}
                className={`${chipBase} ${active ? chipActive : chipIdle}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {cat}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Featured carousel */}
      {featured.length > 0 ? (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">Featured courses</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Handpicked to help you level up faster.</p>
            </div>
            <div className="hidden gap-2 sm:flex">
              <button
                type="button"
                aria-label="Scroll featured left"
                onClick={() => {
                  scrollFeatured(-1);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Scroll featured right"
                onClick={() => {
                  scrollFeatured(1);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div
            ref={featuredRef}
            className="flex snap-x gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {featured.map((course) => (
              <div key={course.id} className="w-[340px] shrink-0 snap-start">
                <CourseCard course={course} wishlisted={wishlist.has(course.id)} onToggleWishlist={toggleWishlist} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Sticky filter + sort bar */}
      <div className="sticky top-16 z-30 -mx-4 flex flex-wrap items-center justify-between gap-3 border-y border-border bg-background/85 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={refine}
              onChange={(event) => {
                setRefine(event.target.value);
              }}
              placeholder="Filter results..."
              aria-label="Filter loaded courses"
              className="h-9 w-44 rounded-full border border-border bg-muted pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_20%,transparent)]"
            />
          </div>
          <FacetGroup label="Level" options={LEVEL_FACETS} value={level} onChange={setLevel} />
          <FacetGroup label="Price" options={PRICE_FACETS} value={price} onChange={setPrice} />
          <FacetGroup label="Duration" options={DURATION_FACETS} value={duration} onChange={setDuration} />
          <button
            type="button"
            role="switch"
            aria-checked={initialFilters.certificate === "true"}
            onClick={() => {
              pushFilters({ certificate: initialFilters.certificate === "true" ? undefined : "true" });
            }}
            className="flex items-center gap-2 rounded-full border border-border py-1.5 pl-3 pr-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Certificate
            <span
              className={`relative h-5 w-9 rounded-full transition-colors ${initialFilters.certificate === "true" ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform ${initialFilters.certificate === "true" ? "left-0.5 translate-x-4" : "left-0.5"}`}
              />
            </span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground lg:block">
            {visible.length.toLocaleString()} {visible.length === 1 ? "course" : "courses"}
          </span>
          <div className="flex items-center gap-1 rounded-full border border-border p-1">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  pushFilters({ sort: option.value });
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  (initialFilters.sort ?? "updated_desc") === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main grid */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Search className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-bold text-foreground">No courses match these filters</p>
          <p className="mt-1 text-sm text-muted-foreground">Try clearing a filter or searching for something else.</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((course) => (
            <CourseCard key={course.id} course={course} wishlisted={wishlist.has(course.id)} onToggleWishlist={toggleWishlist} />
          ))}
        </section>
      )}

      {/* Load more */}
      {hasNextPage ? (
        <div className="flex flex-col items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-8 py-3 text-sm font-bold text-primary shadow-sm transition-all hover:border-primary disabled:opacity-60 motion-safe:active:scale-95"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {loadingMore ? "Loading..." : "Load more"}
          </button>
          <p className="text-sm text-muted-foreground">Showing {items.length.toLocaleString()} courses</p>
        </div>
      ) : null}

      {/* Popular rail (real enrollment signal) */}
      {popular.length >= 3 ? (
        <section className="border-t border-border pt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
              Popular right now
            </h2>
          </div>
          <div className="-mx-1 flex gap-5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {popular.map((course) => (
              <Link key={course.id} href={`/courses/${course.id}`} className="group flex w-[280px] shrink-0 flex-col">
                <span className="mb-1 text-[11px] font-semibold text-muted-foreground">
                  {course.studentCount.toLocaleString()} learners enrolled
                </span>
                <CoverArt
                  coverKey={course.coverKey}
                  category={course.category}
                  title={course.title}
                  className="aspect-[4/3] rounded-2xl border border-border"
                  iconClassName="h-10 w-10"
                />
                <h3 className="mt-2 line-clamp-1 text-sm font-bold text-foreground">{course.title}</h3>
                <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all group-hover:gap-2">
                  View course
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FacetGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const active = options.find((o) => o.value === value);
  const isDefault = value === options[0]?.value;
  return (
    <div className="flex items-center gap-1 rounded-full border border-border p-1">
      <span className="pl-2 pr-1 text-xs font-semibold text-muted-foreground">{label}</span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => {
            onChange(option.value);
          }}
          aria-pressed={value === option.value}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            value === option.value && !isDefault
              ? "bg-primary text-primary-foreground"
              : value === option.value
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
      <span className="sr-only">{active?.label}</span>
    </div>
  );
}
