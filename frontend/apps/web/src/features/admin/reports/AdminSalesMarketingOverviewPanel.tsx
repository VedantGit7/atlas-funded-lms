"use client";

import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  Tag,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  exportSalesMarketingReport,
  fetchSalesMarketingOverview,
  type SalesMarketingOverview,
  type SalesMarketingOverviewGrain,
} from "./admin-sales-marketing-roster-api";
import {
  downloadReportExport,
  pollReportRunUntilComplete,
} from "./admin-reports-api";

type Props = {
  onNavigateTab: (tab: "sales" | "coupons" | "referral-wallet" | "affiliates" | "exports") => void;
};

const GRAIN_OPTIONS: Array<{ value: SalesMarketingOverviewGrain; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const CHANNEL_STACK = [
  {
    key: "directCents" as const,
    label: "Direct",
    color: "var(--admin-primary-strong)",
    percentKey: "directPercent" as const,
  },
  {
    key: "couponCents" as const,
    label: "Coupon",
    color: "var(--admin-primary)",
    percentKey: "couponPercent" as const,
  },
  {
    key: "referralCents" as const,
    label: "Referral",
    color: "color-mix(in srgb, var(--admin-primary) 55%, white)",
    percentKey: "referralPercent" as const,
  },
  {
    key: "affiliateCents" as const,
    label: "Affiliate",
    color: "color-mix(in srgb, var(--admin-primary) 28%, white)",
    percentKey: "affiliatePercent" as const,
  },
];

function formatCompact(cents: number): string {
  const value = cents / 100;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatShortDate(iso: string): string {
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMoneyAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function productTypeLabel(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized.includes("sub")) return "Sub";
  if (normalized.includes("bundle")) return "Bundle";
  if (normalized.includes("digital") || normalized.includes("ebook")) return "Digital";
  if (normalized.includes("live")) return "Live";
  return "Course";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 36 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function sparklinePath(points: number[]): string {
  if (points.length === 0) return "M0,30 L0,28 L100,28 L100,30 Z";
  const max = Math.max(1, ...points);
  const step = points.length === 1 ? 0 : 100 / (points.length - 1);
  const line = points
    .map((value, index) => {
      const x = points.length === 1 ? 50 : index * step;
      const y = 28 - (value / max) * 22;
      return `${index === 0 ? "L" : "L"}${x},${y}`;
    })
    .join(" ");
  return `M0,30 L0,${28 - (points[0]! / max) * 22} ${line} L100,30 Z`;
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

function OverviewLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading sales and marketing overview">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="space-y-2">
          <Shimmer className="h-8 w-56" />
          <Shimmer className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-40" />
          <Shimmer className="h-9 w-20" />
          <Shimmer className="h-9 w-24" />
          <Shimmer className="h-9 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="relative col-span-12 flex h-32 flex-col justify-between overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-4">
          <Shimmer className="h-3 w-28" />
          <Shimmer className="h-9 w-44" />
        </div>
        <div className="col-span-12 flex divide-x divide-[var(--admin-border)] overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] md:col-span-8">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-1 flex-col justify-between p-5">
              <Shimmer className="mb-3 h-3 w-20" />
              <Shimmer className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-7">
          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <Shimmer className="mb-6 h-5 w-48" />
            <Shimmer className="mb-4 h-3 w-full rounded-full" />
            <div className="mb-8 flex gap-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <Shimmer key={index} className="h-3 w-16" />
              ))}
            </div>
            <div className="flex h-48 items-end justify-between gap-3 px-2">
              {[40, 65, 35, 80, 50].map((height, index) => (
                <div
                  key={index}
                  className="w-8 rounded-t bg-[var(--admin-surface-high)]"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
              <Shimmer className="h-5 w-32" />
            </div>
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
              >
                <Shimmer className="h-4 flex-1" />
                <Shimmer className="h-4 w-12" />
                <Shimmer className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-8 lg:col-span-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]"
            >
              <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                <Shimmer className="h-5 w-40" />
              </div>
              {Array.from({ length: 3 }).map((__, row) => (
                <div
                  key={row}
                  className="flex h-11 items-center gap-3 border-b border-[var(--admin-border)] px-4 last:border-b-0"
                >
                  <Shimmer className="h-4 flex-1" />
                  <Shimmer className="h-4 w-16" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AttributionChart({
  points,
  grain,
  onGrainChange,
}: {
  points: SalesMarketingOverview["revenueTrend"];
  grain: SalesMarketingOverviewGrain;
  onGrainChange: (grain: SalesMarketingOverviewGrain) => void;
}) {
  const maxTotal = Math.max(1, ...points.map((point) => point.totalCents));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
          Trend by channel
        </p>
        <div className="flex rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-0.5">
          {GRAIN_OPTIONS.map((option) => {
            const active = grain === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={[
                  "rounded-sm px-2.5 py-1 font-mono text-[11px] transition-colors",
                  active
                    ? "bg-[var(--admin-surface)] text-[var(--admin-on-surface)] shadow-sm"
                    : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
                onClick={() => onGrainChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-2 flex h-48 items-end justify-between border-b border-[var(--admin-border)] px-2 pb-2">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
          <span>{formatCompact(maxTotal)}</span>
          <span>{formatCompact(maxTotal / 2)}</span>
          <span>0</span>
        </div>
        <div className="pointer-events-none absolute left-6 right-0 top-0 h-px border-t border-dashed border-[var(--admin-border)]" />
        <div className="pointer-events-none absolute left-6 right-0 top-1/2 h-px border-t border-dashed border-[var(--admin-border)]" />

        {points.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center pl-6 text-sm text-[var(--admin-on-surface-variant)]">
            No revenue in this range
          </div>
        ) : (
          points.map((point, index) => {
            const heightPct = Math.max(4, (point.totalCents / maxTotal) * 100);
            const label =
              points.length <= 8 ||
              index === 0 ||
              index === points.length - 1 ||
              index === Math.floor(points.length / 2)
                ? formatShortDate(point.date)
                : "";
            return (
              <div
                key={point.date}
                className="group ml-1 flex h-full min-w-0 flex-1 flex-col justify-end first:ml-8"
                title={`${formatShortDate(point.date)}: ${formatCompact(point.totalCents)} (${point.orderCount} orders)`}
              >
                <div
                  className="flex w-full max-w-8 flex-col justify-end self-center overflow-hidden transition-opacity group-hover:opacity-80"
                  style={{ height: `${heightPct}%` }}
                >
                  {[...CHANNEL_STACK].reverse().map((channel) => {
                    const value = point[channel.key];
                    if (value <= 0) return null;
                    return (
                      <div
                        key={channel.key}
                        className="w-full"
                        style={{
                          backgroundColor: channel.color,
                          height: `${(value / Math.max(point.totalCents, 1)) * 100}%`,
                        }}
                      />
                    );
                  })}
                </div>
                <div className="mt-2 h-3 text-center font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                  {label}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function AdminSalesMarketingOverviewPanel({ onNavigateTab }: Props) {
  const defaults = useMemo(() => defaultDateRange(), []);
  const [paidFrom, setPaidFrom] = useState(defaults.from);
  const [paidTo, setPaidTo] = useState(defaults.to);
  const [currency, setCurrency] = useState("");
  const [grain, setGrain] = useState<SalesMarketingOverviewGrain>("week");
  const [overview, setOverview] = useState<SalesMarketingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSalesMarketingOverview({
        paidFrom: dateInputToStartIso(paidFrom),
        paidTo: dateInputToEndIso(paidTo),
        currency: currency || undefined,
        grain,
      });
      setOverview(response.data);
    } catch (loadError) {
      setOverview(null);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load sales and marketing data.",
      );
    } finally {
      setLoading(false);
    }
  }, [currency, grain, paidFrom, paidTo]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!actionsOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [actionsOpen]);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportSalesMarketingReport({
        section: "sales",
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
      setActionsOpen(false);
    }
  }

  function resetDateRange() {
    const next = defaultDateRange();
    setPaidFrom(next.from);
    setPaidTo(next.to);
    setCurrency("");
  }

  const summary = overview?.summary;
  const attribution = overview?.attribution;
  const isEmpty =
    !loading &&
    !error &&
    overview != null &&
    overview.summary.orderCount === 0 &&
    overview.summary.attributedRevenueCents === 0;

  const currencyOptions = useMemo(() => {
    const values = overview?.summary.currencies ?? [];
    const unique = Array.from(new Set(values.map((value) => value.toUpperCase())));
    return [
      { value: "", label: "All currencies" },
      ...unique.map((value) => ({ value, label: value })),
    ];
  }, [overview?.summary.currencies]);

  const maxProductNet = Math.max(1, ...(overview?.topProducts.map((p) => p.netCents) ?? [1]));
  const sparkPoints = overview?.revenueTrend.map((point) => point.totalCents) ?? [];
  const change = summary?.changePercent;

  if (loading && !overview) {
    return <OverviewLoadingSkeleton />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Sales &amp; Marketing
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-[var(--admin-on-surface-variant)]">
            Revenue by product, coupon performance, referral credit, and affiliate commission.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]">
            <CalendarDays className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
            <span className="sr-only">From</span>
            <input
              type="date"
              value={paidFrom}
              onChange={(event) => setPaidFrom(event.target.value)}
              className="bg-transparent outline-none"
            />
            <span className="text-[var(--admin-on-surface-variant)]">–</span>
            <span className="sr-only">To</span>
            <input
              type="date"
              value={paidTo}
              onChange={(event) => setPaidTo(event.target.value)}
              className="bg-transparent outline-none"
            />
          </label>

          <Select
            value={currency}
            onValueChange={setCurrency}
            options={currencyOptions}
            placeholder="Currency"
            ariaLabel="Currency"
            className="h-9 min-w-[110px]"
          />

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px disabled:opacity-50"
            onClick={() => void handleExport()}
            disabled={busy || loading}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>

          <div className="relative" ref={actionsRef}>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
              onClick={() => setActionsOpen((open) => !open)}
              aria-expanded={actionsOpen}
            >
              Cohort actions
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
            {actionsOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    setActionsOpen(false);
                    onNavigateTab("sales");
                  }}
                >
                  Message purchasers
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    setActionsOpen(false);
                    onNavigateTab("sales");
                  }}
                >
                  Create purchaser group
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    setActionsOpen(false);
                    onNavigateTab("affiliates");
                  }}
                >
                  Manage affiliates
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4 rounded border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--admin-danger)]" aria-hidden="true" />
              <div>
                <p className="text-sm text-[var(--admin-on-surface)]">
                  Couldn&apos;t load sales and marketing data.
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  {error}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded border border-[color-mix(in_srgb,var(--admin-danger)_35%,transparent)] px-3 text-xs text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] active:translate-y-px"
              onClick={() => void loadOverview()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
          <div className="pointer-events-none opacity-40">
            <OverviewLoadingSkeleton />
          </div>
        </div>
      ) : null}

      {!error && isEmpty ? (
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex items-end justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">Date range</span>
                <span className="inline-flex items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-sm">
                  <CalendarDays className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
                  {formatShortDate(`${paidFrom}T00:00:00.000Z`)} –{" "}
                  {formatShortDate(`${paidTo}T00:00:00.000Z`)}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="text-xs text-[var(--admin-primary-strong)] hover:underline"
              onClick={resetDateRange}
            >
              Reset filters
            </button>
          </div>
          <div className="relative flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--admin-primary)_8%,transparent),transparent_65%)]" />
            <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[var(--admin-primary-container)] opacity-50 blur-xl" />
              <Tag
                className="relative h-14 w-14 text-[var(--admin-on-surface-variant)]"
                strokeWidth={1.25}
                aria-hidden="true"
              />
            </div>
            <h2 className="relative text-base font-semibold text-[var(--admin-on-surface)]">
              No sales or marketing activity in this range
            </h2>
            <p className="relative mt-2 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
              There is currently no data for the selected filters. Try adjusting the date range or
              clearing the currency filter.
            </p>
            <button
              type="button"
              className="relative mt-8 inline-flex items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-6 py-2.5 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
              onClick={resetDateRange}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reset date range
            </button>
          </div>
        </div>
      ) : null}

      {!error && !isEmpty && overview && summary && attribution ? (
        <>
          {/* Revenue band — asymmetric bento */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="relative col-span-12 flex h-32 flex-col justify-between overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-4">
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[color-mix(in_srgb,var(--admin-primary-container)_50%,transparent)] to-transparent" />
              <svg
                className="absolute bottom-0 left-0 h-12 w-full text-[var(--admin-primary-strong)] opacity-20"
                viewBox="0 0 100 30"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d={sparklinePath(sparkPoints)} fill="currentColor" />
              </svg>
              <div className="relative z-10 flex items-start justify-between gap-2">
                <span className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Attributed revenue
                </span>
                {change != null ? (
                  <span
                    className={[
                      "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11px]",
                      change >= 0
                        ? "border-[color-mix(in_srgb,var(--admin-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] text-[var(--admin-success)]"
                        : "border-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] text-[var(--admin-danger)]",
                    ].join(" ")}
                  >
                    <TrendingUp className="mr-0.5 h-3 w-3" aria-hidden="true" />
                    {change >= 0 ? "+" : ""}
                    {change}%
                  </span>
                ) : null}
              </div>
              <div className="relative z-10 mt-auto flex items-baseline">
                <span className="mr-2 font-mono text-[32px] leading-none text-[var(--admin-on-surface)]">
                  {formatMoneyAmount(summary.attributedRevenueCents)}
                </span>
                <span className="text-xs text-[var(--admin-on-surface-variant)]">
                  {summary.currency}
                </span>
              </div>
            </div>

            <div className="col-span-12 flex flex-col divide-y divide-[var(--admin-border)] overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] sm:flex-row sm:divide-x sm:divide-y-0 md:col-span-8">
              <div className="flex flex-1 flex-col justify-between p-5">
                <span className="mb-2 text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Discount given
                </span>
                <div className="mt-auto flex items-baseline">
                  <span className="mr-1 font-mono text-sm text-[var(--admin-warning)]">
                    {formatMoneyAmount(summary.discountGivenCents)}
                  </span>
                  <span className="text-[11px] text-[var(--admin-on-surface-variant)]">
                    {summary.currency}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col justify-between p-5">
                <span className="mb-2 text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Commission earned
                </span>
                <div className="mt-auto flex items-baseline">
                  <span className="mr-1 font-mono text-sm text-[var(--admin-warning)]">
                    {formatMoneyAmount(summary.commissionEarnedCents)}
                  </span>
                  <span className="text-[11px] text-[var(--admin-on-surface-variant)]">
                    {summary.currency}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col justify-between p-5">
                <span className="mb-2 text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Referral credit
                </span>
                <div className="mt-auto flex items-baseline">
                  <span className="mr-1 font-mono text-sm text-[var(--admin-on-surface)]">
                    {summary.referralCredit.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-[var(--admin-on-surface-variant)]">credits</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col justify-between bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,transparent)] p-5">
                <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface)]">
                  Net to tenant
                </span>
                <div className="mt-auto flex items-baseline">
                  <span className="mr-1 font-mono text-lg text-[var(--admin-success)]">
                    {formatMoneyAmount(summary.netToTenantCents)}
                  </span>
                  <span className="text-[11px] text-[var(--admin-on-surface-variant)]">
                    {summary.currency}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-7">
              <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                <h2 className="mb-6 text-base font-semibold text-[var(--admin-on-surface)]">
                  Where revenue came from
                </h2>
                <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full">
                  {CHANNEL_STACK.map((channel) => {
                    const pct = attribution[channel.percentKey];
                    if (pct <= 0) return null;
                    return (
                      <div
                        key={channel.key}
                        className="h-full"
                        style={{ width: `${pct}%`, backgroundColor: channel.color }}
                        title={`${channel.label}: ${pct}%`}
                      />
                    );
                  })}
                  {CHANNEL_STACK.every((c) => attribution[c.percentKey] <= 0) ? (
                    <div className="h-full w-full bg-[var(--admin-surface-high)]" />
                  ) : null}
                </div>
                <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                  {CHANNEL_STACK.map((channel) => (
                    <div key={channel.key} className="flex items-center">
                      <div
                        className="mr-2 h-2 w-2 rounded-full"
                        style={{ backgroundColor: channel.color }}
                      />
                      <span className="mr-2 text-[var(--admin-on-surface)]">{channel.label}</span>
                      <span className="font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                        {attribution[channel.percentKey]}%
                      </span>
                    </div>
                  ))}
                </div>
                <AttributionChart points={overview.revenueTrend} grain={grain} onGrainChange={setGrain} />
              </section>

              <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Top products
                  </h2>
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--admin-primary)] hover:text-[var(--admin-primary-strong)]"
                    onClick={() => onNavigateTab("sales")}
                  >
                    View all
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[var(--admin-border)]">
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Product
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Purchasers
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Revenue
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Discount
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Net
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.topProducts.map((product, index) => {
                        const isLeader = index === 0;
                        return (
                          <tr
                            key={`${product.courseId ?? product.productTitle}-${index}`}
                            className={[
                              "border-b border-[var(--admin-border)] transition-colors last:border-b-0 hover:bg-[var(--admin-surface-high)]",
                              isLeader
                                ? "border-l-2 border-l-[var(--admin-primary-strong)] bg-[color-mix(in_srgb,var(--admin-primary-container)_30%,transparent)]"
                                : "",
                            ].join(" ")}
                          >
                            <td className="h-11 px-4 py-2">
                              <div className="flex items-center">
                                <span className="mr-2 max-w-[200px] truncate text-sm font-medium text-[var(--admin-on-surface)]">
                                  {product.productTitle}
                                </span>
                                <span className="inline-flex items-center rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--admin-on-surface-variant)]">
                                  {productTypeLabel(product.productType)}
                                </span>
                              </div>
                            </td>
                            <td className="h-11 px-4 py-2 text-right font-mono text-sm text-[var(--admin-on-surface)]">
                              {product.purchaserCount.toLocaleString()}
                            </td>
                            <td className="h-11 px-4 py-2 text-right font-mono text-sm text-[var(--admin-on-surface)]">
                              {formatMoneyAmount(product.revenueCents)}
                              <span className="ml-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                                {summary.currency}
                              </span>
                            </td>
                            <td className="h-11 px-4 py-2 text-right font-mono text-sm text-[var(--admin-warning)]">
                              {formatMoneyAmount(product.discountCents)}
                              <span className="ml-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                                {summary.currency}
                              </span>
                            </td>
                            <td className="h-11 px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span
                                  className={[
                                    "font-mono text-sm",
                                    isLeader
                                      ? "font-medium text-[var(--admin-success)]"
                                      : "text-[var(--admin-on-surface)]",
                                  ].join(" ")}
                                >
                                  {formatMoneyAmount(product.netCents)}
                                  <span className="ml-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                                    {summary.currency}
                                  </span>
                                </span>
                                <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.max(4, (product.netCents / maxProductNet) * 100)}%`,
                                      backgroundColor: isLeader
                                        ? "var(--admin-success)"
                                        : "var(--admin-primary-strong)",
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {overview.topProducts.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-8 text-center text-sm text-[var(--admin-on-surface-variant)]"
                          >
                            No products sold in this range.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="space-y-8 lg:col-span-5">
              <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Best-performing coupons
                  </h2>
                </div>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)]">
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Code
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Uses
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Generated
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.topCoupons.map((coupon) => (
                      <tr
                        key={coupon.id}
                        className="border-b border-[var(--admin-border)] transition-colors last:border-b-0 hover:bg-[var(--admin-surface-high)]"
                      >
                        <td className="h-11 px-4 py-1.5 font-mono text-sm font-medium text-[var(--admin-primary)]">
                          {coupon.code}
                        </td>
                        <td className="h-11 px-4 py-1.5 text-right font-mono text-sm text-[var(--admin-on-surface)]">
                          {coupon.uses.toLocaleString()}
                        </td>
                        <td className="h-11 px-4 py-1.5 text-right font-mono text-sm text-[var(--admin-on-surface)]">
                          {formatMoneyAmount(coupon.generatedCents)}
                          <span className="ml-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                            {summary.currency}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {overview.topCoupons.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-6 text-center text-sm text-[var(--admin-on-surface-variant)]"
                        >
                          No coupon redemptions in this range.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </section>

              <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Top affiliates
                  </h2>
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--admin-primary)] hover:text-[var(--admin-primary-strong)]"
                    onClick={() => onNavigateTab("affiliates")}
                  >
                    Manage
                  </button>
                </div>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)]">
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Affiliate
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Commission
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.topAffiliates.map((affiliate) => (
                      <tr
                        key={affiliate.affiliateId}
                        className="border-b border-[var(--admin-border)] transition-colors last:border-b-0 hover:bg-[var(--admin-surface-high)]"
                      >
                        <td className="h-11 px-4 py-2">
                          <div className="flex items-center">
                            <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--admin-surface-high)] text-[10px] font-bold text-[var(--admin-on-surface-variant)]">
                              {initials(affiliate.name)}
                            </div>
                            <span className="truncate text-sm text-[var(--admin-on-surface)]">
                              {affiliate.name}
                            </span>
                          </div>
                        </td>
                        <td className="h-11 px-4 py-2 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono text-sm text-[var(--admin-on-surface)]">
                              {formatMoneyAmount(affiliate.commissionCents)}
                              <span className="ml-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                                {summary.currency}
                              </span>
                            </span>
                            {affiliate.unpaidCents > 0 ? (
                              <span className="mt-0.5 flex items-center text-[10px] font-medium uppercase tracking-wider text-[var(--admin-warning)]">
                                <TriangleAlert className="mr-0.5 h-2.5 w-2.5" aria-hidden="true" />
                                Unpaid
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {overview.topAffiliates.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="p-6 text-center text-sm text-[var(--admin-on-surface-variant)]"
                        >
                          No affiliate commissions in this range.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </section>

              {overview.attention.length > 0 ? (
                <section className="relative overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[var(--admin-surface)] shadow-[0_2px_8px_color-mix(in_srgb,var(--admin-warning)_5%,transparent)]">
                  <div className="absolute bottom-0 left-0 top-0 w-1 bg-[color-mix(in_srgb,var(--admin-warning)_80%,transparent)]" />
                  <div className="flex items-center border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-warning)_5%,transparent)] p-4">
                    <AlertTriangle className="mr-2 h-5 w-5 text-[var(--admin-warning)]" aria-hidden="true" />
                    <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      Needs attention
                    </h2>
                  </div>
                  <div className="divide-y divide-[var(--admin-border)]">
                    {overview.attention.map((item) => (
                      <Link
                        key={item.key}
                        href={item.href}
                        className="group flex h-11 cursor-pointer items-center justify-between p-3 transition-colors hover:bg-[var(--admin-surface-high)]"
                      >
                        <span className="text-sm text-[var(--admin-on-surface)]">{item.label}</span>
                        <ChevronRight className="h-4 w-4 text-[var(--admin-on-surface-variant)] transition-colors group-hover:text-[var(--admin-primary)]" />
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
