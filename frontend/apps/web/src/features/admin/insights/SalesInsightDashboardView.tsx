"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  ChevronRight,
  Download,
  Eye,
  Info,
  LayoutGrid,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import {
  dropdownItemClassName,
  dropdownPanelSurfaceClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  ADMIN_INSIGHT_SECTIONS,
  ADMIN_INSIGHTS_HREF,
  adminInsightAlertsHref,
  adminInsightCustomizeHref,
  adminInsightDigestsHref,
  adminInsightHref,
  adminInsightLibraryHref,
  adminInsightSettingsHref,
} from "./admin-insights-catalog";
import type {
  InsightAlert,
  InsightDashboard,
  InsightDashboardRange,
  InsightLayout,
} from "./admin-insights-api";
import { dashboardDescription, dashboardToCsv, formatRelativeTime } from "./admin-insights-format";
import { applyInsightLayout } from "./admin-insights-layout";
import {
  INSIGHT_RANGE_OPTIONS,
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPrimaryButtonClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
} from "./admin-insights-shared";
import {
  SalesInsightChartGrid,
  SalesInsightKpiGroups,
  SalesInsightSkeleton,
} from "./SalesInsightWidgets";
import { SALES_FIXED_WINDOW_CAPTION, SALES_RANGE_SHORT_LABELS } from "./sales-insight-meta";

type SalesInsightDashboardViewProps = {
  slug: string;
  title: string;
  dashboard: InsightDashboard | null;
  loading: boolean;
  error: string | null;
  range: InsightDashboardRange;
  onRefresh: () => void;
  showLastUpdated?: boolean;
  hiddenSlugs?: string[];
  preview?: boolean;
  previewLayout?: InsightLayout | null;
  savingPreview?: boolean;
  onSavePreview?: (() => void) | undefined;
  onDiscardPreview?: (() => void) | undefined;
};

function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function alertTone(severity: InsightAlert["severity"]): {
  wrap: string;
  icon: string;
  title: string;
} {
  if (severity === "critical") {
    return {
      wrap: "border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))]",
      icon: "text-[var(--admin-danger)]",
      title: "text-[var(--admin-danger)]",
    };
  }
  if (severity === "warning") {
    return {
      wrap: "border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-warning)_15%,var(--admin-surface))]",
      icon: "text-[var(--admin-warning)]",
      title: "text-[var(--admin-warning)]",
    };
  }
  return {
    wrap: "border-[var(--admin-border)] bg-[var(--admin-surface-low)]",
    icon: "text-[var(--admin-on-surface-variant)]",
    title: "text-[var(--admin-on-surface)]",
  };
}

function AlertStack({ alerts, slug }: { alerts: InsightAlert[]; slug: string }) {
  if (alerts.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="Sales insight alerts">
      {alerts.map((alert) => {
        const tone = alertTone(alert.severity);
        const href = alert.href ?? adminInsightAlertsHref(slug);
        const clickable = Boolean(alert.href) && alert.severity !== "info";
        const icon =
          alert.severity === "critical" ? (
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : alert.severity === "warning" ? (
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <Info className="h-5 w-5 shrink-0" aria-hidden="true" />
          );
        const body = (
          <>
            <div className={`flex min-w-0 items-start gap-3 ${tone.icon}`}>
              {icon}
              <p className={`text-sm ${tone.title}`}>
                <span className="font-semibold">{alert.title}</span>
                <span className="opacity-90"> {alert.message}</span>
              </p>
            </div>
            {clickable ? (
              <ChevronRight
                className={`h-5 w-5 shrink-0 ${tone.icon} opacity-60`}
                aria-hidden="true"
              />
            ) : null}
          </>
        );
        if (!clickable) {
          return (
            <div
              key={alert.id}
              className={`flex items-start justify-between rounded-lg p-3 ${tone.wrap}`}
            >
              {body}
            </div>
          );
        }
        return (
          <Link
            key={alert.id}
            href={href}
            prefetch={false}
            className={`group flex items-start justify-between rounded-lg p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${tone.wrap}`}
          >
            {body}
          </Link>
        );
      })}
    </section>
  );
}

function DisabledRangeControl({ range }: { range: InsightDashboardRange }) {
  return (
    <div
      className={`${insightSegmentTrackClassName} cursor-not-allowed opacity-60`}
      role="radiogroup"
      aria-label="Date range"
      aria-disabled="true"
    >
      {INSIGHT_RANGE_OPTIONS.map((option) => {
        const active = option.value === range;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled
            className={active ? insightSegmentButtonActiveClassName : insightSegmentButtonClassName}
          >
            {SALES_RANGE_SHORT_LABELS[option.value]}
          </button>
        );
      })}
    </div>
  );
}

