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
  InsightWidget,
} from "./admin-insights-api";
import { dashboardDescription, dashboardToCsv, formatRelativeTime } from "./admin-insights-format";
import { applyInsightLayout } from "./admin-insights-layout";
import {
  INSIGHT_RANGE_OPTIONS,
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPrimaryButtonClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
} from "./admin-insights-shared";
import {
  SchoolVitalsChartWidget,
  SchoolVitalsKpiGroups,
  SchoolVitalsSkeleton,
  schoolVitalsWidgetSpanClass,
} from "./SchoolVitalsWidgets";
import { SCHOOL_VITALS_CHART_WIDGET_IDS } from "./school-vitals-meta";

type SchoolVitalsDashboardViewProps = {
  slug: string;
  title: string;
  dashboard: InsightDashboard | null;
  loading: boolean;
  error: string | null;
  range: InsightDashboardRange;
  onRangeChange: (range: InsightDashboardRange) => void;
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
  if (severity === "warning") {
    return {
      wrap: "border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-warning)_15%,var(--admin-surface))]",
      icon: "text-[var(--admin-warning)]",
      title: "text-[var(--admin-warning)]",
    };
  }
  return {
    wrap: "border-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-border))] bg-[var(--admin-primary-container)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))]",
    icon: "text-[var(--admin-primary)]",
    title: "text-[var(--admin-primary)]",
  };
}

function AlertStack({
  alerts,
  slug,
  range,
}: {
  alerts: InsightAlert[];
  slug: string;
  range: InsightDashboardRange;
}) {
  if (alerts.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="School vitals alerts">
      {alerts.map((alert) => {
        const tone = alertTone(alert.severity);
        const href = alert.href ?? `${adminInsightAlertsHref(slug)}?range=${range}`;
        const clickable = Boolean(alert.href);
        const body = (
          <>
            <div className={`flex min-w-0 items-center gap-3 ${tone.icon}`}>
              {alert.severity === "warning" ? (
                <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <Info className="h-5 w-5 shrink-0" aria-hidden="true" />
              )}
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
              className={`flex items-center justify-between rounded p-3 ${tone.wrap}`}
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
            className={`group flex items-center justify-between rounded p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${tone.wrap}`}
          >
            {body}
          </Link>
        );
      })}
    </section>
  );
}

function RangeControl({
  range,
  onRangeChange,
}: {
  range: InsightDashboardRange;
  onRangeChange: (range: InsightDashboardRange) => void;
}) {
  return (
    <div className={insightSegmentTrackClassName} role="radiogroup" aria-label="Date range">
      {INSIGHT_RANGE_OPTIONS.map((option) => {
        const active = option.value === range;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? insightSegmentButtonActiveClassName : insightSegmentButtonClassName}
            onClick={() => {
              onRangeChange(option.value);
            }}
          >
            {option.label}
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
    <div className="flex items-start gap-4 rounded border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]">
        <AlertCircle className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-[var(--admin-danger)]">
          Unable to load detailed telemetry
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">{message}</p>
        <button
          type="button"
          className={`${insightGhostButtonClassName} mt-4 border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-outline))] text-[var(--admin-danger)]`}
          onClick={onRetry}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry connection
        </button>
      </div>
    </div>
  );
}

function EmptyLayout({ slug }: { slug: string }) {
  return (
    <div className="rounded border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
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

export function SchoolVitalsDashboardView({
  slug,
  title,
  dashboard,
  loading,
  error,
  range,
  onRangeChange,
  onRefresh,
  showLastUpdated = true,
  hiddenSlugs = [],
  preview = false,
  previewLayout = null,
  savingPreview = false,
  onSavePreview,
  onDiscardPreview,
}: SchoolVitalsDashboardViewProps) {
  const activeLayout = previewLayout ?? dashboard?.layout ?? null;

  const visibleWidgets = useMemo(() => {
    const widgets = dashboard?.widgets ?? [];
    if (activeLayout) return applyInsightLayout(widgets, activeLayout);
    return widgets;
  }, [activeLayout, dashboard?.widgets]);

  const kpiWidgets = visibleWidgets.filter((widget) => widget.defaultViz === "kpi");
  const chartOrder = new Map<string, number>(
    SCHOOL_VITALS_CHART_WIDGET_IDS.map((id, index) => [id, index]),
  );
  const chartWidgets = visibleWidgets
    .filter((widget) => widget.defaultViz !== "kpi")
    .slice()
    .sort((left, right) => (chartOrder.get(left.id) ?? 99) - (chartOrder.get(right.id) ?? 99));

  const showSkeleton = loading && !dashboard;
  const showPartialError = Boolean(error && dashboard);
  const showFullError = Boolean(error && !dashboard);
  const hasBody = Boolean(dashboard) && !showFullError;

  return (
    <div className={`${insightPageClassName} ${preview ? "pb-24" : ""}`}>
      <header className="flex flex-col justify-between gap-6 border-b border-[var(--admin-border)] pb-6 md:flex-row md:items-end">
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
          <h1 className={insightPageTitleClassName}>{title}</h1>
          <p className={insightPageDescClassName}>{dashboardDescription(slug)}</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 md:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {showLastUpdated ? (
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                {dashboard?.generatedAt
                  ? `Generated ${formatRelativeTime(dashboard.generatedAt)}`
                  : loading
                    ? "Fetching analytics..."
                    : " "}
              </span>
            ) : null}
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
                  `insights-${slug}-${range}.csv`,
                  dashboardToCsv(dashboard.title, dashboard.generatedAt, dashboard.widgets),
                );
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
            <Link
              href={`${adminInsightAlertsHref(slug)}?range=${range}`}
              prefetch={false}
              className={insightGhostButtonClassName}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              Alerts
              {dashboard && dashboard.alerts.length > 0 ? (
                <span className="rounded bg-[color-mix(in_srgb,var(--admin-warning)_16%,transparent)] px-1.5 py-0.5 font-data text-[11px] text-[var(--admin-warning)]">
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
          <RangeControl range={range} onRangeChange={onRangeChange} />
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

      {showSkeleton ? <SchoolVitalsSkeleton /> : null}

      {showFullError && error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}

      {hasBody && dashboard ? (
        <>
          {showPartialError && error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}

          <AlertStack alerts={dashboard.alerts} slug={slug} range={range} />

          {kpiWidgets.length > 0 ? (
            <SchoolVitalsKpiGroups widgets={kpiWidgets} slug={slug} range={range} />
          ) : null}

          {!showPartialError && chartWidgets.length > 0 ? (
            <div className="grid grid-cols-12 gap-6">
              {chartWidgets.map((widget: InsightWidget) => (
                <div key={widget.id} className={schoolVitalsWidgetSpanClass(widget.span)}>
                  <SchoolVitalsChartWidget widget={widget} slug={slug} range={range} />
                </div>
              ))}
            </div>
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
