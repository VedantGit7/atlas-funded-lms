"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
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
  fetchScoreProducts,
  type ScorePassRateBand,
  type ScoreProductItem,
  type ScoreProductSortBy,
  type ScoreProductType,
  type ScoreProductsSummary,
} from "./admin-progress-score-roster-api";

const PRODUCT_TABS: Array<{ key: ScoreProductType; label: string }> = [
  { key: "course", label: "Course quiz" },
  { key: "test_series", label: "Test series" },
  { key: "bundle", label: "Bundle" },
  { key: "mock_test", label: "Mock test" },
];

const PASS_RATE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Pass rate (Any)" },
  { value: "below_50", label: "Below 50%" },
  { value: "mid_50_75", label: "50–75%" },
  { value: "above_75", label: "Above 75%" },
];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "attempts:desc", label: "Sort: Attempts ↓" },
  { value: "attempts:asc", label: "Sort: Attempts ↑" },
  { value: "avg_score:desc", label: "Sort: Avg score ↓" },
  { value: "pass_rate:desc", label: "Sort: Pass rate ↓" },
  { value: "last_attempt:desc", label: "Sort: Last attempt ↓" },
  { value: "title:asc", label: "Sort: Title A–Z" },
];

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

function formatRelative(iso: string | null): string {
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

function formatAbsolute(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function productPath(productType: ScoreProductType, slug: string): string {
  const prefix =
    productType === "course"
      ? "/course"
      : productType === "test_series"
        ? "/test-series"
        : productType === "bundle"
          ? "/bundle"
          : "/mock-test";
  return `${prefix}/${slug}`;
}

function typeLabel(productType: ScoreProductType): string {
  if (productType === "course") return "Course quiz";
  if (productType === "test_series") return "Test series";
  if (productType === "bundle") return "Bundle";
  return "Mock test";
}

function ScoreBar({ avgPct, passMarkPct }: { avgPct: number | null; passMarkPct: number | null }) {
  const fillPct = avgPct != null ? Math.min(100, Math.max(0, avgPct)) : 0;
  const belowPass = passMarkPct != null && avgPct != null && avgPct < passMarkPct;

  return (
    <div
      className="relative h-[3px] w-16 shrink-0 overflow-visible bg-[var(--admin-surface-high)]"
      title={
        passMarkPct != null
          ? `Avg ${formatPct(avgPct)} · Pass mark ${formatPct(passMarkPct)}`
          : undefined
      }
    >
      {passMarkPct != null ? (
        <div
          className="absolute top-[-2px] z-10 h-[7px] w-px bg-[var(--admin-on-surface-variant)]"
          style={{ left: `${String(Math.min(100, Math.max(0, passMarkPct)))}%` }}
          aria-hidden="true"
        />
      ) : null}
      <div
        className="h-full"
        style={{
          width: `${String(fillPct)}%`,
          backgroundColor: belowPass ? "var(--admin-danger)" : "var(--admin-primary)",
        }}
      />
    </div>
  );
}

function ProductPickerSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading products">
      <div className="flex flex-col justify-between gap-6 border-b border-[var(--admin-border)] pb-6 lg:flex-row lg:items-end">
        <div className="space-y-3">
          <Shimmer className="h-9 w-40" />
          <Shimmer className="h-4 w-[28rem] max-w-full" />
        </div>
        <div className="flex gap-3">
          <Shimmer className="h-10 w-36" />
          <Shimmer className="h-10 w-28" />
          <Shimmer className="h-10 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-5">
          <Shimmer className="h-10 w-[22rem] max-w-full" />
          <Shimmer className="h-3 w-72" />
        </div>
        <div className="flex flex-wrap justify-end gap-2 lg:col-span-7">
          <Shimmer className="h-9 w-52" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-40" />
        </div>
      </div>
      <div className="overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3">
          <Shimmer className="h-3 w-full max-w-4xl" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-12 items-center gap-3 border-b border-[var(--admin-border)] px-4 py-4 last:border-b-0"
          >
            <Shimmer className="col-span-1 h-3 w-4" />
            <div className="col-span-3 space-y-2">
              <Shimmer className="h-4 w-3/4" />
              <Shimmer className="h-3 w-1/2" />
            </div>
            <Shimmer className="col-span-1 h-5 w-16" />
            <Shimmer className="col-span-1 h-3 w-8 justify-self-end" />
            <Shimmer className="col-span-1 h-3 w-8 justify-self-end" />
            <Shimmer className="col-span-1 h-3 w-10 justify-self-end" />
            <Shimmer className="col-span-2 h-3 w-full" />
            <Shimmer className="col-span-1 h-3 w-8 justify-self-end" />
            <Shimmer className="col-span-1 h-3 w-8 justify-self-end" />
            <Shimmer className="col-span-1 h-3 w-12 justify-self-end" />
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

export function AdminScoresProductPicker({
  productType,
  onProductTypeChange,
  onSelectProduct,
}: {
  productType: ScoreProductType;
  onProductTypeChange: (type: ScoreProductType) => void;
  onSelectProduct: (product: ScoreProductItem) => void;
}) {
  const searchId = useId();
  const ungradedToggleId = useId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ScoreProductItem[]>([]);
  const [summary, setSummary] = useState<ScoreProductsSummary>({
    productCount: 0,
    assessmentCount: 0,
    attemptCount: 0,
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
  const [passRateBand, setPassRateBand] = useState<ScorePassRateBand | "">("");
  const [hasUngraded, setHasUngraded] = useState(false);
  const [sortKey, setSortKey] = useState("attempts:desc");
  const [page, setPage] = useState(1);

  const sortByAttempts = sortKey.startsWith("attempts:");

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
    const sortBy = (sortByRaw ?? "attempts") as ScoreProductSortBy;
    const sortDir = sortDirRaw === "asc" ? "asc" : "desc";
    try {
      const response = await fetchScoreProducts(productType, {
        q: debouncedQ || undefined,
        page,
        limit: 25,
        passRateBand,
        hasUngraded: hasUngraded || undefined,
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
      setSummary({ productCount: 0, assessmentCount: 0, attemptCount: 0 });
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, hasUngraded, page, passRateBand, productType, sortKey]);

  useEffect(() => {
    void load();
  }, [load]);

  function clearFilters() {
    setSearchInput("");
    setDebouncedQ("");
    setPassRateBand("");
    setHasUngraded(false);
    setSortKey("attempts:desc");
    setPage(1);
  }

  const hasActiveFilters = Boolean(debouncedQ || passRateBand || hasUngraded);
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
      <div className="flex flex-col justify-between gap-6 border-b border-[var(--admin-border)] pb-6 lg:flex-row lg:items-end">
        <div className="flex max-w-xl flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]">
            Scores
          </h1>
          <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            Pick a product to see its assessments and learner results.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex h-10 items-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm font-semibold text-[var(--admin-on-surface)]"
            title="All recorded attempts are included; no date window is applied on this view"
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
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--admin-primary)]"
              aria-hidden="true"
            />
            {formatCount(summary.productCount)} products
            <span className="text-[var(--admin-outline)]">·</span>
            {formatCount(summary.assessmentCount)} assessments
            <span className="text-[var(--admin-outline)]">·</span>
            {formatCount(summary.attemptCount)} attempts
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
            value={passRateBand}
            onValueChange={(value) => {
              setPassRateBand(value as ScorePassRateBand | "");
              setPage(1);
            }}
            options={PASS_RATE_OPTIONS}
            className={selectClassName}
            ariaLabel="Pass rate band"
          />
          <button
            id={ungradedToggleId}
            type="button"
            aria-pressed={hasUngraded}
            className={[
              "inline-flex h-9 items-center gap-2 rounded-sm border px-3 text-xs font-semibold uppercase tracking-[0.06em] transition-colors",
              hasUngraded
                ? "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]"
                : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-outline)] hover:text-[var(--admin-on-surface)]",
            ].join(" ")}
            onClick={() => {
              setHasUngraded((current) => !current);
              setPage(1);
            }}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Has ungraded
          </button>
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
            <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-outline)]">
              <ClipboardList className="h-14 w-14" strokeWidth={1.25} aria-hidden="true" />
            </div>
            <h2 className="mb-3 text-2xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]">
              {hasActiveFilters
                ? "No products with assessments match these filters"
                : "No products with assessments yet"}
            </h2>
            <p className="mb-8 max-w-md text-base leading-relaxed text-[var(--admin-on-surface-variant)]">
              {hasActiveFilters
                ? "Adjust search, pass rate, or ungraded filters, or reset the view to see all scored products."
                : "Publish a product with assessments to start tracking learner scores here."}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                className={`${ghostButtonClassName} inline-flex h-11 items-center justify-center rounded-sm border-2 border-[var(--admin-on-surface)] px-8 uppercase tracking-[0.12em] leading-none text-[var(--admin-on-surface)] hover:bg-[var(--admin-on-surface)] hover:text-[var(--admin-surface)]`}
                onClick={clearFilters}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                  <th className="w-10 px-4 py-3 font-medium">#</th>
                  <th className="min-w-[220px] px-4 py-3 font-medium">Product</th>
                  <th className="w-28 px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Assessments</th>
                  <th className="px-4 py-3 text-right font-medium">Learners Attempted</th>
                  <th className="px-4 py-3 text-right font-medium">Attempts</th>
                  <th className="min-w-[140px] px-4 py-3 font-medium">Avg. Score</th>
                  <th className="px-4 py-3 text-right font-medium">Pass Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Ungraded</th>
                  <th className="min-w-[120px] px-4 py-3 text-right font-medium">Last Attempt</th>
                  <th className="w-12 px-4 py-3 text-center font-medium">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {items.map((product, index) => {
                  const rowNumber = showingFrom + index;
                  const zeroAttempts = product.attemptCount === 0;
                  const avg = product.avgScorePct;
                  const passRate = product.passRatePct;
                  const lowPassRate = passRate != null && passRate < 50;
                  const belowPassMark =
                    product.passMarkPct != null && avg != null && avg < product.passMarkPct;

                  return (
                    <tr
                      key={product.id}
                      className={[
                        "group cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]",
                        zeroAttempts ? "opacity-60" : "",
                      ].join(" ")}
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
                      aria-label={`Open scores for ${product.title}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                        {rowNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--admin-on-surface)] transition-colors group-hover:text-[var(--admin-primary)]">
                          {product.title}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                          {productPath(product.productType, product.slug)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--admin-on-surface-variant)]">
                          {typeLabel(product.productType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[var(--admin-on-surface)]">
                        {formatCount(product.assessmentCount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[var(--admin-on-surface)]">
                        {formatCount(product.learnersAttempted)}
                      </td>
                      <td
                        className={[
                          "px-4 py-3 text-right font-mono text-xs tabular-nums",
                          sortByAttempts
                            ? "font-semibold text-[var(--admin-success)]"
                            : "text-[var(--admin-on-surface)]",
                        ].join(" ")}
                      >
                        {formatCount(product.attemptCount)}
                      </td>
                      {zeroAttempts ? (
                        <td
                          colSpan={4}
                          className="px-4 py-3 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
                        >
                          No attempts recorded
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-3">
                              <span
                                className={[
                                  "font-mono text-xs tabular-nums",
                                  belowPassMark
                                    ? "text-[var(--admin-danger)]"
                                    : "text-[var(--admin-on-surface)]",
                                ].join(" ")}
                              >
                                {formatPct(avg)}
                              </span>
                              {product.passMarkPct != null ? (
                                <ScoreBar avgPct={avg} passMarkPct={product.passMarkPct} />
                              ) : (
                                <div className="h-[3px] w-16 shrink-0 bg-[var(--admin-surface-high)]">
                                  <div
                                    className="h-full bg-[var(--admin-primary)]"
                                    style={{
                                      width: `${String(Math.min(100, Math.max(0, avg ?? 0)))}%`,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {lowPassRate ? (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 shrink-0 text-[var(--admin-warning)]"
                                  aria-label="Pass rate below 50%"
                                />
                              ) : null}
                              <span
                                className={[
                                  "font-mono text-xs tabular-nums",
                                  lowPassRate
                                    ? "text-[var(--admin-warning)]"
                                    : "text-[var(--admin-on-surface)]",
                                ].join(" ")}
                              >
                                {formatPct(passRate)}
                              </span>
                            </div>
                          </td>
                          <td
                            className={[
                              "px-4 py-3 text-right font-mono text-xs tabular-nums",
                              product.ungradedCount > 0
                                ? "font-semibold text-[var(--admin-warning)]"
                                : "text-[var(--admin-on-surface-variant)]",
                            ].join(" ")}
                          >
                            {product.ungradedCount > 0 ? formatCount(product.ungradedCount) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="font-mono text-xs text-[var(--admin-on-surface)]">
                              {formatRelative(product.lastAttemptAt)}
                            </div>
                            {product.lastAttemptAt ? (
                              <div className="mt-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                {formatAbsolute(product.lastAttemptAt)}
                              </div>
                            ) : null}
                          </td>
                        </>
                      )}
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
              Showing {showingFrom}-{showingTo} of {formatCount(pageInfo.totalCount)} products
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
                {pageButtons.map((pageNumber, pageIndex) => {
                  const prev = pageButtons[pageIndex - 1];
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
