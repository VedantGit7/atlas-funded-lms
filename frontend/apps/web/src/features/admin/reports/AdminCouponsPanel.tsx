"use client";

import {
  AlertTriangle,
  ChevronRight,
  Copy,
  Download,
  Plus,
  RefreshCw,
  Search,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  COUPONS_CREATE_HREF,
  COUPONS_LIST_HREF,
} from "../grow/coupons-shared";
import {
  exportSalesMarketingReport,
  fetchSalesCoupons,
  type CouponListItem,
  type CouponsList,
  type CouponsListSortBy,
  type CouponsListSummary,
  type CouponsListView,
} from "./admin-sales-marketing-roster-api";
import {
  downloadReportExport,
  pollReportRunUntilComplete,
} from "./admin-reports-api";

const VIEW_TABS: Array<{ key: CouponsListView; label: string }> = [
  { key: "all", label: "All coupons" },
  { key: "active", label: "Active" },
  { key: "never_used", label: "Never used" },
  { key: "expiring_soon", label: "Expiring soon" },
  { key: "inactive", label: "Archived" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "DRAFT", label: "DRAFT" },
  { value: "INACTIVE", label: "INACTIVE" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "PERCENT", label: "PERCENT" },
  { value: "FIXED", label: "FIXED" },
];

const SORT_OPTIONS: Array<{ value: CouponsListSortBy; label: string }> = [
  { value: "revenue_cents", label: "Revenue" },
  { value: "discount_cents", label: "Discount cost" },
  { value: "net_cents", label: "Net" },
  { value: "redemption_count", label: "Redemptions" },
  { value: "created_at", label: "Created" },
  { value: "code", label: "Code" },
];

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

function discountLabel(type: string, value: number, currency: string): string {
  if (type.toUpperCase() === "PERCENT") {
    return `${value}% OFF`;
  }
  return `${formatMoneyAmount(value)} ${currency} OFF`;
}