function MoreActions({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={insightGhostButtonClassName}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        More
      </button>
      {open ? (
        <div
          role="menu"
          className={`admin-theme admin-dropdown-panel absolute right-0 z-20 mt-2 w-48 ${dropdownPanelSurfaceClassName} motion-safe:origin-top bg-[var(--admin-surface)] p-1 shadow-lg`}
        >
          <Link
            href={adminInsightSettingsHref(slug)}
            prefetch={false}
            role="menuitem"
            className={dropdownItemClassName}
            onClick={() => {
              setOpen(false);
            }}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Settings
          </Link>
          <Link
            href={adminInsightLibraryHref(slug)}
            prefetch={false}
            role="menuitem"
            className={dropdownItemClassName}
            onClick={() => {
              setOpen(false);
            }}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            Library
          </Link>
          <Link
            href={adminInsightDigestsHref(slug)}
            prefetch={false}
            role="menuitem"
            className={dropdownItemClassName}
            onClick={() => {
              setOpen(false);
            }}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Digests
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ErrorStrip({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-6 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]">
        <AlertCircle className="h-6 w-6 text-[var(--admin-danger)]" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-danger)]">
        Data fetch failed for widgets
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">{message}</p>
      <button
        type="button"
        className={`${insightGhostButtonClassName} mt-6 border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-outline))] text-[var(--admin-danger)]`}
        onClick={onRetry}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Retry loading data
      </button>
    </div>
  );
}

function EmptyLayout({ slug }: { slug: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">No widgets to show</h3>
      <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
        Turn widgets back on from Customize, or wait for academy activity to populate this view.
      </p>
      <Link
        href={adminInsightCustomizeHref(slug)}
        prefetch={false}
        className={`${insightGhostButtonClassName} mt-6`}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Customize layout
      </Link>
    </div>
  );
}

export function SalesInsightDashboardView({
  slug,
  title,
  dashboard,
  loading,
  error,
  range,
  onRefresh,
  showLastUpdated = true,
  hiddenSlugs = [],
  preview = false,
  previewLayout = null,
  savingPreview = false,
  onSavePreview,
  onDiscardPreview,
}: SalesInsightDashboardViewProps) {
  const activeLayout = previewLayout ?? dashboard?.layout ?? null;

  const visibleWidgets = useMemo(() => {
    const widgets = dashboard?.widgets ?? [];
    if (activeLayout) return applyInsightLayout(widgets, activeLayout);
    return widgets;
  }, [activeLayout, dashboard?.widgets]);

  const kpiWidgets = visibleWidgets.filter((widget) => widget.defaultViz === "kpi");
  const chartWidgets = visibleWidgets.filter((widget) => widget.defaultViz !== "kpi");

  const showSkeleton = loading && !dashboard;
  const showPartialError = Boolean(error && dashboard);
  const showFullError = Boolean(error && !dashboard);
  const hasBody = Boolean(dashboard) && !showFullError;

  return (
    <div className={`${insightPageClassName} ${preview ? "pb-24" : ""}`}>
      <header className="flex flex-col justify-between gap-6 border-b border-[var(--admin-border)] pb-6 md:flex-row md:items-start">
        <div>
          <nav className={insightBreadcrumbClassName} aria-label="Breadcrumb">
            <Link href="/admin" prefetch={false} className="hover:text-[var(--admin-on-surface)]">
              Admin
            </Link>
            <span className="text-[var(--admin-outline)]" aria-hidden="true">
              /
            </span>
            <Link
              href={ADMIN_INSIGHTS_HREF}
              prefetch={false}
              className="hover:text-[var(--admin-on-surface)]"
            >
              Insights
            </Link>
            <span className="text-[var(--admin-outline)]" aria-hidden="true">
              /
            </span>
            <span className="font-medium text-[var(--admin-on-surface)]">{title}</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-primary)]">
            {title}
          </h1>
          <p className={insightPageDescClassName}>{dashboardDescription(slug)}</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 md:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DisabledRangeControl range={range} />
            <Link
              href={adminInsightCustomizeHref(slug)}
              prefetch={false}
              className={insightGhostButtonClassName}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Customize
            </Link>
            <button
              type="button"
              className={insightGhostButtonClassName}
              disabled={!dashboard}
              onClick={() => {
                if (!dashboard) return;
                downloadCsv(
                  `insights-${slug}.csv`,
                  dashboardToCsv(dashboard.title, dashboard.generatedAt, dashboard.widgets),
                );
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
            <Link
              href={adminInsightAlertsHref(slug)}
              prefetch={false}
              className={insightGhostButtonClassName}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              Alerts
              {dashboard && dashboard.alerts.length > 0 ? (
                <span className="rounded bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] px-1.5 py-0.5 font-data text-[11px] text-[var(--admin-danger)]">
                  {dashboard.alerts.length}
                </span>
              ) : null}
            </Link>
            <MoreActions slug={slug} />
            <button
              type="button"
              className={insightPrimaryButtonClassName}
              disabled={loading}
              onClick={onRefresh}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
          <div className="flex flex-col gap-0.5 md:items-end">
            <p className="max-w-md text-xs text-[var(--admin-on-surface-variant)] md:text-right">
              {SALES_FIXED_WINDOW_CAPTION}
            </p>
            {showLastUpdated ? (
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                {dashboard?.generatedAt
                  ? `Generated ${formatRelativeTime(dashboard.generatedAt)}`
                  : loading
                    ? "Fetching analytics..."
                    : " "}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <nav
        className="flex items-center gap-6 overflow-x-auto border-b border-[var(--admin-border)] md:gap-8"
        aria-label="Insight modules"
      >
        {ADMIN_INSIGHT_SECTIONS.filter((section) => !hiddenSlugs.includes(section.slug)).map(
          (section) => {
            const active = section.slug === slug;
            return (
              <Link
                key={section.slug}
                href={adminInsightHref(section.slug)}
                prefetch={false}
                className={
                  active
                    ? "-mb-px shrink-0 border-b-2 border-[var(--admin-primary)] pb-2 text-sm font-semibold text-[var(--admin-primary)]"
                    : "shrink-0 pb-2 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
                }
              >
                {section.label}
              </Link>
            );
          },
        )}
      </nav>

      {showSkeleton ? <SalesInsightSkeleton /> : null}

      {showFullError && error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}

      {hasBody && dashboard ? (
        <>
          <AlertStack alerts={dashboard.alerts} slug={slug} />

          {kpiWidgets.length > 0 ? (
            <SalesInsightKpiGroups widgets={kpiWidgets} slug={slug} currency={dashboard.currency} />
          ) : null}

          {showPartialError && error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}

          {!showPartialError && chartWidgets.length > 0 ? (
            <SalesInsightChartGrid
              widgets={chartWidgets}
              slug={slug}
              currency={dashboard.currency}
            />
          ) : null}

          {!loading && kpiWidgets.length === 0 && chartWidgets.length === 0 ? (
            <EmptyLayout slug={slug} />
          ) : null}
        </>
      ) : null}

      {preview ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-8 py-4">
          <div className="mx-auto flex max-w-[1440px] flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 text-base font-semibold text-[var(--admin-on-surface)]">
              <Eye className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
              Previewing unsaved layout
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={insightGhostButtonClassName}
                onClick={onDiscardPreview}
              >
                Discard
              </button>
              <button
                type="button"
                className={insightPrimaryButtonClassName}
                disabled={savingPreview}
                onClick={onSavePreview}
              >
                Save layout
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
