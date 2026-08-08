"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Code2,
  Download,
  History,
  Minus,
  Package,
  RefreshCw,
  Search,
  Tag,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  exportSalesMarketingReport,
  fetchSalesProducts,
  type SalesProductItem,
  type SalesProductsList,
  type SalesProductsSortBy,
  type SalesProductsSummary,
} from "./admin-sales-marketing-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type Props = {
  /** Optional; row click navigates to the purchasers route. Kept for backward compatibility. */
  onSelectProduct?: (product: SalesProductItem) => void;
};

const DATE_PRESETS = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last quarter", days: 90 },
  { value: "ytd", label: "Year to date", days: null },
  { value: "custom", label: "Custom range", days: null },
] as const;

type DatePreset = (typeof DATE_PRESETS)[number]["value"];

function defaultRange(days = 30): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function ytdRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(Date.UTC(to.getUTCFullYear(), 0, 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function formatMoneyAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShortDate(iso: string): string {
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function productTypeLabel(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized.includes("sub")) return "Subscription";
  if (normalized.includes("bundle")) return "Bundle";
  if (normalized.includes("live")) return "Live class";
  if (normalized.includes("digital") || normalized.includes("ebook")) return "Digital";
  return "Course";
}

function ProductIcon({ type }: { type: string }) {
  const normalized = type.toLowerCase();
  const className = "h-4 w-4";
  if (normalized.includes("bundle")) return <Package className={className} aria-hidden="true" />;
  if (normalized.includes("live")) return <Tag className={className} aria-hidden="true" />;
  if (normalized.includes("code") || normalized.includes("tech"))
    return <Code2 className={className} aria-hidden="true" />;
  return <BookOpen className={className} aria-hidden="true" />;
}

function ChangePill({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
        <Minus className="h-3 w-3" aria-hidden="true" />—
      </span>
    );
  }
  const up = value >= 0;
  return (
    <span
      className={[
        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium",
        up
          ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]"
          : "bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]",
      ].join(" ")}
    >
      {up ? (
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
      ) : (
        <TrendingDown className="h-3 w-3" aria-hidden="true" />
      )}
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function SalesByProductSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading sales by product">
      <div className="flex justify-between gap-4">
        <div className="space-y-2">
          <Shimmer className="h-8 w-52" />
          <Shimmer className="h-4 w-72 max-w-full" />
        </div>
        <Shimmer className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
          >
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-8 w-32" />
            <Shimmer className="mt-auto h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <Shimmer className="h-9 w-48" />
          <Shimmer className="h-9 w-40" />
          <Shimmer className="h-9 w-56" />
        </div>
        <div className="divide-y divide-[var(--admin-border)]">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex h-11 items-center gap-4 px-4">
              <Shimmer className="h-4 w-8" />
              <Shimmer className="h-4 flex-1" />
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  suffix,
  change,
  previousLabel,
}: {
  label: string;
  value: string;
  suffix?: string | undefined;
  change: number | null;
  previousLabel?: string | undefined;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
      <span className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">{label}</span>
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <span className="font-mono text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
          {value}
        </span>
        {suffix ? (
          <span className="pb-1 text-xs text-[var(--admin-on-surface-variant)]">{suffix}</span>
        ) : null}
        <ChangePill value={change} />
      </div>
      {previousLabel ? (
        <span className="text-[11px] text-[var(--admin-on-surface-variant)]">{previousLabel}</span>
      ) : null}
    </div>
  );
}

