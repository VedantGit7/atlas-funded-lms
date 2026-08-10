"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Download,
  HardDrive,
  MessageSquare,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserX,
  Users,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  RESOURCE_USAGE_PERIOD_OPTIONS,
  fetchResourceUsageOverview,
  type ResourceUsageOverview,
  type ResourceUsagePeriod,
} from "./admin-resource-usage-roster-api";
import { AdminResourceUsageHistoryPanel } from "./AdminResourceUsageHistoryPanel";
import { AdminResourceUsageStoragePanel } from "./AdminResourceUsageStoragePanel";
import { AdminResourceUsageDormantPanel } from "./AdminResourceUsageDormantPanel";
import { AdminResourceUsageInactivePanel } from "./AdminResourceUsageInactivePanel";
import { AdminResourceUsageExportsPanel } from "./AdminResourceUsageExportsPanel";

type Tab = "overview" | "history" | "storage" | "dormant" | "inactive" | "exports";

const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 text-sm font-medium text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

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

function formatGb(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (value < 0.01 && value > 0) return "<0.01";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value >= 100 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return formatCount(value);
}

function sparklinePath(points: number[]): string {
  if (points.length === 0) return "M0,25 L100,25";
  const max = Math.max(1, ...points);
  const min = Math.min(0, ...points);
  const range = Math.max(0.01, max - min);
  const step = points.length === 1 ? 0 : 100 / (points.length - 1);
  return points
    .map((value, index) => {
      const x = points.length === 1 ? 50 : index * step;
      const y = 28 - ((value - min) / range) * 24;
      return `${index === 0 ? "M" : "L"}${String(x)},${String(y)}`;
    })
    .join(" ");
}

