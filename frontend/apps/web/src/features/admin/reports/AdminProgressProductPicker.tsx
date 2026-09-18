"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchProgressProducts,
  type ProductPublishStatus,
  type ProgressCompletionBands,
  type ProgressProductItem,
  type ProgressProductSortBy,
  type ProgressProductType,
  type ProgressProductsSummary,
} from "./admin-progress-score-roster-api";

const PRODUCT_TABS: Array<{ key: ProgressProductType; label: string }> = [
  { key: "course", label: "Course" },
  { key: "test_series", label: "Test series" },
  { key: "bundle", label: "Bundle" },
  { key: "subscription", label: "Subscription" },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Status (All)" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "REVIEW", label: "In review" },
  { value: "ARCHIVED", label: "Archived" },
];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "enrolled_count:desc", label: "Sort: Enrolments ↓" },
  { value: "enrolled_count:asc", label: "Sort: Enrolments ↑" },
  { value: "avg_completion:desc", label: "Sort: Avg completion ↓" },
  { value: "avg_completion:asc", label: "Sort: Avg completion ↑" },
  { value: "last_activity:desc", label: "Sort: Last activity ↓" },
  { value: "title:asc", label: "Sort: Title A–Z" },
  { value: "title:desc", label: "Sort: Title Z–A" },
];

const BAND_ORDER: Array<keyof ProgressCompletionBands> = [
  "not_started",
  "early",
  "in_progress",
  "nearly_done",
  "complete",
];

const BAND_LABELS: Record<keyof ProgressCompletionBands, string> = {
  not_started: "Not started",
  early: "Early (1–24%)",
  in_progress: "In progress (25–74%)",
  nearly_done: "Nearly done (75–99%)",
  complete: "Complete",
};

const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function bandFill(key: keyof ProgressCompletionBands): string {
  if (key === "complete") return "var(--admin-success)";
  if (key === "nearly_done") {
    return "color-mix(in srgb, var(--admin-primary) 80%, var(--admin-success))";
  }
  if (key === "in_progress") return "var(--admin-primary)";
  if (key === "early") {
    return "color-mix(in srgb, var(--admin-primary) 55%, var(--admin-outline))";
  }
  return "var(--admin-outline)";
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatRelativeActivity(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  const diffMs = date.getTime() - Date.now();
  const absMinutes = Math.round(Math.abs(diffMs) / (1000 * 60));
  if (absMinutes < 60) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * absMinutes || -absMinutes,
      "minute",
    );
  }
  const absHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
  if (absHours < 48) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * absHours,
      "hour",
    );
  }
  const absDays = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  if (absDays < 14) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * absDays,
      "day",
    );
  }
  return date.toLocaleDateString();
}

function statusChipClass(status: ProductPublishStatus): string {
  if (status === "DRAFT") {
    return "border-[var(--admin-warning)] text-[var(--admin-warning)]";
  }
  if (status === "ARCHIVED") {
    return "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)]";
  }
  if (status === "REVIEW") {
    return "border-[var(--admin-primary)] text-[var(--admin-primary)]";
  }
  return "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)]";
}

function productPath(productType: ProgressProductType, slug: string): string {
  const prefix =
    productType === "course"
      ? "/course"
      : productType === "test_series"
        ? "/test-series"
        : productType === "bundle"
          ? "/bundle"
          : "/subscription";
  return `${prefix}/${slug}`;
}

function productNoun(productType: ProgressProductType): string {
  if (productType === "course") return "courses";
  if (productType === "test_series") return "test series";
  if (productType === "bundle") return "bundles";
  return "subscriptions";
}

function CompletionSpread({ bands }: { bands: ProgressCompletionBands }) {
  const total = BAND_ORDER.reduce((sum, key) => sum + bands[key], 0);
  if (total === 0) {
    return (
      <div
        className="flex h-1.5 w-full gap-0.5 bg-[var(--admin-surface-high)]"
        title="No active enrolments"
      />
    );
  }
  return (
    <div
      className="flex h-1.5 w-full gap-0.5 bg-[var(--admin-surface-high)]"
      title={BAND_ORDER.map((key) => `${BAND_LABELS[key]}: ${bands[key]}`).join(" · ")}
    >
      {BAND_ORDER.map((key) => {
        const count = bands[key];
        if (count <= 0) return null;
        return (
          <div
            key={key}
            className="h-full min-w-[2px]"
            style={{ flex: count, backgroundColor: bandFill(key) }}
          />
        );
      })}
    </div>
  );
}

function ProductPickerSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading products">
      <div className="flex flex-col justify-between gap-6 border-b border-[var(--admin-border)] pb-6 lg:flex-row lg:items-end">
        <div className="space-y-3">
          <Shimmer className="h-9 w-48" />
          <Shimmer className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-3">
          <Shimmer className="h-10 w-36" />
          <Shimmer className="h-10 w-28" />
          <Shimmer className="h-10 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-5">
          <Shimmer className="h-10 w-80 max-w-full" />
          <Shimmer className="h-3 w-56" />
        </div>
        <div className="flex flex-wrap justify-end gap-2 lg:col-span-7">
          <Shimmer className="h-9 w-52" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-40" />
        </div>
      </div>
      <div className="overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3">
          <Shimmer className="h-3 w-full max-w-3xl" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-12 items-center gap-3 border-b border-[var(--admin-border)] px-4 py-4 last:border-b-0"
          >
            <Shimmer className="col-span-1 h-3 w-4" />
            <div className="col-span-4 space-y-2">
              <Shimmer className="h-4 w-3/4" />
              <Shimmer className="h-3 w-1/2" />
            </div>
            <Shimmer className="col-span-1 h-5 w-14" />
            <Shimmer className="col-span-1 h-3 w-10 justify-self-end" />
            <Shimmer className="col-span-2 h-3 w-full" />
            <Shimmer className="col-span-2 h-1.5 w-full" />
            <Shimmer className="col-span-1 h-3 w-8 justify-self-end" />
          </div>
        ))}
      </div>
    </div>
  );
}

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export function AdminProgressProductPicker({
  productType,
  onProductTypeChange,
  onSelectProduct,
}: {
  productType: ProgressProductType;
  onProductTypeChange: (type: ProgressProductType) => void;
  onSelectProduct: (product: ProgressProductItem) => void;
}) {
  const searchId = useId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ProgressProductItem[]>([]);
  const [summary, setSummary] = useState<ProgressProductsSummary>({
    productCount: 0,
    enrolmentCount: 0,
  });
  const [pageInfo, setPageInfo] = useState<PageInfo>({
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<ProductPublishStatus | "">("");
  const [sortKey, setSortKey] = useState("enrolled_count:desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [sortByRaw, sortDirRaw] = sortKey.split(":");
    const sortBy = (sortByRaw ?? "enrolled_count") as ProgressProductSortBy;
    const sortDir = sortDirRaw === "asc" ? "asc" : "desc";
    try {
      const response = await fetchProgressProducts(productType, {
        q: debouncedQ || undefined,
        page,
        limit: 25,
        status,
        sortBy,
        sortDir,
      });
      setItems(response.data.items);
      setSummary(response.data.summary);
      setPageInfo(response.data.pageInfo);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Failed to load product data.",
      );
      setItems([]);
      setSummary({ productCount: 0, enrolmentCount: 0 });
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, page, productType, sortKey, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function clearFilters() {
    setSearchInput("");
    setDebouncedQ("");
    setStatus("");
    setSortKey("enrolled_count:desc");
    setPage(1);
  }

  const hasActiveFilters = Boolean(debouncedQ || status);
  const empty = !loading && !error && items.length === 0;
  const showingFrom = pageInfo.totalCount === 0 ? 0 : (pageInfo.page - 1) * pageInfo.pageSize + 1;
  const showingTo = Math.min(pageInfo.page * pageInfo.pageSize, pageInfo.totalCount);

  const pageButtons = (() => {
    if (pageInfo.totalPages <= 1) return [] as number[];
    const pages = new Set<number>([1, pageInfo.totalPages, page, page - 1, page + 1]);
    return [...pages]
      .filter((value) => value >= 1 && value <= pageInfo.totalPages)
      .sort((a, b) => a - b);
  })();

  if (loading && items.length === 0 && !error) {
    return <ProductPickerSkeleton />;
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3"
          role="alert"
        >
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--admin-danger)]">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Failed to load product data
            <span className="font-normal normal-case tracking-normal text-[var(--admin-on-surface-variant)]">
              — {error}
            </span>
          </div>
          <button
            type="button"
            className={`${ghostButtonClassName} inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-[var(--admin-danger)] leading-none text-[var(--admin-danger)]`}
            onClick={() => void load()}
          >
            Retry connection
          </button>
        </div>
      ) : null}

      <div className="flex flex-col justify-between gap-6 border-b border-[var(--admin-border)] pb-6 lg:flex-row lg:items-end">
        <div className="flex max-w-xl flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]">
            Progress
          </h1>
          <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            Pick a product to see learner-by-learner completion.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex h-10 items-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm font-semibold text-[var(--admin-on-surface)]"
            title="Enrolment activity window applies on the overview signal band"
          >
            <CalendarDays
              className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            All time
          </div>
          <Link
            href="/admin/reports/progress-score/exports"
            className={`${ghostButtonClassName} inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] leading-none`}
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            Export
          </Link>
          <Link
            href="/admin/reports/progress-score/cohorts"
            className={`${primaryButtonClassName} inline-flex h-10 items-center justify-center gap-2 rounded-sm leading-none`}
          >
            Cohort actions
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-3 lg:col-span-5">
          <div
            className="inline-flex w-max max-w-full flex-wrap border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-1"
            role="tablist"
            aria-label="Product type"
          >
            {PRODUCT_TABS.map((tab) => {
              const active = productType === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={[
                    "px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors",
                    active
                      ? "border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                      : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                  onClick={() => {
                    if (tab.key === productType) return;
                    onProductTypeChange(tab.key);
                    setPage(1);
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--admin-primary)]"
              aria-hidden="true"
            />
            {formatCount(summary.productCount)} {productNoun(productType)}
            <span className="text-[var(--admin-on-surface-variant)]">·</span>
            {formatCount(summary.enrolmentCount)} enrolments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:col-span-7 lg:justify-end">
          <div className="relative min-w-[200px] max-w-sm flex-grow">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <label htmlFor={searchId} className="sr-only">
              Search product title
            </label>
            <input
              id={searchId}
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
              placeholder="Search product title…"
              className="h-9 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-9 pr-3 text-xs font-medium text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as ProductPublishStatus | "");
              setPage(1);
            }}
            options={STATUS_OPTIONS}
            className={selectClassName}
            ariaLabel="Publish status"
          />
          <Select
            value={sortKey}
            onValueChange={(value) => {
              setSortKey(value);
              setPage(1);
            }}
            options={SORT_OPTIONS}
            className={selectClassName}
            ariaLabel="Sort products"
          />
        </div>
      </div>

      {empty ? (
        <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-8 py-16 text-center">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, var(--admin-primary), transparent 40%), radial-gradient(circle at 80% 70%, var(--admin-outline), transparent 35%)",
            }}
          />
          <div className="relative z-10 flex max-w-lg flex-col items-center">
            <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)]">
              <BookOpen className="h-14 w-14" strokeWidth={1.25} aria-hidden="true" />
            </div>
            <h2 className="mb-3 text-2xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]">
              {hasActiveFilters
                ? `No ${productNoun(productType)} match these filters`
                : `No ${productNoun(productType)} yet`}
            </h2>
            <p className="mb-8 max-w-md text-base leading-relaxed text-[var(--admin-on-surface-variant)]">
              {hasActiveFilters
                ? "The current parameter combination returned zero products. Adjust search or status, or reset the view."
                : `Publish a ${productNoun(productType).replace(/s$/, "")} to start tracking learner completion here.`}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                className={`${ghostButtonClassName} inline-flex h-11 items-center justify-center rounded-sm border-2 border-[var(--admin-on-surface)] px-8 uppercase tracking-[0.12em] leading-none text-[var(--admin-on-surface)] hover:bg-[var(--admin-on-surface)] hover:text-[var(--admin-surface)]`}
                onClick={clearFilters}
              >
                Clear filters
              </button>
            ) : (
              <Link
                href="/admin/courses"
                className={`${primaryButtonClassName} inline-flex h-11 items-center justify-center rounded-sm px-8 leading-none`}
              >
                Open course library
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                  <th className="w-10 px-4 py-3 font-medium">#</th>
                  <th className="min-w-[240px] px-4 py-3 font-medium">Product</th>
                  <th className="w-28 px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Enrolled</th>
                  <th className="px-4 py-3 text-right font-medium">Avg Comp</th>
                  <th className="w-[180px] px-4 py-3 font-medium">Spread</th>
                  <th className="px-4 py-3 text-right font-medium">Not Started</th>
                  <th className="px-4 py-3 text-right font-medium">Last Act.</th>
                  <th className="w-12 px-4 py-3 text-center font-medium">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {items.map((product, index) => {
                  const rowNumber = showingFrom + index;
                  const avg = product.avgCompletionPct;
                  const zeroStuck = avg === 0 && product.enrolledCount > 0;
                  return (
                    <tr
                      key={product.id}
                      className="group cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                      onClick={() => {
                        onSelectProduct(product);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectProduct(product);
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open progress for ${product.title}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                        {rowNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--admin-on-surface)] transition-colors group-hover:text-[var(--admin-primary)]">
                          {product.title}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                          {productPath(productType, product.slug)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-block border bg-[var(--admin-surface-low)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                            statusChipClass(product.status),
                          ].join(" ")}
                        >
                          {product.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[var(--admin-on-surface)]">
                        {formatCount(product.enrolledCount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <span
                            className={[
                              "font-mono text-xs tabular-nums",
                              zeroStuck
                                ? "text-[var(--admin-warning)]"
                                : "text-[var(--admin-on-surface)]",
                            ].join(" ")}
                          >
                            {formatPct(avg)}
                          </span>
                          <div className="h-[3px] w-16 overflow-hidden bg-[var(--admin-surface-high)]">
                            <div
                              className="h-full bg-[var(--admin-primary)]"
                              style={{ width: `${Math.min(100, Math.max(0, avg ?? 0))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <CompletionSpread bands={product.completionBands} />
                      </td>
                      <td
                        className={[
                          "px-4 py-3 text-right font-mono text-xs tabular-nums",
                          zeroStuck
                            ? "text-[var(--admin-warning)]"
                            : "text-[var(--admin-on-surface-variant)]",
                        ].join(" ")}
                      >
                        {formatCount(product.notStartedCount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[var(--admin-on-surface-variant)]">
                        {formatRelativeActivity(product.lastActivityAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ChevronRight
                          className="mx-auto h-4 w-4 text-[var(--admin-on-surface-variant)] transition-colors group-hover:text-[var(--admin-primary)]"
                          aria-hidden="true"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-4 font-mono text-xs text-[var(--admin-on-surface-variant)]">
            <div>
              Showing {showingFrom}-{showingTo} of {formatCount(pageInfo.totalCount)}{" "}
              {productNoun(productType)}
            </div>
            {pageInfo.totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center border border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!pageInfo.hasPreviousPage || loading}
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1));
                  }}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                {pageButtons.map((pageNumber, index) => {
                  const prev = pageButtons[index - 1];
                  const showEllipsis = prev != null && pageNumber - prev > 1;
                  return (
                    <span key={pageNumber} className="flex items-center gap-2">
                      {showEllipsis ? <span aria-hidden="true">…</span> : null}
                      <button
                        type="button"
                        className={[
                          "inline-flex h-8 w-8 items-center justify-center border transition-colors",
                          pageNumber === page
                            ? "border-[var(--admin-primary)] bg-[var(--admin-surface-high)] text-[var(--admin-primary)]"
                            : "border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]",
                        ].join(" ")}
                        onClick={() => {
                          setPage(pageNumber);
                        }}
                        aria-current={pageNumber === page ? "page" : undefined}
                      >
                        {pageNumber}
                      </button>
                    </span>
                  );
                })}
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center border border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!pageInfo.hasNextPage || loading}
                  onClick={() => {
                    setPage((current) => current + 1);
                  }}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
