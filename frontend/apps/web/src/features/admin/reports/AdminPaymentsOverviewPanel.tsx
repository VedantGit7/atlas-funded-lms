"use client";

import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  Plus,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  exportPaymentTransactions,
  fetchPaymentOverview,
  type PaymentOverview,
  type PaymentOverviewGrain,
  type PaymentTransactionItem,
} from "./admin-payments-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

type OverviewTabAction = "transactions" | "instalment" | "invoices";

type Props = {
  onNavigateTab: (tab: OverviewTabAction) => void;
  onRecordPayment: () => void;
};

const GRAIN_OPTIONS: Array<{ value: PaymentOverviewGrain; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const PRODUCT_STACK = [
  { key: "courseCents" as const, label: "Course", color: "var(--admin-primary)" },
  { key: "bundleCents" as const, label: "Bundle", color: "var(--admin-success)" },
  {
    key: "subscriptionCents" as const,
    label: "Subscription",
    color: "color-mix(in srgb, var(--admin-success) 70%, var(--admin-primary))",
  },
  {
    key: "liveClassCents" as const,
    label: "Live class",
    color: "var(--admin-lesson-live)",
  },
];

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatCompact(cents: number): string {
  const value = cents / 100;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTxDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: string): {
  className: string;
  icon: "check" | "sync" | "alert";
  title: string;
} {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "succeeded" || normalized === "success") {
    return {
      className:
        "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)] ring-[color-mix(in_srgb,var(--admin-success)_30%,transparent)]",
      icon: "check",
      title: "Success",
    };
  }
  if (normalized === "pending" || normalized === "processing" || normalized === "created") {
    return {
      className:
        "bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)] ring-[color-mix(in_srgb,var(--admin-warning)_30%,transparent)]",
      icon: "sync",
      title: "Processing",
    };
  }
  return {
    className:
      "bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)] ring-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)]",
    icon: "alert",
    title: status,
  };
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 34 * 24 * 60 * 60 * 1000);
  const toIso = to.toISOString().slice(0, 10);
  const fromIso = from.toISOString().slice(0, 10);
  return { from: fromIso, to: toIso };
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
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading payments overview">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Shimmer className="h-8 w-40" />
          <Shimmer className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-8 w-24" />
          <Shimmer className="h-8 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <Shimmer className="mb-2 h-4 w-1/2" />
            <Shimmer className="h-8 w-3/4" />
            <Shimmer className="mt-auto h-3 w-1/3" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)] xl:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <Shimmer className="h-5 w-32" />
            <Shimmer className="h-6 w-20" />
          </div>
          <div className="flex h-[300px] items-end gap-2 p-4 opacity-60">
            {[30, 50, 80, 40, 60, 90, 70, 100, 50, 30].map((height, index) => (
              <div
                key={index}
                className="relative w-full overflow-hidden rounded-t bg-[var(--admin-surface-high)] after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite] after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent"
                style={{ height: `${String(height)}%` }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <Shimmer className="h-5 w-40" />
          </div>
          <div className="flex flex-1 flex-col gap-4 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Shimmer className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Shimmer className="h-4 w-full" />
                  <Shimmer className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <Shimmer className="h-5 w-48" />
          <Shimmer className="h-8 w-24" />
        </div>
        <div className="divide-y divide-[var(--admin-border)]">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid grid-cols-5 gap-4 p-4 opacity-80">
              <Shimmer className="h-4 w-28" />
              <Shimmer className="h-4 w-36" />
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-6 w-16" />
              <Shimmer className="ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RevenueChart({
  points,
  grain,
  onGrainChange,
}: {
  points: PaymentOverview["revenueTrend"];
  grain: PaymentOverviewGrain;
  onGrainChange: (grain: PaymentOverviewGrain) => void;
}) {
  const maxTotal = Math.max(1, ...points.map((point) => point.totalCents));
  const maxOrders = Math.max(1, ...points.map((point) => point.orderCount));

  return (
    <div className="flex h-[400px] flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Revenue over time</h2>
        <div className="flex rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1">
          {GRAIN_OPTIONS.map((option) => {
            const active = grain === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={[
                  "rounded-sm px-3 py-1 font-mono text-xs transition-colors",
                  active
                    ? "bg-[var(--admin-surface-variant)] text-[var(--admin-on-surface)]"
                    : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
                onClick={() => {
                  onGrainChange(option.value);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 font-mono text-xs">
        {PRODUCT_STACK.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-[var(--admin-on-surface-variant)]">{item.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="h-0.5 w-4 bg-[var(--admin-outline)]" />
          <span className="text-[var(--admin-on-surface-variant)]">Order count</span>
        </div>
      </div>

      <div className="relative flex flex-1 items-end gap-1.5 border-b border-l border-[var(--admin-border)] px-2 pt-2">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="w-full border-t border-[var(--admin-border)] opacity-30" />
          ))}
        </div>
        {points.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-[var(--admin-on-surface-variant)]">
            No revenue in this range
          </div>
        ) : (
          points.map((point) => {
            const segments: Array<{ key: string; label: string; color: string; value: number }> =
              PRODUCT_STACK.map((stack) => ({
                ...stack,
                value: point[stack.key],
              })).filter((segment) => segment.value > 0);
            const other = point.otherCents;
            if (other > 0) {
              segments.push({
                key: "otherCents" as const,
                label: "Other",
                color: "var(--admin-outline)",
                value: other,
              });
            }
            const heightPct = Math.max(2, (point.totalCents / maxTotal) * 100);
            const orderY = 100 - (point.orderCount / maxOrders) * 100;
            return (
              <div
                key={point.date}
                className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
                title={`${formatShortDate(point.date)}: ${formatCompact(point.totalCents)} (${String(point.orderCount)} orders)`}
              >
                <div
                  className="absolute left-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 rounded-full border-2 border-[var(--admin-outline)] bg-[var(--admin-surface)]"
                  style={{ top: `${String(orderY)}%` }}
                />
                <div
                  className="flex w-full flex-col justify-end overflow-hidden rounded-t-sm transition-[filter] group-hover:brightness-110"
                  style={{ height: `${String(heightPct)}%` }}
                >
                  {segments.map((segment) => (
                    <div
                      key={segment.key}
                      className="w-full"
                      style={{
                        backgroundColor: segment.color,
                        height: `${String((segment.value / Math.max(point.totalCents, 1)) * 100)}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-2 flex justify-between px-2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
        {points.length <= 8
          ? points.map((point) => <span key={point.date}>{formatShortDate(point.date)}</span>)
          : [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]]
              .filter(Boolean)
              .map((point) => (
                <span key={defined(point).date}>{formatShortDate(defined(point).date)}</span>
              ))}
      </div>
    </div>
  );
}

function RecentTransactionsTable({
  items,
  currency,
  onViewAll,
}: {
  items: PaymentTransactionItem[];
  currency: string;
  onViewAll: () => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
        <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
          Recent transactions
        </h2>
        <button
          type="button"
          className="font-mono text-xs text-[var(--admin-primary)] hover:underline"
          onClick={onViewAll}
        >
          View all
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              <th className="p-4 font-normal">Learner</th>
              <th className="p-4 font-normal">Product</th>
              <th className="p-4 font-normal">Gateway</th>
              <th className="p-4 text-right font-normal">Amount</th>
              <th className="p-4 text-center font-normal">Status</th>
              <th className="p-4 text-right font-normal">Date</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {items.map((item) => {
              const tone = statusTone(item.status);
              return (
                <tr
                  key={item.id}
                  className="border-b border-[var(--admin-border)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_50%,transparent)]"
                >
                  <td className="p-4">
                    <div className="font-medium text-[var(--admin-on-surface)]">
                      {item.learnerName ?? "Learner"}
                    </div>
                    <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                      {item.email ?? "-"}
                    </div>
                  </td>
                  <td className="p-4 text-[var(--admin-on-surface-variant)]">
                    {item.productTitle ?? "-"}
                  </td>
                  <td className="p-4">
                    <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 font-mono text-xs">
                      {item.gatewayKey ?? "-"}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono text-[var(--admin-on-surface)]">
                    {(item.amountCents / 100).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full ring-1 ${tone.className}`}
                      title={tone.title}
                    >
                      {tone.icon === "check" ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : tone.icon === "sync" ? (
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono text-sm text-[var(--admin-on-surface-variant)]">
                    {formatTxDate(item.paidAt ?? item.createdAt)}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-sm text-[var(--admin-on-surface-variant)]"
                >
                  No recent transactions for {currency}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminPaymentsOverviewPanel({ onNavigateTab, onRecordPayment }: Props) {
  const defaults = useMemo(() => defaultDateRange(), []);
  const [paidFrom, setPaidFrom] = useState(defaults.from);
  const [paidTo, setPaidTo] = useState(defaults.to);
  const [currency, setCurrency] = useState<string>("");
  const [grain, setGrain] = useState<PaymentOverviewGrain>("day");
  const [overview, setOverview] = useState<PaymentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPaymentOverview({
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
            : "Couldn't load payment data.",
      );
    } finally {
      setLoading(false);
    }
  }, [currency, grain, paidFrom, paidTo]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportPaymentTransactions({
        paidFrom: dateInputToStartIso(paidFrom),
        paidTo: dateInputToEndIso(paidTo),
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status !== "completed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      await downloadReportExport(completed.id, "csv");
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export payments.",
      );
    } finally {
      setBusy(false);
    }
  }

  function resetDateRange() {
    const next = defaultDateRange();
    setPaidFrom(next.from);
    setPaidTo(next.to);
    setCurrency("");
  }

  const summary = overview?.summary;
  const isEmpty =
    !loading &&
    !error &&
    overview != null &&
    overview.summary.transactionCount === 0 &&
    overview.summary.collectedCents === 0;
  const dateLabel =
    paidFrom && paidTo
      ? `${formatShortDate(`${paidFrom}T00:00:00.000Z`)} – ${formatShortDate(`${paidTo}T00:00:00.000Z`)}`
      : (summary?.windowLabel ?? "Selected range");

  const currencyOptions = useMemo(() => {
    const values = overview?.summary.currencies ?? [];
    const unique = Array.from(new Set(values.map((value) => value.toUpperCase())));
    return [
      { value: "", label: "All currencies" },
      ...unique.map((value) => ({ value, label: value })),
    ];
  }, [overview?.summary.currencies]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <nav className="mb-2 flex items-center gap-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
            <span>Admin</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reports</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-[var(--admin-on-surface)]">Payments</span>
          </nav>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--admin-on-surface)] md:text-4xl">
            Payments
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Revenue, transactions, instalment plans, gateways, and invoices across the tenant.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-10 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs text-[var(--admin-on-surface)]">
            <CalendarDays
              className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <span className="sr-only">From</span>
            <input
              type="date"
              value={paidFrom}
              onChange={(event) => {
                setPaidFrom(event.target.value);
              }}
              className="bg-transparent outline-none"
            />
            <span className="text-[var(--admin-on-surface-variant)]">–</span>
            <span className="sr-only">To</span>
            <input
              type="date"
              value={paidTo}
              onChange={(event) => {
                setPaidTo(event.target.value);
              }}
              className="bg-transparent outline-none"
            />
          </label>

          <Select
            value={currency}
            onValueChange={setCurrency}
            options={currencyOptions}
            placeholder="All currencies"
            ariaLabel="Currency"
            className="h-10 min-w-[140px]"
          />

          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded border border-[var(--admin-primary)] bg-transparent px-4 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] disabled:opacity-50"
            onClick={() => void handleExport()}
            disabled={busy || loading}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>

          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded bg-[var(--admin-primary)] px-4 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary-strong)]"
            onClick={onRecordPayment}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Record payment
          </button>
        </div>
      </div>

      {error ? (
        <div className="relative flex items-center justify-between overflow-hidden rounded border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] p-4 shadow-[0_0_15px_color-mix(in_srgb,var(--admin-danger)_15%,transparent)]">
          <div className="relative z-10 flex items-center gap-4">
            <AlertTriangle className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-[var(--admin-danger)]">
                Couldn&apos;t load payment data.
              </h2>
              <p className="mt-1 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                {error} Check your connection or try again shortly.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="relative z-10 inline-flex items-center gap-2 rounded border border-[var(--admin-danger)] px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-danger)] transition-colors hover:bg-[var(--admin-danger)] hover:text-[var(--admin-on-danger)]"
            onClick={() => void loadOverview()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <OverviewLoadingSkeleton /> : null}

      {!loading && error ? (
        <div
          className="pointer-events-none grid grid-cols-1 gap-4 opacity-40 blur-[1px] md:grid-cols-3"
          aria-hidden="true"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col gap-4 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6"
            >
              <Shimmer className="h-4 w-1/2" />
              <Shimmer className="h-8 w-2/3" />
              <Shimmer className="mt-auto h-3 w-1/3" />
            </div>
          ))}
          <div className="min-h-[240px] rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 md:col-span-2">
            <Shimmer className="mb-4 h-6 w-48" />
            <div className="flex h-40 items-end gap-2">
              {[20, 40, 60, 30, 80, 50, 90].map((height, index) => (
                <div
                  key={index}
                  className="flex-1 animate-pulse rounded-t bg-[var(--admin-surface-high)]"
                  style={{ height: `${String(height)}%` }}
                />
              ))}
            </div>
          </div>
          <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="border-b border-[var(--admin-border)] p-4">
              <Shimmer className="h-5 w-32" />
            </div>
            <div className="space-y-4 p-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex gap-4">
                  <Shimmer className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Shimmer className="h-4 w-full" />
                    <Shimmer className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? (
        <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_80%,transparent)] p-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--admin-outline) 1px, transparent 1px), linear-gradient(to bottom, var(--admin-outline) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="relative z-10 mb-6 flex h-28 w-20 flex-col items-center rounded border-2 border-[var(--admin-outline)] bg-[var(--admin-surface)] p-3">
            <div className="mb-2 h-1 w-full rounded bg-[var(--admin-outline)] opacity-50" />
            <div className="mb-2 h-1 w-full rounded bg-[var(--admin-outline)] opacity-50" />
            <div className="mb-4 h-1 w-3/4 rounded bg-[var(--admin-outline)] opacity-50" />
            <div className="absolute -bottom-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--admin-outline)] bg-[var(--admin-bg)]">
              <span className="h-2 w-2 rounded-full bg-[var(--admin-outline)] opacity-50" />
            </div>
          </div>
          <h3 className="relative z-10 mb-2 text-center text-xl font-semibold text-[var(--admin-on-surface)]">
            No payments in this range
          </h3>
          <p className="relative z-10 mb-8 max-w-md text-center text-sm text-[var(--admin-on-surface-variant)]">
            Adjust your filters or date range to see transaction data for this period.
          </p>
          <button
            type="button"
            className="relative z-10 inline-flex items-center gap-2 rounded border border-[var(--admin-primary)] bg-[var(--admin-primary)] px-6 py-2 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary-strong)]"
            onClick={resetDateRange}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset date range
          </button>
        </div>
      ) : null}

      {!loading && !error && overview && !isEmpty ? (
        <>
          <div className="mb-0 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-[0_0_10px_color-mix(in_srgb,var(--admin-primary)_5%,transparent)]">
            <div className="flex flex-col xl:flex-row">
              <div className="relative overflow-hidden border-b border-[var(--admin-border)] p-6 xl:w-2/5 xl:border-b-0 xl:border-r">
                <div
                  className="pointer-events-none absolute inset-0 opacity-20"
                  style={{
                    background:
                      "linear-gradient(to top, color-mix(in srgb, var(--admin-primary) 35%, transparent) 0%, transparent 100%)",
                  }}
                />
                <div className="relative z-10">
                  <h2 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Collected this period
                  </h2>
                  <div className="mb-2 font-mono text-3xl font-bold text-[var(--admin-on-surface)]">
                    {formatMoney(defined(summary).collectedCents, defined(summary).currency)}
                  </div>
                  {defined(summary).changePercent != null ? (
                    <div className="inline-flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] px-2 py-1 font-mono text-xs text-[var(--admin-primary)]">
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {(defined(summary).changePercent ?? 0) >= 0 ? "+" : ""}
                        {defined(summary).changePercent ?? 0}% vs previous{" "}
                        {defined(summary).windowLabel}
                      </span>
                    </div>
                  ) : (
                    <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                      {dateLabel}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid flex-1 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:w-3/5">
                <div className="flex flex-col justify-between border-b border-[var(--admin-border)] p-6 md:border-r lg:border-b-0">
                  <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Transactions
                  </h3>
                  <div className="font-mono text-xl font-semibold text-[var(--admin-on-surface)]">
                    {defined(summary).transactionCount.toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-col justify-between border-b border-[var(--admin-border)] p-6 lg:border-b-0 lg:border-r">
                  <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Average order
                  </h3>
                  <div className="font-mono text-xl font-semibold text-[var(--admin-on-surface)]">
                    {formatMoney(defined(summary).averageOrderCents, defined(summary).currency)}
                  </div>
                </div>
                <div className="flex flex-col justify-between border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-warning)_5%,transparent)] p-6 md:border-r md:border-b-0">
                  <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-warning)]">
                    Outstanding inst.
                  </h3>
                  <div>
                    <div className="mb-1 font-mono text-xl font-semibold text-[var(--admin-warning)]">
                      {formatMoney(
                        defined(summary).outstandingInstalmentCents,
                        defined(summary).currency,
                      )}
                    </div>
                    <div className="font-mono text-xs text-[color-mix(in_srgb,var(--admin-warning)_70%,transparent)]">
                      {defined(summary).outstandingPlanCount} plans
                    </div>
                  </div>
                </div>
                <div className="flex flex-col justify-between bg-[color-mix(in_srgb,var(--admin-danger)_5%,transparent)] p-6">
                  <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-danger)]">
                    Failed
                  </h3>
                  <div>
                    <div className="mb-1 font-mono text-xl font-semibold text-[var(--admin-danger)]">
                      {defined(summary).failedCount}
                    </div>
                    <div className="font-mono text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,transparent)]">
                      {defined(summary).failedPercent}% of attempts
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
            <div className="flex flex-col gap-8 xl:col-span-7">
              <RevenueChart points={overview.revenueTrend} grain={grain} onGrainChange={setGrain} />
              <RecentTransactionsTable
                items={overview.recentTransactions}
                currency={defined(summary).currency}
                onViewAll={() => {
                  onNavigateTab("transactions");
                }}
              />
            </div>

            <div className="flex flex-col gap-8 xl:col-span-5">
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                <h2 className="mb-6 text-lg font-semibold text-[var(--admin-on-surface)]">
                  Revenue by gateway
                </h2>
                <div className="flex flex-col gap-4">
                  {overview.byGateway.length === 0 ? (
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      No gateway revenue in this range.
                    </p>
                  ) : (
                    overview.byGateway.map((gateway, index) => (
                      <div key={gateway.gatewayKey} className="flex items-center gap-4">
                        <div className="w-24 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-1 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--admin-on-surface)]">
                          {gateway.displayName.slice(0, 12)}
                        </div>
                        <div className="h-2 flex-grow overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${String(Math.max(gateway.percent, 2))}%`,
                              backgroundColor:
                                index === 0 ? "var(--admin-primary)" : "var(--admin-outline)",
                              opacity: index === 0 ? 1 : Math.max(0.45, 1 - index * 0.15),
                            }}
                          />
                        </div>
                        <div className="w-20 text-right font-mono text-sm font-medium text-[var(--admin-on-surface)]">
                          {formatCompact(gateway.amountCents)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                <h2 className="mb-4 text-lg font-semibold text-[var(--admin-on-surface)]">
                  Top products
                </h2>
                <div className="flex flex-col">
                  {overview.topProducts.length === 0 ? (
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      No products collected in this range.
                    </p>
                  ) : (
                    overview.topProducts.map((product, index) => (
                      <div
                        key={`${product.productTitle}-${String(index)}`}
                        className="-mx-6 flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_40%,transparent)]"
                      >
                        <div className="flex items-center gap-4">
                          <span
                            className={[
                              "w-6 text-center font-mono text-lg font-bold",
                              index === 0
                                ? "text-[var(--admin-primary)]"
                                : "text-[var(--admin-on-surface-variant)]",
                            ].join(" ")}
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="text-sm text-[var(--admin-on-surface)]">
                            {product.productTitle}
                          </span>
                        </div>
                        <span className="font-mono text-sm text-[var(--admin-on-surface-variant)]">
                          {formatCompact(product.amountCents)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] border-l-2 border-l-[var(--admin-warning)] bg-[var(--admin-surface)]">
                <div className="border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-warning)_5%,transparent)] p-4">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--admin-warning)]">
                    <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                    Needs attention
                  </h2>
                </div>
                <div className="flex flex-col divide-y divide-[var(--admin-border)]">
                  <button
                    type="button"
                    className="group flex items-center justify-between p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_40%,transparent)]"
                    onClick={() => {
                      onNavigateTab("invoices");
                    }}
                  >
                    <span className="text-sm text-[var(--admin-on-surface)]">
                      <span className="font-bold">{overview.attention.unsentInvoiceCount}</span>{" "}
                      invoices unsent
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--admin-on-surface-variant)] group-hover:text-[var(--admin-warning)]" />
                  </button>
                  <button
                    type="button"
                    className="group flex items-center justify-between p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_40%,transparent)]"
                    onClick={() => {
                      onNavigateTab("instalment");
                    }}
                  >
                    <span className="text-sm text-[var(--admin-on-surface)]">
                      <span className="font-bold text-[var(--admin-danger)]">
                        {overview.attention.overdueInstalmentCount}
                      </span>{" "}
                      instalments overdue
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--admin-on-surface-variant)] group-hover:text-[var(--admin-danger)]" />
                  </button>
                  <button
                    type="button"
                    className="group flex items-center justify-between p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_40%,transparent)]"
                    onClick={() => {
                      onNavigateTab("transactions");
                    }}
                  >
                    <span className="text-sm text-[var(--admin-on-surface)]">
                      <span className="font-bold text-[var(--admin-danger)]">
                        {overview.attention.failedPaymentCount}
                      </span>{" "}
                      failed payments
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--admin-on-surface-variant)] group-hover:text-[var(--admin-danger)]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