function downloadOverviewCsv(overview: ResourceUsageOverview) {
  const { meters, optimization, limits, trends } = overview;
  const rows: Array<[string, string]> = [
    ["Storage (GB)", String(meters.storageGb)],
    ["Storage quota (GB)", limits.storageGb == null ? "Unlimited" : String(limits.storageGb)],
    ["Storage delta (GB)", String(trends.storageDeltaGb)],
    ["Active users (30d)", String(meters.activeUsers30d)],
    ["Current MAU", String(meters.currentMau)],
    ["MAU limit", limits.mau == null ? "Unlimited" : String(limits.mau)],
    ["Total learners", String(meters.totalLearners)],
    ["Tests taken", String(meters.testSubmits)],
    ["Products", String(meters.products)],
    ["Questions", String(meters.questions)],
    ["Message sends", String(meters.messageSends)],
    ["Dormant courses", String(optimization.dormantContentCount)],
    ["Dormant storage (GB)", String(optimization.dormantStorageGb)],
    ["Inactive learners", String(optimization.inactiveLearnerCount)],
  ];
  const csv = ["Metric,Value", ...rows.map(([k, v]) => `"${k}",${v}`)].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `resource-usage-overview-${overview.period}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function OverviewLoadingSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading resource usage">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-2">
          <Shimmer className="h-3 w-40" />
          <Shimmer className="h-9 w-56" />
          <Shimmer className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-40" />
        </div>
      </div>

      <div className="flex gap-6 border-b border-[var(--admin-border)] pb-0">
        {Array.from({ length: 6 }).map((_, index) => (
          <Shimmer key={index} className="mb-3 h-4 w-20" />
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] md:grid-cols-3 md:divide-x md:divide-y-0">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-3 p-6">
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-8 w-32" />
              <Shimmer className="h-3 w-28" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="col-span-full space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-6">
          <Shimmer className="h-4 w-28" />
          <Shimmer className="h-7 w-40" />
          <Shimmer className="h-2 w-full rounded-full" />
        </div>
        <div className="col-span-full space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-6">
          <Shimmer className="mb-2 h-4 w-44" />
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between py-2">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-4 w-16" />
            </div>
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="col-span-full space-y-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-3"
          >
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-7 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyOverview({ onInvite }: { onInvite: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="col-span-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 md:col-span-2">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Current utilization
          </h3>
          <span className="rounded-sm bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            Live
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: Users, label: "Active seats" },
            { icon: HardDrive, label: "Storage used" },
            { icon: MessageSquare, label: "Message sends" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6"
            >
              <Icon className="mb-2 h-6 w-6 text-[var(--admin-outline)]" aria-hidden />
              <span className="font-mono text-3xl text-[var(--admin-outline)]">-</span>
              <span className="mt-2 text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                {label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-[var(--admin-on-surface-variant)]">
          No usage recorded yet
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
          <Sparkles className="h-6 w-6 text-[var(--admin-on-surface-variant)]" aria-hidden />
        </div>
        <h3 className="mb-1 text-lg font-semibold tracking-tight text-[var(--admin-on-surface)]">
          Reclaim resources
        </h3>
        <p className="mb-4 text-sm text-[var(--admin-on-surface-variant)]">
          Free up inactive seats once learners start joining.
        </p>
        <div className="flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
          <p className="font-mono text-sm text-[var(--admin-outline)]">Nothing to reclaim yet</p>
        </div>
        <button type="button" className={`${secondaryButtonClassName} mt-4`} onClick={onInvite}>
          Invite users
        </button>
      </div>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4 sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-2 text-sm text-[var(--admin-on-surface)]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]" aria-hidden />
        <span>{message}</span>
      </div>
      <button type="button" className={secondaryButtonClassName} onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Retry
      </button>
    </div>
  );
}

function StorageSparkline({ points }: { points: number[] }) {
  const path = useMemo(() => sparklinePath(points), [points]);
  return (
    <svg className="h-8 w-24 opacity-70" viewBox="0 0 100 30" aria-hidden>
      <path
        d={path}
        fill="none"
        stroke="var(--admin-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AdminResourceUsageRosterPage() {
  const router = useRouter();
  const pathname = usePathname();
  const initialTab: Tab = pathname.endsWith("/resource-usage/history")
    ? "history"
    : pathname.endsWith("/resource-usage/storage")
      ? "storage"
      : pathname.endsWith("/resource-usage/dormant")
        ? "dormant"
        : pathname.endsWith("/resource-usage/inactive-learners")
          ? "inactive"
          : pathname.endsWith("/resource-usage/exports")
            ? "exports"
            : "overview";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [period, setPeriod] = useState<ResourceUsagePeriod>("this_month");
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staleHint, setStaleHint] = useState(false);

  const [overview, setOverview] = useState<ResourceUsageOverview | null>(null);
  const overviewRef = useRef<ResourceUsageOverview | null>(null);

  useEffect(() => {
    overviewRef.current = overview;
  }, [overview]);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setError(null);
    setStaleHint(false);
    try {
      const response = await fetchResourceUsageOverview(period);
      setOverview(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Could not load usage meters. The service might be temporarily unavailable.",
      );
      if (overviewRef.current) {
        setStaleHint(true);
      } else {
        setOverview(null);
      }
    } finally {
      setOverviewLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (pathname.endsWith("/resource-usage/history")) {
      setTab("history");
    } else if (pathname.endsWith("/resource-usage/storage")) {
      setTab("storage");
    } else if (pathname.endsWith("/resource-usage/dormant")) {
      setTab("dormant");
    } else if (pathname.endsWith("/resource-usage/inactive-learners")) {
      setTab("inactive");
    } else if (pathname.endsWith("/resource-usage/exports")) {
      setTab("exports");
    } else if (pathname.endsWith("/resource-usage") || pathname.endsWith("/resource-usage/")) {
      setTab((current) =>
        current === "history" ||
        current === "storage" ||
        current === "dormant" ||
        current === "inactive" ||
        current === "exports"
          ? "overview"
          : current,
      );
    }
  }, [pathname]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  function switchTab(next: Tab) {
    setTab(next);
    setError(null);
    const href =
      next === "history"
        ? "/admin/reports/resource-usage/history"
        : next === "storage"
          ? "/admin/reports/resource-usage/storage"
          : next === "dormant"
            ? "/admin/reports/resource-usage/dormant"
            : next === "inactive"
              ? "/admin/reports/resource-usage/inactive-learners"
              : next === "exports"
                ? "/admin/reports/resource-usage/exports"
                : "/admin/reports/resource-usage";
    router.replace(href, { scroll: false });
  }

  const meters = overview?.meters;
  const optimization = overview?.optimization;
  const limits = overview?.limits;
  const trends = overview?.trends;
  const storageQuota = limits?.storageGb ?? null;
  const storagePct =
    storageQuota != null && storageQuota > 0 && meters
      ? Math.min(100, (meters.storageGb / storageQuota) * 100)
      : null;

  const tabs: Array<{
    key: Tab;
    label: string;
    badge?: number;
  }> = [
    { key: "overview", label: "Overview" },
    { key: "history", label: "History" },
    { key: "storage", label: "Storage" },
    {
      key: "dormant",
      label: "Dormant content",
      ...(optimization?.dormantContentCount != null
        ? { badge: optimization.dormantContentCount }
        : {}),
    },
    {
      key: "inactive",
      label: "Inactive learners",
      ...(optimization?.inactiveLearnerCount != null
        ? { badge: optimization.inactiveLearnerCount }
        : {}),
    },
    { key: "exports", label: "Exports" },
  ];

  const showOverviewChrome = tab === "overview";
  const hidePageChrome =
    tab === "history" ||
    tab === "storage" ||
    tab === "dormant" ||
    tab === "inactive" ||
    tab === "exports";

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-8 pb-16">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <nav
            aria-label="Breadcrumb"
            className="mb-2 text-[11px] tracking-wide text-[var(--admin-on-surface-variant)]"
          >
            <ol className="inline-flex items-center gap-1">
              <li>
                <Link
                  href="/admin"
                  prefetch={false}
                  className="transition-colors hover:text-[var(--admin-primary)]"
                >
                  Admin
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href="/admin/reports"
                  prefetch={false}
                  className="transition-colors hover:text-[var(--admin-primary)]"
                >
                  Reports
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                {hidePageChrome ? (
                  <Link
                    href="/admin/reports/resource-usage"
                    prefetch={false}
                    className="transition-colors hover:text-[var(--admin-primary)]"
                  >
                    Resource Usage
                  </Link>
                ) : (
                  <span className="text-[var(--admin-on-surface)]" aria-current="page">
                    Resource Usage
                  </span>
                )}
              </li>
              {tab === "history" ? (
                <>
                  <li aria-hidden>/</li>
                  <li className="text-[var(--admin-on-surface)]" aria-current="page">
                    History
                  </li>
                </>
              ) : null}
              {tab === "storage" ? (
                <>
                  <li aria-hidden>/</li>
                  <li className="text-[var(--admin-on-surface)]" aria-current="page">
                    Storage
                  </li>
                </>
              ) : null}
              {tab === "dormant" ? (
                <>
                  <li aria-hidden>/</li>
                  <li className="text-[var(--admin-on-surface)]" aria-current="page">
                    Dormant content
                  </li>
                </>
              ) : null}
              {tab === "inactive" ? (
                <>
                  <li aria-hidden>/</li>
                  <li className="text-[var(--admin-on-surface)]" aria-current="page">
                    Inactive learners
                  </li>
                </>
              ) : null}
              {tab === "exports" ? (
                <>
                  <li aria-hidden>/</li>
                  <li className="text-[var(--admin-on-surface)]" aria-current="page">
                    Exports
                  </li>
                </>
              ) : null}
            </ol>
          </nav>
          {!hidePageChrome ? (
            <>
              <h1 className="text-[28px] font-semibold tracking-tight text-[var(--admin-on-surface)] md:text-[32px]">
                Resource Usage
              </h1>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                What this account is consuming across storage, seats, and activity.
              </p>
              {staleHint ? (
                <p className="mt-1 text-xs text-[var(--admin-warning)]">
                  Showing last successful load. Fresh meters could not be fetched.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!hidePageChrome ? (
            <>
              <Select
                ariaLabel="Usage period"
                className={selectClassName}
                value={period}
                onValueChange={(value) => {
                  setPeriod(value as ResourceUsagePeriod);
                }}
                options={RESOURCE_USAGE_PERIOD_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={!overview}
                onClick={() => {
                  if (overview) {
                    downloadOverviewCsv(overview);
                  }
                }}
              >
                <Download className="h-4 w-4" aria-hidden />
                Export CSV
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                onClick={() => {
                  switchTab("dormant");
                }}
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                Review reclaimable
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error && !hidePageChrome ? (
        <ErrorBanner
          message={error}
          onRetry={() => {
            void loadOverview();
          }}
        />
      ) : null}

      <div className="border-b border-[var(--admin-border)]">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Resource usage sections">
          {tabs.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  switchTab(item.key);
                }}
                className={[
                  "inline-flex shrink-0 items-center gap-2 border-b-2 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                    : "border-transparent text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-outline)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
              >
                {item.label}
                {typeof item.badge === "number" ? (
                  <span className="rounded bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface)]">
                    {formatCount(item.badge)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === "history" ? <AdminResourceUsageHistoryPanel /> : null}
      {tab === "storage" ? <AdminResourceUsageStoragePanel /> : null}
      {tab === "dormant" ? <AdminResourceUsageDormantPanel /> : null}
      {tab === "inactive" ? <AdminResourceUsageInactivePanel /> : null}
      {tab === "exports" ? <AdminResourceUsageExportsPanel /> : null}

      {showOverviewChrome ? (
        overviewLoading && !overview ? (
          <OverviewLoadingSkeleton />
        ) : overview?.isEmpty ? (
          <EmptyOverview
            onInvite={() => {
              switchTab("inactive");
            }}
          />
        ) : overview && meters && optimization && trends ? (
          <div className={["space-y-6", error && staleHint ? "opacity-60" : ""].join(" ")}>
            <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <div className="grid grid-cols-1 md:grid-cols-3">
                <div className="relative border-b border-[var(--admin-border)] p-6 md:border-r md:border-b-0">
                  <Link
                    href="/admin/reports/resource-usage/metrics/usage.storage_gb"
                    prefetch={false}
                    className="block transition-opacity hover:opacity-90"
                  >
                    <h3 className="mb-2 text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                      Total storage
                    </h3>
                    <p className="font-mono text-[32px] leading-none font-bold text-[var(--admin-on-surface)]">
                      {formatGb(meters.storageGb)}{" "}
                      <span className="text-base font-normal text-[var(--admin-on-surface-variant)]">
                        GB
                      </span>
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 font-mono text-[12px] text-[var(--admin-primary)]">
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                      {trends.storageDeltaGb >= 0 ? "+" : ""}
                      {formatGb(trends.storageDeltaGb)} GB delta
                    </div>
                  </Link>
                  <div className="absolute right-6 bottom-6">
                    <StorageSparkline points={trends.storageSparkline} />
                  </div>
                </div>

                <div className="border-b border-[var(--admin-border)] p-6 md:border-r md:border-b-0">
                  <Link
                    href="/admin/reports/resource-usage/metrics/usage.total_learners"
                    prefetch={false}
                    className="block transition-opacity hover:opacity-90"
                  >
                    <h3 className="mb-2 text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                      Total learners
                    </h3>
                    <p className="font-mono text-[32px] leading-none font-bold text-[var(--admin-on-surface)]">
                      {formatCount(meters.totalLearners)}
                    </p>
                    <p className="mt-2 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                      <span className="font-medium text-[var(--admin-success)]">
                        {formatCount(meters.activeUsers30d)}
                      </span>{" "}
                      active currently
                    </p>
                  </Link>
                </div>

                <div className="bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-6">
                  <h3 className="mb-2 flex items-center gap-2 text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Reclaimable
                    {optimization.dormantStorageGb > 0 ? (
                      <AlertTriangle
                        className="h-3.5 w-3.5 text-[var(--admin-warning)]"
                        aria-hidden
                      />
                    ) : null}
                  </h3>
                  <p className="font-mono text-[32px] leading-none font-bold text-[var(--admin-warning)]">
                    {formatGb(optimization.dormantStorageGb)}{" "}
                    <span className="text-base font-normal opacity-80">GB</span>
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                      across {formatCount(optimization.dormantContentCount)} dormant courses
                    </span>
                    <button
                      type="button"
                      className="text-[11px] font-medium tracking-wider text-[var(--admin-warning)] uppercase transition-colors hover:opacity-80"
                      onClick={() => {
                        switchTab("dormant");
                      }}
                    >
                      Review
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="col-span-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 transition-colors hover:border-[var(--admin-outline)] md:col-span-6">
                <div className="mb-4 flex items-start justify-between">
                  <h4 className="text-sm font-medium text-[var(--admin-on-surface)]">
                    Storage quota
                  </h4>
                  <HardDrive
                    className="h-5 w-5 text-[var(--admin-on-surface-variant)]"
                    aria-hidden
                  />
                </div>
                <div className="mb-2 flex items-end justify-between font-mono">
                  <span className="text-2xl leading-none text-[var(--admin-on-surface)]">
                    {formatGb(meters.storageGb)}{" "}
                    <span className="text-sm text-[var(--admin-on-surface-variant)]">
                      / {storageQuota == null ? "Unlimited" : `${formatGb(storageQuota)} GB`}
                    </span>
                  </span>
                  <span className="text-sm text-[var(--admin-on-surface)]">
                    {storagePct == null ? "-" : `${storagePct.toFixed(1)}%`}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                  <div
                    className={[
                      "h-full rounded-full transition-[width] duration-500",
                      storagePct != null && storagePct >= 90
                        ? "bg-[var(--admin-danger)]"
                        : storagePct != null && storagePct >= 75
                          ? "bg-[var(--admin-warning)]"
                          : "bg-[var(--admin-primary)]",
                    ].join(" ")}
                    style={{ width: `${String(storagePct ?? 0)}%` }}
                  />
                </div>
              </div>

              <div className="col-span-full flex flex-col justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-6">
                <h4 className="mb-4 text-sm font-medium text-[var(--admin-on-surface)]">
                  Optimization opportunities
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--admin-border)_70%,transparent)] pb-2">
                    <div className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
                      <HardDrive
                        className="h-[18px] w-[18px] text-[var(--admin-warning)]"
                        aria-hidden
                      />
                      Storage dormant
                    </div>
                    <span className="font-mono text-[var(--admin-warning)]">
                      {formatGb(optimization.dormantStorageGb)} GB
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--admin-border)_70%,transparent)] pb-2">
                    <div className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
                      <UserX
                        className="h-[18px] w-[18px] text-[var(--admin-warning)]"
                        aria-hidden
                      />
                      Inactive learners
                    </div>
                    <span className="font-mono text-[var(--admin-warning)]">
                      {formatCount(optimization.inactiveLearnerCount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
                      <BookOpen
                        className="h-[18px] w-[18px] text-[var(--admin-warning)]"
                        aria-hidden
                      />
                      Dormant courses
                    </div>
                    <span className="font-mono text-[var(--admin-warning)]">
                      {formatCount(optimization.dormantContentCount)}
                    </span>
                  </div>
                </div>
              </div>

              {[
                {
                  label: "Active users (30d)",
                  value: formatCount(meters.activeUsers30d),
                  href: "/admin/reports/resource-usage/metrics/usage.active_users_30d",
                },
                {
                  label: "Current MAU",
                  value: formatCount(meters.currentMau),
                  href: "/admin/reports/resource-usage/metrics/usage.current_mau",
                },
                {
                  label: "Tests taken",
                  value: formatCount(meters.testSubmits),
                  href: "/admin/reports/resource-usage/metrics/usage.test_submits",
                },
                {
                  label: "Message sends",
                  value: formatCompact(meters.messageSends),
                  href: "/admin/reports/resource-usage/metrics/usage.message_sends",
                },
              ].map((card) => (
                <Link
                  key={card.label}
                  href={card.href}
                  prefetch={false}
                  className="col-span-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 transition-colors hover:border-[var(--admin-outline)] md:col-span-3"
                >
                  <h4 className="mb-2 text-sm font-medium text-[var(--admin-on-surface-variant)]">
                    {card.label}
                  </h4>
                  <p className="font-mono text-2xl text-[var(--admin-on-surface)]">{card.value}</p>
                </Link>
              ))}

              <div className="col-span-full mt-2 mb-1">
                <h2 className="border-b border-[var(--admin-border)] pb-2 text-xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
                  Not measured on this plan
                </h2>
              </div>

              {[
                {
                  label: "Bandwidth",
                  metered: overview.notes.bandwidthMetered,
                  value: `${formatGb(meters.bandwidthGb)} GB`,
                  href: "/admin/reports/resource-usage/metrics/usage.bandwidth_gb",
                },
                {
                  label: "DRM tokens",
                  metered: overview.notes.drmMetered,
                  value: formatCount(meters.drmTokens),
                  href: "/admin/reports/resource-usage/metrics/usage.drm_tokens",
                },
                {
                  label: "Video transcoding",
                  metered: overview.notes.videoHoursMetered,
                  value: `${meters.videoTranscodingHours.toFixed(1)} h`,
                  href: "/admin/reports/resource-usage/metrics/usage.video_transcoding_hours",
                },
              ].map((card) => (
                <Link
                  key={card.label}
                  href={card.href}
                  prefetch={false}
                  className="col-span-full rounded-lg border border-[color-mix(in_srgb,var(--admin-border)_60%,transparent)] bg-[var(--admin-surface-low)] p-5 opacity-70 transition-opacity hover:opacity-100 md:col-span-4"
                >
                  <h4 className="mb-2 text-sm font-medium text-[var(--admin-on-surface-variant)]">
                    {card.label}
                  </h4>
                  <p className="font-mono text-2xl text-[var(--admin-on-surface-variant)]">
                    {card.metered ? card.value : "-"}
                  </p>
                  <p className="mt-2 text-[11px] tracking-wide text-[var(--admin-on-surface-variant)]">
                    Not metered yet
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <EmptyOverview
            onInvite={() => {
              switchTab("inactive");
            }}
          />
        )
      ) : null}
    </div>
  );
}
