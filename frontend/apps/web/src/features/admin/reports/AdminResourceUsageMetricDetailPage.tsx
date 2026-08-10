"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Copy, Info, RefreshCw } from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchResourceUsageMetricDetail,
  type ResourceUsageMetricDetail,
} from "./admin-resource-usage-roster-api";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:-translate-x-full",
        "motion-safe:after:animate-[shimmer_1.8s_infinite]",
        "motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent",
        "motion-safe:after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] motion-safe:after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatValue(value: number, unit: string): string {
  if (unit === "GB" || unit === "h") {
    if (value < 0.01 && value > 0) return "<0.01";
    return value.toLocaleString(undefined, {
      minimumFractionDigits: value >= 100 ? 0 : 1,
      maximumFractionDigits: 2,
    });
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  return formatCount(value);
}

function formatUnitSuffix(unit: string): string {
  if (unit === "count" || unit === "USERS" || unit === "TOK") return "";
  if (unit === "GB") return " GB";
  if (unit === "h") return " h";
  return ` ${unit}`;
}

function formatPeriodLabel(period: string): string {
  const date = new Date(`${period}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 30) return `${String(days)} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]"
      : tone === "warning"
        ? "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]"
        : tone === "muted"
          ? "border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]"
          : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]";
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase ${toneClass}`}
    >
      {children}
    </span>
  );
}

function MetricLoadingSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[1200px] space-y-8 pb-16"
      aria-busy="true"
      aria-label="Loading metric"
    >
      <div className="space-y-3">
        <Shimmer className="h-4 w-28" />
        <Shimmer className="h-8 w-56" />
        <div className="flex gap-2">
          <Shimmer className="h-6 w-40" />
          <Shimmer className="h-6 w-16" />
          <Shimmer className="h-6 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="space-y-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6"
          >
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-9 w-28" />
            <Shimmer className="h-3 w-36" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-8">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <Shimmer className="h-5 w-40" />
          </div>
          <div className="relative flex h-[280px] items-end gap-2 px-8 py-8">
            {[20, 45, 30, 70, 55, 85, 60, 95].map((height, index) => (
              <div key={index} className="flex h-full flex-1 items-end">
                <Shimmer className="w-full max-w-8 rounded-t" />
                <span className="sr-only">{`${String(height)} percent placeholder`}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-4">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <Shimmer className="h-5 w-32" />
          </div>
          <div className="space-y-4 p-6">
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyMetricKey({ metricKey }: { metricKey: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)] transition-colors hover:border-[var(--admin-outline)] hover:text-[var(--admin-primary)]"
      onClick={() => {
        void navigator.clipboard.writeText(metricKey).then(() => {
          setCopied(true);
          window.setTimeout(() => {
            setCopied(false);
          }, 1500);
        });
      }}
      aria-label={`Copy metric key ${metricKey}`}
    >
      {metricKey}
      {copied ? (
        <Check className="h-3 w-3 text-[var(--admin-success)]" aria-hidden />
      ) : (
        <Copy className="h-3 w-3" aria-hidden />
      )}
    </button>
  );
}

function SeriesChart({
  series,
  unit,
  limit,
}: {
  series: ResourceUsageMetricDetail["series"];
  unit: string;
  limit: number | null;
}) {
  if (series.length === 0) return null;
  const maxValue = Math.max(limit ?? 0, ...series.map((point) => point.value), 1);
  const limitTop = limit != null ? Math.max(4, 100 - (limit / maxValue) * 100) : null;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Period trend</h3>
      </div>
      <div className="relative h-[280px] p-5 pl-10">
        <div className="pointer-events-none absolute top-5 left-2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
          {formatValue(maxValue, unit)}
        </div>
        <div className="pointer-events-none absolute bottom-12 left-2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
          0
        </div>
        <div className="relative h-[220px] border-b border-l border-[color-mix(in_srgb,var(--admin-border)_60%,transparent)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-[color-mix(in_srgb,var(--admin-border)_45%,transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-dashed border-[color-mix(in_srgb,var(--admin-border)_45%,transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-dashed border-[color-mix(in_srgb,var(--admin-border)_45%,transparent)]" />
          {limitTop != null ? (
            <div
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--admin-warning)]"
              style={{ top: `${String(limitTop)}%` }}
              title={`Plan limit ${formatValue(limit ?? 0, unit)}`}
            />
          ) : null}
          <div className="absolute inset-0 flex items-end justify-between gap-1 px-2 pt-4">
            {series.map((point, index) => {
              const height = Math.max(4, (point.value / maxValue) * 100);
              const isLatest = index === series.length - 1;
              return (
                <div
                  key={point.period}
                  className="group relative flex h-full flex-1 items-end justify-center"
                >
                  <div
                    className={[
                      "w-full max-w-8 rounded-t-sm transition-colors",
                      isLatest
                        ? "bg-[var(--admin-primary)]"
                        : "bg-[var(--admin-surface-high)] group-hover:bg-[var(--admin-outline)]",
                    ].join(" ")}
                    style={{ height: `${String(height)}%` }}
                    aria-label={`${formatPeriodLabel(point.period)}: ${formatValue(point.value, unit)}`}
                  />
                  <span className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[10px] whitespace-nowrap text-[var(--admin-on-surface)] opacity-0 transition-opacity group-hover:opacity-100">
                    {formatValue(point.value, unit)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
          {series.map((point, index) => (
            <span
              key={`${point.period}-label`}
              className={index === series.length - 1 ? "text-[var(--admin-on-surface)]" : undefined}
            >
              {formatPeriodLabel(point.period).split(" ")[0]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotMeteredBody({ data }: { data: ResourceUsageMetricDetail }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="flex flex-col gap-6 lg:col-span-8">
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <h2 className="mb-4 text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
            Total usage
          </h2>
          <p className="font-mono text-[28px] text-[var(--admin-on-surface)]">-</p>
          <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">Not metered yet</p>
        </div>
        <div className="rounded-lg border border-[var(--admin-border)] border-l-4 border-l-[var(--admin-outline)] bg-[var(--admin-surface-low)] p-6">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-outline)]" aria-hidden />
            <div>
              <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                This resource is not being measured on this account
              </h3>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">{data.definition}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="lg:col-span-4">
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex h-11 items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
            <h3 className="text-[11px] font-semibold tracking-wider text-[var(--admin-on-surface)] uppercase">
              Resource details
            </h3>
          </div>
          <div className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between border-b border-dashed border-[var(--admin-border)] py-2">
              <span className="text-xs text-[var(--admin-on-surface-variant)]">Identifier</span>
              <span className="rounded bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface)]">
                {data.metricKey}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-dashed border-[var(--admin-border)] py-2">
              <span className="text-xs text-[var(--admin-on-surface-variant)]">Category</span>
              <span className="text-sm text-[var(--admin-on-surface)]">{data.category}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-[var(--admin-on-surface-variant)]">Status</span>
              <StatusPill tone="muted">Not metered</StatusPill>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveOnlyBody({ data }: { data: ResourceUsageMetricDetail }) {
  return (
    <div className="max-w-3xl rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-8">
      <div className="flex flex-col gap-2 border-b border-[var(--admin-border)] pb-6">
        <span className="text-[11px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
          Live value
        </span>
        <p className="font-mono text-[32px] leading-tight tracking-tight text-[var(--admin-on-surface)]">
          {formatValue(data.currentValue ?? 0, data.unit)}
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
          <Info className="h-3.5 w-3.5" aria-hidden />
          This meter is read live and has no recorded history
        </p>
        {data.limit != null && data.limitPct != null ? (
          <div className="mt-3 space-y-1.5">
            <div className="h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
              <div
                className="h-full rounded-full bg-[var(--admin-primary)]"
                style={{ width: `${String(Math.min(100, data.limitPct))}%` }}
              />
            </div>
            <p className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
              of {formatValue(data.limit, data.unit)}
              {formatUnitSuffix(data.unit)} limit · {data.limitPct}%
            </p>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 pt-6 pb-2">
        <span className="text-[11px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
          Definition
        </span>
        <p className="max-w-xl text-sm leading-relaxed text-[var(--admin-on-surface)]">
          {data.definition}
        </p>
      </div>
      <div className="pt-4">
        <Link href="/admin/reports/resource-usage/history" className={secondaryButtonClassName}>
          View all metrics with history
        </Link>
      </div>
    </div>
  );
}

function MeteredBody({ data }: { data: ResourceUsageMetricDetail }) {
  const value = data.currentValue ?? 0;
  const unit = data.unit;

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] md:grid-cols-4 md:divide-x md:divide-y-0">
          <div className="bg-[var(--admin-surface-low)] p-6 md:col-span-2">
            <h2 className="mb-3 text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              Current
            </h2>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[28px] text-[var(--admin-on-surface)]">
                {formatValue(value, unit)}
              </span>
              {formatUnitSuffix(unit) ? (
                <span className="font-mono text-sm text-[var(--admin-on-surface-variant)]">
                  {formatUnitSuffix(unit).trim()}
                </span>
              ) : null}
            </div>
            {data.changeAbsolute != null ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px]",
                    data.changeAbsolute > 0
                      ? "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
                      : data.changeAbsolute < 0
                        ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
                        : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                  ].join(" ")}
                >
                  {data.changeAbsolute > 0 ? "+" : ""}
                  {formatValue(data.changeAbsolute, unit)}
                  {formatUnitSuffix(unit)}
                  {data.previousPeriodLabel ? ` vs ${data.previousPeriodLabel}` : ""}
                </span>
                {data.changePercent != null ? (
                  <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                    · {data.changePercent > 0 ? "+" : ""}
                    {data.changePercent}%
                  </span>
                ) : null}
              </div>
            ) : null}
            {data.limit != null && data.limitPct != null ? (
              <div className="mt-3 space-y-1.5">
                <div className="h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                  <div
                    className="h-full rounded-full bg-[var(--admin-primary)]"
                    style={{ width: `${String(Math.min(100, data.limitPct))}%` }}
                  />
                </div>
                <div className="flex justify-between font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                  <span>
                    of {formatValue(data.limit, unit)}
                    {formatUnitSuffix(unit)} limit
                  </span>
                  <span className="font-medium text-[var(--admin-primary)]">{data.limitPct}%</span>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col justify-between gap-3 p-6">
            <h2 className="text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              12-month change
            </h2>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[28px] text-[var(--admin-on-surface)]">
                {data.change12Month == null
                  ? "-"
                  : `${data.change12Month > 0 ? "+" : ""}${formatValue(data.change12Month, unit)}`}
              </span>
              {data.change12Month != null && formatUnitSuffix(unit) ? (
                <span className="font-mono text-sm text-[var(--admin-on-surface-variant)]">
                  {formatUnitSuffix(unit).trim()}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-3 p-6">
            <h2 className="text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              Avg monthly growth
            </h2>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[28px] text-[var(--admin-on-surface)]">
                {data.avgMonthlyGrowth == null
                  ? "-"
                  : `${data.avgMonthlyGrowth > 0 ? "+" : ""}${formatValue(data.avgMonthlyGrowth, unit)}`}
              </span>
              {data.avgMonthlyGrowth != null && formatUnitSuffix(unit) ? (
                <span className="font-mono text-sm text-[var(--admin-on-surface-variant)]">
                  {formatUnitSuffix(unit).trim()}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {data.projectedReachLimitLabel && data.limit != null ? (
          <div className="flex flex-col justify-between gap-2 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-warning)_6%,var(--admin-surface))] px-6 py-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-[var(--admin-warning)]">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              <span className="text-xs font-medium">
                Projected to reach {formatValue(data.limit, unit)}
                {formatUnitSuffix(unit)} in {data.projectedReachLimitLabel}
              </span>
            </div>
            <span className="text-xs text-[var(--admin-on-surface-variant)]">
              at the current rate
            </span>
          </div>
        ) : null}
        <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-2">
          <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
            Last calculated {formatRelative(data.calculatedAt)}
          </span>
        </div>
      </div>

      {data.series.length > 0 ? (
        <SeriesChart series={data.series} unit={unit} limit={data.limit} />
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <h3 className="mb-6 text-base font-semibold text-[var(--admin-on-surface)]">
              What makes up this figure
            </h3>
            {data.breakdown?.kind === "storage_assets" && data.breakdown.segments.length > 0 ? (
              <>
                <div className="mb-4 flex h-8 overflow-hidden rounded-sm border border-[var(--admin-border)]">
                  {data.breakdown.segments.map((segment, index) => (
                    <div
                      key={segment.key}
                      className="h-full"
                      style={{
                        width: `${String(segment.sharePct)}%`,
                        backgroundColor: `color-mix(in srgb, var(--admin-primary) ${String(Math.max(25, 100 - index * 12))}%, var(--admin-surface-high))`,
                      }}
                      title={`${segment.label}: ${formatValue(segment.value, unit)}`}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3">
                  {data.breakdown.segments.map((segment, index) => (
                    <div key={segment.key} className="flex items-start gap-2">
                      <div
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{
                          backgroundColor: `color-mix(in srgb, var(--admin-primary) ${String(Math.max(25, 100 - index * 12))}%, var(--admin-surface-high))`,
                        }}
                        aria-hidden
                      />
                      <div>
                        <p className="text-xs text-[var(--admin-on-surface-variant)]">
                          {segment.label}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface)]">
                          {formatValue(segment.value, unit)}
                          {formatUnitSuffix(unit)} · {segment.sharePct}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                {data.breakdown?.emptyMessage ??
                  "No composition breakdown is available for this metric."}
              </p>
            )}
          </div>

          {data.breakdown?.kind === "storage_assets" && data.breakdown.contributors.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Largest contributors (Top 10)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[11px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                      <th className="w-11 px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Course / Entity</th>
                      <th className="px-4 py-3 text-right font-semibold">Size</th>
                      <th className="px-4 py-3 text-right font-semibold">Last updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {data.breakdown.contributors.map((row, index) => (
                      <tr
                        key={row.id}
                        className="transition-colors hover:bg-[var(--admin-surface-low)]"
                      >
                        <td className="px-4 py-3 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--admin-on-surface)]">
                          {row.title}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-[var(--admin-on-surface)]">
                          {formatValue(row.value, row.unit)}
                          {formatUnitSuffix(row.unit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                          {formatDateShort(row.lastUpdatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
              <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Period record
              </h3>
              <Link
                href="/admin/reports/resource-usage/history"
                className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[11px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    <th className="px-4 py-2 font-semibold">Period</th>
                    <th className="px-4 py-2 text-right font-semibold">Value</th>
                    <th className="px-4 py-2 text-right font-semibold">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]">
                  {data.periods.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]"
                      >
                        No period snapshots yet.
                      </td>
                    </tr>
                  ) : (
                    data.periods.slice(0, 12).map((row) => (
                      <tr
                        key={row.period}
                        className="transition-colors hover:bg-[var(--admin-surface-low)]"
                      >
                        <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                          {formatPeriodLabel(row.period)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-[var(--admin-on-surface)]">
                          {formatValue(row.value, unit)}
                          {formatUnitSuffix(unit)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[11px]">
                          {row.changeAbsolute == null ? (
                            <span className="text-[var(--admin-on-surface-variant)]">-</span>
                          ) : (
                            <span
                              className={
                                row.changeAbsolute > 0
                                  ? "text-[var(--admin-warning)]"
                                  : row.changeAbsolute < 0
                                    ? "text-[var(--admin-success)]"
                                    : "text-[var(--admin-on-surface-variant)]"
                              }
                            >
                              {row.changeAbsolute > 0 ? "+" : ""}
                              {formatValue(row.changeAbsolute, unit)}
                              {formatUnitSuffix(unit)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
              <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Related</h3>
            </div>
            <div className="divide-y divide-[var(--admin-border)]">
              {data.related.map((item) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className="group flex items-center justify-between p-4 transition-colors hover:bg-[var(--admin-surface-low)]"
                >
                  <span className="text-sm text-[var(--admin-on-surface)]">{item.label}</span>
                  <ChevronRight
                    className="h-4 w-4 text-[var(--admin-outline)] transition-colors group-hover:text-[var(--admin-primary)]"
                    aria-hidden
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = {
  metricKey: string;
};

export function AdminResourceUsageMetricDetailPage({ metricKey }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResourceUsageMetricDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchResourceUsageMetricDetail(metricKey);
      setData(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Could not load metric detail.",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [metricKey]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <MetricLoadingSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-8 pb-16">
      <div className="space-y-4">
        <nav
          aria-label="Breadcrumb"
          className="text-[11px] tracking-wide text-[var(--admin-on-surface-variant)]"
        >
          <ol className="inline-flex flex-wrap items-center gap-1">
            <li>
              <Link href="/admin" prefetch={false} className="hover:text-[var(--admin-primary)]">
                Admin
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href="/admin/reports"
                prefetch={false}
                className="hover:text-[var(--admin-primary)]"
              >
                Reports
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href="/admin/reports/resource-usage"
                prefetch={false}
                className="hover:text-[var(--admin-primary)]"
              >
                Resource Usage
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-[var(--admin-on-surface)]" aria-current="page">
              {data?.metricLabel ?? "Metric"}
            </li>
          </ol>
        </nav>

        <Link
          href="/admin/reports/resource-usage"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--admin-primary)] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          All metrics
        </Link>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-3">
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--admin-on-surface)] md:text-[28px]">
              {data?.metricLabel ?? "Metric"}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <CopyMetricKey metricKey={metricKey} />
              {data ? (
                <>
                  <StatusPill>{data.unit}</StatusPill>
                  {data.cadence === "monthly" ? (
                    <StatusPill>Recorded monthly</StatusPill>
                  ) : data.cadence === "live" ? (
                    <StatusPill tone="success">Live</StatusPill>
                  ) : null}
                  {data.status === "metered" ? (
                    <StatusPill tone="success">Metered</StatusPill>
                  ) : data.status === "live" ? (
                    <StatusPill tone="success">Metered</StatusPill>
                  ) : (
                    <StatusPill tone="muted">Not metered yet</StatusPill>
                  )}
                </>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={loading}
            onClick={() => {
              void load();
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-col items-start justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
              aria-hidden
            />
            <div>
              <p className="text-sm font-semibold text-[var(--admin-danger)]">
                Could not load metric detail.
              </p>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
            </div>
          </div>
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              void load();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
      ) : null}

      {data && !error ? (
        data.status === "not_metered" ? (
          <NotMeteredBody data={data} />
        ) : data.status === "live" ? (
          <LiveOnlyBody data={data} />
        ) : (
          <MeteredBody data={data} />
        )
      ) : null}
    </div>
  );
}