function statusPillClass(displayStatus: string): string {
  const normalized = displayStatus.toUpperCase();
  if (normalized === "ACTIVE") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (normalized === "CAP_REACHED") {
    return "bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function statusLabel(displayStatus: string): string {
  return displayStatus.replace(/_/g, " ");
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
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

function CouponsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading coupons">
      <div className="flex justify-between gap-4">
        <div className="space-y-2">
          <Shimmer className="h-8 w-40" />
          <Shimmer className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
          >
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-8 w-32" />
            <Shimmer className="mt-auto h-1.5 w-full" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex gap-2 border-b border-[var(--admin-border)] p-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Shimmer key={index} className="h-8 w-24" />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <Shimmer className="h-9 w-48" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-32" />
        </div>
        <div className="divide-y divide-[var(--admin-border)]">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex h-12 items-center gap-4 px-4">
              <Shimmer className="h-4 w-4" />
              <Shimmer className="h-4 w-28" />
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

function redemptionProgress(item: CouponListItem): number {
  if (item.totalUsageLimit == null || item.totalUsageLimit <= 0) {
    return item.redemptionCount > 0 ? 12 : 0;
  }
  return Math.min(100, Math.round((item.redemptionCount / item.totalUsageLimit) * 100));
}

export function AdminCouponsPanel() {
  const router = useRouter();
  const [view, setView] = useState<CouponsListView>("all");
  const [searchQ, setSearchQ] = useState("");
  const [status, setStatus] = useState("");
  const [discountType, setDiscountType] = useState("");
  const [sortBy, setSortBy] = useState<CouponsListSortBy>("revenue_cents");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<CouponsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtersActive =
    view !== "all" || Boolean(status) || Boolean(discountType) || Boolean(searchQ.trim());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSalesCoupons({
        q: searchQ.trim() || undefined,
        status: status || undefined,
        discountType: discountType || undefined,
        view,
        sortBy,
        sortDir: "desc",
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
            : "Couldn't load coupons data.",
      );
    } finally {
      setLoading(false);
    }
  }, [discountType, page, searchQ, sortBy, status, view]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportSalesMarketingReport({
        section: "coupons",
        q: searchQ.trim() || undefined,
        status: status || undefined,
        discountType: discountType || undefined,
        view,
        sortBy,
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

  function clearFilters() {
    setView("all");
    setSearchQ("");
    setStatus("");
    setDiscountType("");
    setSortBy("revenue_cents");
    setPage(1);
    setSelectedIds(new Set());
  }

  async function handleCopyCode(item: CouponListItem, event: MouseEvent) {
    event.stopPropagation();
    const ok = await copyToClipboard(item.code);
    if (ok) {
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1500);
    }
  }

  function toggleSelectAllOnPage(items: CouponListItem[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = items.length > 0 && items.every((item) => next.has(item.id));
      if (allSelected) {
        for (const item of items) next.delete(item.id);
      } else {
        for (const item of items) next.add(item.id);
      }
      return next;
    });
  }

  function toggleRow(id: string, event: MouseEvent) {
    event.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const summary: CouponsListSummary | null = payload?.summary ?? null;
  const items = payload?.items ?? [];
  const pageInfo = payload?.pageInfo;
  const hasAnyCoupons = (summary?.couponCount ?? 0) > 0 || items.length > 0;
  const isEmpty = !loading && !error && payload != null && items.length === 0;
  const isTrulyEmpty = isEmpty && !filtersActive && (summary?.couponCount ?? 0) === 0;
  const allOnPageSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.id));

  const revenueFill =
    summary && summary.totalRevenueCents > 0
      ? Math.min(
          100,
          Math.round(
            (summary.totalNetCents / Math.max(summary.totalRevenueCents, 1)) * 100,
          ),
        )
      : 0;

  if (loading && !payload) {
    return <CouponsSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Coupons
          </h1>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            Discount codes, what they cost, and what they brought in.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px disabled:opacity-50"
            onClick={() => void handleExport()}
            disabled={busy || loading || Boolean(error)}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <Link
            href={COUPONS_LIST_HREF}
            className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
          >
            Manage coupons
          </Link>
          <Link
            href={COUPONS_CREATE_HREF}
            className="inline-flex h-9 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New coupon
          </Link>
        </div>
      </div>

      {error ? (
        <div
          className="flex flex-col gap-4 rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-[var(--admin-danger)]">
                Couldn&apos;t load coupons data.
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
          <CouponsSkeleton />
        </div>
      ) : null}

      {!error && summary && (!isEmpty || hasAnyCoupons || filtersActive) ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
            <span className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
              Revenue Driven
            </span>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
                {formatMoneyAmount(summary.totalRevenueCents)}
              </span>
              <span className="pb-1 text-xs text-[var(--admin-on-surface-variant)]">
                {summary.currency}
              </span>
            </div>
            <div className="mt-auto h-1 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
              <div
                className="h-full rounded-full bg-[var(--admin-primary)]"
                style={{ width: `${Math.max(4, revenueFill)}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
            <span className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
              Discount Given
            </span>
            <div className="mb-1 flex flex-wrap items-end gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-[var(--admin-warning)]">
                {formatMoneyAmount(summary.totalDiscountCents)}
              </span>
              <span className="pb-1 text-xs text-[var(--admin-on-surface-variant)]">
                {summary.currency}
              </span>
            </div>
            <span className="mt-auto text-[11px] text-[var(--admin-on-surface-variant)]">
              {summary.discountPercentOfGross}% of gross
            </span>
          </div>

          <div className="flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
            <span className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
              Net to Tenant
            </span>
            <div className="flex flex-wrap items-end gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-[var(--admin-success)]">
                {formatMoneyAmount(summary.totalNetCents)}
              </span>
              <span className="pb-1 text-xs text-[var(--admin-on-surface-variant)]">
                {summary.currency}
              </span>
            </div>
          </div>

          <div className="flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
            <span className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
              Redemptions
            </span>
            <span className="mb-1 font-mono text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
              {summary.totalRedemptions.toLocaleString()}
            </span>
            <span className="mt-auto text-[11px] text-[var(--admin-on-surface-variant)]">
              {summary.avgRedemptionsPerActive} per active coupon
            </span>
          </div>
        </div>
      ) : null}

      {!error && isEmpty ? (
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-sm">
              <Tag className="h-8 w-8 text-[var(--admin-on-surface-variant)]" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              {isTrulyEmpty ? "No coupons yet" : "No coupons match these filters"}
            </h2>
            <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
              {isTrulyEmpty
                ? "Create discount codes in Marketing → Coupons to track revenue driven and discount cost here."
                : "Try clearing filters or switching views. You can also manage codes under Marketing → Coupons."}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {isTrulyEmpty ? (
                <Link
                  href={COUPONS_CREATE_HREF}
                  className="inline-flex h-10 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-5 text-sm font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New coupon
                </Link>
              ) : (
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-5 text-sm font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!error && !isEmpty ? (
        <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <div className="flex gap-1 overflow-x-auto border-b border-[var(--admin-border)] px-3 pt-2">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={[
                  "whitespace-nowrap border-b-2 px-3 pb-2.5 text-xs font-medium transition-colors",
                  view === tab.key
                    ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                    : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
                onClick={() => {
                  setView(tab.key);
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
            <div className="flex flex-wrap gap-3">
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
                    placeholder="Code or name…"
                    className="h-9 w-56 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-8 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                  />
                </span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">Status</span>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                  options={STATUS_OPTIONS}
                  ariaLabel="Coupon status"
                  className="h-9 min-w-[140px]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">Type</span>
                <Select
                  value={discountType}
                  onValueChange={(value) => {
                    setDiscountType(value);
                    setPage(1);
                  }}
                  options={TYPE_OPTIONS}
                  ariaLabel="Discount type"
                  className="h-9 min-w-[140px]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">Sort</span>
                <Select
                  value={sortBy}
                  onValueChange={(value) => {
                    setSortBy(value as CouponsListSortBy);
                    setPage(1);
                  }}
                  options={SORT_OPTIONS}
                  ariaLabel="Sort coupons"
                  className="h-9 min-w-[160px]"
                />
              </label>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
              title="Refresh"
              onClick={() => void load()}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--admin-primary)]"
                      checked={allOnPageSelected}
                      onChange={() => toggleSelectAllOnPage(items)}
                      aria-label="Select all on page"
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Code / Name
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Discount
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Redemptions
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Revenue
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Discount cost
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Net
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Created
                  </th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((coupon) => {
                  const neverUsed = coupon.redemptionCount === 0;
                  const selected = selectedIds.has(coupon.id);
                  const progress = redemptionProgress(coupon);
                  const limitLabel =
                    coupon.totalUsageLimit == null ? "UNL" : String(coupon.totalUsageLimit);
                  return (
                    <tr
                      key={coupon.id}
                      className={[
                        "group cursor-pointer border-b border-[var(--admin-border)] transition-colors last:border-b-0 hover:bg-[color-mix(in_srgb,var(--admin-surface-low)_70%,transparent)]",
                        neverUsed ? "opacity-60" : "",
                        selected
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                          : "",
                      ].join(" ")}
                      onClick={() =>
                        router.push(`/admin/reports/sales-marketing/coupons/${coupon.id}`)
                      }
                    >
                      <td className="h-12 px-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          checked={selected}
                          onClick={(event) => toggleRow(coupon.id, event)}
                          onChange={() => undefined}
                          aria-label={`Select ${coupon.code}`}
                        />
                      </td>
                      <td className="h-12 px-4">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="font-mono text-sm font-medium uppercase text-[var(--admin-on-surface)]">
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            className="rounded p-0.5 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity hover:text-[var(--admin-primary)] group-hover:opacity-100"
                            title={copiedId === coupon.id ? "Copied" : "Copy code"}
                            onClick={(event) => void handleCopyCode(coupon, event)}
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        <p className="truncate text-[11px] text-[var(--admin-on-surface-variant)]">
                          {coupon.name}
                        </p>
                      </td>
                      <td className="h-12 px-4">
                        <span
                          className={[
                            "inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize",
                            statusPillClass(coupon.displayStatus),
                          ].join(" ")}
                        >
                          {statusLabel(coupon.displayStatus)}
                        </span>
                      </td>
                      <td className="h-12 px-4">
                        <span className="inline-flex rounded bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--admin-on-surface)]">
                          {discountLabel(
                            coupon.discountType,
                            coupon.discountValue,
                            coupon.currency,
                          )}
                        </span>
                      </td>
                      <td className="h-12 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-sm text-[var(--admin-on-surface)]">
                            {coupon.redemptionCount.toLocaleString()}
                            <span className="text-[var(--admin-on-surface-variant)]">
                              {" "}
                              / {limitLabel}
                            </span>
                          </span>
                          <div className="h-1 w-20 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                            <div
                              className="h-full rounded-full bg-[var(--admin-primary)]"
                              style={{ width: `${Math.max(progress > 0 ? 4 : 0, progress)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="h-12 px-4 text-right font-mono text-sm text-[var(--admin-on-surface)]">
                        {formatMoneyAmount(coupon.totalRevenueCents)}
                      </td>
                      <td className="h-12 px-4 text-right font-mono text-sm text-[var(--admin-warning)]">
                        {formatMoneyAmount(coupon.totalDiscountCents)}
                      </td>
                      <td className="h-12 px-4 text-right font-mono text-sm font-semibold text-[var(--admin-success)]">
                        {formatMoneyAmount(coupon.netCents)}
                      </td>
                      <td className="h-12 px-4 text-sm text-[var(--admin-on-surface-variant)]">
                        {formatShortDate(coupon.createdAt)}
                      </td>
                      <td className="h-12 px-2">
                        <ChevronRight
                          className="h-4 w-4 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden="true"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs">
              Revenue driven counts the full order value before discount.
            </p>
            {pageInfo && pageInfo.totalPages > 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                <p>
                  Showing {(pageInfo.page - 1) * pageInfo.pageSize + 1}–
                  {Math.min(pageInfo.page * pageInfo.pageSize, pageInfo.totalCount)} of{" "}
                  {pageInfo.totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-[var(--admin-outline)] px-3 py-1 transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                    disabled={!pageInfo.hasPreviousPage || loading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
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
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