export function AdminSalesByProductPanel({ onSelectProduct }: Props) {
  const router = useRouter();
  const initial = useMemo(() => defaultRange(30), []);
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [paidFrom, setPaidFrom] = useState(initial.from);
  const [paidTo, setPaidTo] = useState(initial.to);
  const [productType, setProductType] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [sortBy, setSortBy] = useState<SalesProductsSortBy>("revenue_cents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<SalesProductsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = useCallback((next: DatePreset) => {
    setPreset(next);
    if (next === "custom") return;
    if (next === "ytd") {
      const range = ytdRange();
      setPaidFrom(range.from);
      setPaidTo(range.to);
      return;
    }
    const days = DATE_PRESETS.find((item) => item.value === next)?.days ?? 30;
    const range = defaultRange(days);
    setPaidFrom(range.from);
    setPaidTo(range.to);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSalesProducts({
        q: searchQ.trim() || undefined,
        paidFrom: dateInputToStartIso(paidFrom),
        paidTo: dateInputToEndIso(paidTo),
        productType: productType || undefined,
        sortBy,
        sortDir,
        page,
        limit: 25,
      });
      setPayload(response.data);
    } catch (loadError) {
      setPayload(null);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load sales by product data.",
      );
    } finally {
      setLoading(false);
    }
  }, [paidFrom, paidTo, page, productType, searchQ, sortBy, sortDir]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportSalesMarketingReport({
        section: "sales",
        q: searchQ.trim() || undefined,
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      if (completed.status === "completed") {
        await downloadReportExport(completed.id, "csv");
      }
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export report.",
      );
    } finally {
      setBusy(false);
    }
  }

  function resetFilters() {
    applyPreset("30d");
    setProductType("");
    setSearchQ("");
    setSortBy("revenue_cents");
    setSortDir("desc");
    setPage(1);
  }

  function toggleSort(next: SalesProductsSortBy) {
    if (sortBy === next) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(next);
      setSortDir(next === "product_title" ? "asc" : "desc");
    }
    setPage(1);
  }

  const summary: SalesProductsSummary | null = payload?.summary ?? null;
  const items = payload?.items ?? [];
  const pageInfo = payload?.pageInfo;
  const isEmpty =
    !loading &&
    !error &&
    payload != null &&
    payload.summary.productCount === 0 &&
    items.length === 0;

  const productTypeOptions = useMemo(() => {
    const types = payload?.productTypes ?? [];
    return [
      { value: "", label: "All categories" },
      ...types.map((type) => ({ value: type, label: productTypeLabel(type) })),
    ];
  }, [payload?.productTypes]);

  const maxShare = Math.max(1, ...items.map((item) => item.revenueSharePercent));

  if (loading && !payload) {
    return <SalesByProductSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
              Sales by Product
            </h1>
            {!error && !isEmpty ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-success)]" />
                Live data
              </span>
            ) : null}
          </div>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Revenue attribution and product performance across paid orders.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px disabled:opacity-50"
          onClick={() => void handleExport()}
          disabled={busy || loading || Boolean(error)}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {error ? (
        <div
          className="flex flex-col gap-4 rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-base font-semibold text-[var(--admin-danger)]">
                Couldn&apos;t load sales by product data.
              </h2>
              <p className="mt-0.5 text-sm text-[color-mix(in_srgb,var(--admin-danger)_80%,var(--admin-on-surface))]">
                {error}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded border border-[var(--admin-danger)] px-4 text-xs font-medium text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] active:translate-y-px"
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="pointer-events-none opacity-30">
          <SalesByProductSkeleton />
        </div>
      ) : null}

      {!error && isEmpty ? (
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">Date range</span>
                <span className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm">
                  <CalendarDays
                    className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  {formatShortDate(paidFrom)} – {formatShortDate(paidTo)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-sm">
              <Tag
                className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              No products with sales in this range
            </h2>
            <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
              There is no sales data for the selected filters. Try adjusting the date range or
              clearing category filters.
            </p>
            <button
              type="button"
              className="mt-8 inline-flex h-10 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-5 text-sm font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
              onClick={resetFilters}
            >
              <History className="h-4 w-4" aria-hidden="true" />
              Reset date range
            </button>
          </div>
        </div>
      ) : null}

      {!error && !isEmpty && summary ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total revenue"
              value={formatMoneyAmount(summary.totalRevenueCents)}
              suffix={summary.currency}
              change={summary.revenueChangePercent}
              previousLabel={
                summary.revenueChangePercent != null
                  ? `vs prior period (${formatMoneyAmount(summary.previousTotalRevenueCents)} ${summary.currency})`
                  : undefined
              }
            />
            <KpiCard
              label="Units sold"
              value={summary.totalUnitsSold.toLocaleString()}
              change={summary.unitsChangePercent}
              previousLabel={
                summary.unitsChangePercent != null
                  ? `vs prior period (${summary.previousTotalUnitsSold.toLocaleString()})`
                  : undefined
              }
            />
            <KpiCard
              label="Avg. order value"
              value={formatMoneyAmount(summary.avgOrderCents)}
              suffix={summary.currency}
              change={null}
            />
            <KpiCard
              label="Products with sales"
              value={summary.productCount.toLocaleString()}
              change={null}
              previousLabel={`Net ${formatMoneyAmount(summary.totalNetCents)} ${summary.currency}`}
            />
          </div>

          <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
              <div className="flex flex-wrap gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">Date range</span>
                  <Select
                    value={preset}
                    onValueChange={(value) => {
                      applyPreset(value as DatePreset);
                    }}
                    options={DATE_PRESETS.map((item) => ({
                      value: item.value,
                      label: item.label,
                    }))}
                    ariaLabel="Date range preset"
                    className="h-9 min-w-[160px]"
                  />
                </label>
                {preset === "custom" ? (
                  <label className="inline-flex h-9 items-end gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs">
                    <CalendarDays
                      className="mb-2.5 h-4 w-4 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <input
                      type="date"
                      value={paidFrom}
                      onChange={(event) => {
                        setPaidFrom(event.target.value);
                        setPage(1);
                      }}
                      className="bg-transparent pb-2 outline-none"
                    />
                    <span className="pb-2 text-[var(--admin-on-surface-variant)]">–</span>
                    <input
                      type="date"
                      value={paidTo}
                      onChange={(event) => {
                        setPaidTo(event.target.value);
                        setPage(1);
                      }}
                      className="bg-transparent pb-2 outline-none"
                    />
                  </label>
                ) : null}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">Category</span>
                  <Select
                    value={productType}
                    onValueChange={(value) => {
                      setProductType(value);
                      setPage(1);
                    }}
                    options={productTypeOptions}
                    ariaLabel="Product category"
                    className="h-9 min-w-[160px]"
                  />
                </label>
                <label className="relative flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">Search</span>
                  <span className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <input
                      value={searchQ}
                      onChange={(event) => {
                        setSearchQ(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Search products…"
                      className="h-9 w-56 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-8 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    />
                  </span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded border border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
                  title="Refresh"
                  onClick={() => void load()}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
                  <tr>
                    <th className="w-12 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      #
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                        onClick={() => {
                          toggleSort("product_title");
                        }}
                      >
                        Product
                        {sortBy === "product_title" ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : null}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                        onClick={() => {
                          toggleSort("purchaser_count");
                        }}
                      >
                        Units
                        {sortBy === "purchaser_count" ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : null}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className={[
                          "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.06em] hover:text-[var(--admin-on-surface)]",
                          sortBy === "revenue_cents"
                            ? "text-[var(--admin-primary)]"
                            : "text-[var(--admin-on-surface-variant)]",
                        ].join(" ")}
                        onClick={() => {
                          toggleSort("revenue_cents");
                        }}
                      >
                        Gross
                        {sortBy === "revenue_cents" ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : null}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                        onClick={() => {
                          toggleSort("discount_cents");
                        }}
                      >
                        Discount
                        {sortBy === "discount_cents" ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : null}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                        onClick={() => {
                          toggleSort("net_cents");
                        }}
                      >
                        Net / share
                        {sortBy === "net_cents" ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : null}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((product, index) => {
                    const rank =
                      ((pageInfo?.page ?? 1) - 1) * (pageInfo?.pageSize ?? 25) + index + 1;
                    const shareWidth = Math.max(4, (product.revenueSharePercent / maxShare) * 100);
                    return (
                      <tr
                        key={product.courseId}
                        className="group cursor-pointer border-b border-[var(--admin-border)] transition-colors last:border-b-0 hover:bg-[color-mix(in_srgb,var(--admin-surface-low)_70%,transparent)]"
                        onClick={() => {
                          router.push(`/admin/reports/sales-marketing/sales/${product.courseId}`);
                          onSelectProduct?.(product);
                        }}
                      >
                        <td className="h-11 px-4 text-center font-mono text-sm text-[var(--admin-on-surface-variant)]">
                          {rank}
                        </td>
                        <td className="h-11 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={[
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded",
                                index === 0
                                  ? "bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]"
                                  : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                              ].join(" ")}
                            >
                              <ProductIcon type={product.productType} />
                            </div>
                            <span className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                              {product.productTitle}
                            </span>
                          </div>
                        </td>
                        <td className="h-11 px-4">
                          <span className="rounded bg-[var(--admin-surface-high)] px-2 py-1 text-xs text-[var(--admin-on-surface-variant)]">
                            {productTypeLabel(product.productType)}
                          </span>
                        </td>
                        <td className="h-11 px-4 text-right font-mono text-sm font-medium text-[var(--admin-on-surface)]">
                          {product.unitsSold.toLocaleString()}
                        </td>
                        <td className="h-11 px-4 text-right font-mono text-sm text-[var(--admin-on-surface)]">
                          {formatMoneyAmount(product.revenueCents)}
                          <span className="ml-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                            {product.currency}
                          </span>
                        </td>
                        <td className="h-11 px-4 text-right font-mono text-sm text-[var(--admin-warning)]">
                          {formatMoneyAmount(product.discountCents)}
                        </td>
                        <td className="relative h-11 px-4">
                          <div className="pointer-events-none absolute inset-y-1 left-4 right-4 overflow-hidden rounded bg-[color-mix(in_srgb,var(--admin-primary-strong)_6%,transparent)]">
                            <div
                              className="ml-auto h-full rounded-r bg-[color-mix(in_srgb,var(--admin-primary-strong)_18%,transparent)]"
                              style={{ width: `${String(shareWidth)}%` }}
                            />
                          </div>
                          <div className="relative z-10 flex items-center justify-end gap-2 pr-1">
                            <span className="font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
                              {formatMoneyAmount(product.netCents)}
                            </span>
                            <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                              {product.revenueSharePercent}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pageInfo && pageInfo.totalPages > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                <p>
                  Showing {(pageInfo.page - 1) * pageInfo.pageSize + 1}–
                  {Math.min(pageInfo.page * pageInfo.pageSize, pageInfo.totalCount)} of{" "}
                  {pageInfo.totalCount} products
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-[var(--admin-outline)] px-3 py-1 transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                    disabled={!pageInfo.hasPreviousPage || loading}
                    onClick={() => {
                      setPage((current) => Math.max(1, current - 1));
                    }}
                  >
                    Previous
                  </button>
                  <span className="font-mono text-xs">
                    {pageInfo.page} / {pageInfo.totalPages}
                  </span>
                  <button
                    type="button"
                    className="rounded border border-[var(--admin-outline)] px-3 py-1 transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                    disabled={!pageInfo.hasNextPage || loading}
                    onClick={() => {
                      setPage((current) => current + 1);
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
