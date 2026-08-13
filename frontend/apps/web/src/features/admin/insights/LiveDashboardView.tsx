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
  Radio,
  RefreshCw,
  Settings,
  Users,
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
  adminInsightNowHref,
  adminInsightAttendanceHref,
  adminInsightSessionsHref,
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
  insightPrimaryButtonClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
} from "./admin-insights-shared";
import {
  LIVE_FIXED_WINDOW_CAPTION,
  LIVE_RANGE_SHORT_LABELS,
  liveOpsMode,
} from "./live-dashboard-meta";
import {
  LiveDashboardChartGrid,
  LiveDashboardKpiGroups,
  LiveDashboardQuietKpis,
  LiveDashboardSkeleton,
} from "./LiveDashboardWidgets";

type LiveDashboardViewProps = {
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

function numericValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function kpiValue(widgets: InsightWidget[], id: string): number {
  const widget = widgets.find((row) => row.id === id);
  return numericValue(widget?.data.rows[0]?.["value"]);
}

function clockLabel(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
      wrap: "border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-warning)_15%,var(--admin-surface))]",
      icon: "text-[var(--admin-warning)]",
      title: "text-[var(--admin-warning)]",
    };
  }
  return {
    wrap: "border-[var(--admin-border)] bg-[var(--admin-surface-low)]",
    icon: "text-[var(--admin-primary)]",
    title: "text-[var(--admin-on-surface)]",
  };
}

function AlertStack({ alerts, slug }: { alerts: InsightAlert[]; slug: string }) {
  if (alerts.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="Live dashboard alerts">
      {alerts.map((alert) => {
        const tone = alertTone(alert.severity);
        const href = alert.href ?? adminInsightAlertsHref(slug);
        const clickable = Boolean(alert.href) && alert.severity !== "info";
        const icon =
          alert.severity === "info" ? (
            <Info className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          );
        const body = (
          <>
            <div className={`flex min-w-0 items-start gap-3 ${tone.icon}`}>
              {icon}
              <div className="min-w-0">
                <h4 className={`text-sm font-semibold ${tone.title}`}>{alert.title}</h4>
                <p className="text-sm text-[var(--admin-on-surface-variant)]">{alert.message}</p>
              </div>
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
              className={`flex items-start justify-between rounded border p-3 ${tone.wrap}`}
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
            className={`group flex items-start justify-between rounded border p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${tone.wrap}`}
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
            {LIVE_RANGE_SHORT_LABELS[option.value]}
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
    <section className="flex w-full flex-col items-start justify-between gap-4 rounded border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:px-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]">
          <AlertCircle className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--admin-danger)]">
            Data pipeline disconnected
          </h3>
          <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">
            {message ||
              "Data load failed. Check your connection or retry. Historical data above may be stale."}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded bg-[var(--admin-danger)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-[background-color,transform] duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 motion-safe:active:translate-y-px"
        onClick={onRetry}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Retry connection
      </button>
    </section>
  );
}

function EmptyLayout({ slug }: { slug: string }) {
  return (
    <div className="rounded border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">No widgets to show</h3>
      <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
        Turn widgets back on from Customize, or wait for live class activity to populate this view.
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

function EmptyBanner() {
  return (
    <div className="flex items-start gap-3 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
      <Info
        className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)]"
        aria-hidden="true"
      />
      <div>
        <h4 className="text-sm font-semibold text-[var(--admin-on-surface)]">No active sessions</h4>
        <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
          There are currently no live sessions, webinars, or events scheduled for this academy
          today. Once a session begins, real-time data will populate here.
        </p>
      </div>
    </div>
  );
}

export function LiveDashboardView({
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
}: LiveDashboardViewProps) {
  const activeLayout = previewLayout ?? dashboard?.layout ?? null;

  const visibleWidgets = useMemo(() => {
    const widgets = dashboard?.widgets ?? [];
    if (activeLayout) return applyInsightLayout(widgets, activeLayout);
    return widgets;
  }, [activeLayout, dashboard?.widgets]);

  const kpiWidgets = visibleWidgets.filter((widget) => widget.defaultViz === "kpi");
  const chartWidgets = visibleWidgets.filter((widget) => widget.defaultViz !== "kpi");

  const sessionCount = kpiValue(kpiWidgets, "sessions");
  const liveNow = kpiValue(kpiWidgets, "live-now");
  const upcoming = kpiValue(kpiWidgets, "upcoming");
  const mode = liveOpsMode({ sessionCount, liveNow, upcoming });

  const showSkeleton = loading && !dashboard;
  const showPartialError = Boolean(error && dashboard);
  const showFullError = Boolean(error && !dashboard);
  const hasBody = Boolean(dashboard) && !showFullError;
  const generatedClock = clockLabel(dashboard?.generatedAt);

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
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            {mode === "quiet" ? "Live Operations" : title}
          </h1>
          <p className={insightPageDescClassName}>
            {mode === "quiet"
              ? "Real-time session monitoring across the academy."
              : dashboardDescription(slug)}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 md:items-end">
          {mode === "quiet" && hasBody ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-2 py-1 font-data text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                System nominal
              </span>
              <span className="rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-2 py-1 font-data text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                {showLastUpdated && dashboard?.generatedAt
                  ? `Last sync: ${formatRelativeTime(dashboard.generatedAt)}`
                  : "Last sync: Just now"}
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href={adminInsightNowHref(slug)}
              prefetch={false}
              className={insightGhostButtonClassName}
            >
              <Radio className="h-4 w-4" aria-hidden="true" />
              Now
            </Link>
            <Link
              href={adminInsightSessionsHref(slug)}
              prefetch={false}
              className={insightGhostButtonClassName}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              Sessions
            </Link>
            <Link
              href={adminInsightAttendanceHref(slug)}
              prefetch={false}
              className={insightGhostButtonClassName}
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Attendance
            </Link>
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
              {LIVE_FIXED_WINDOW_CAPTION}
            </p>
            {showLastUpdated ? (
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                {dashboard?.generatedAt
                  ? `Generated ${generatedClock ?? ""} · ${formatRelativeTime(dashboard.generatedAt)}`
                  : loading
                    ? "Fetching live metrics..."
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

      {showSkeleton ? <LiveDashboardSkeleton /> : null}

      {showFullError && error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}

      {hasBody && dashboard ? (
        <>
          {mode === "empty" ? <EmptyBanner /> : null}

          {mode !== "empty" ? <AlertStack alerts={dashboard.alerts} slug={slug} /> : null}

          {mode === "quiet" ? (
            <LiveDashboardQuietKpis liveNow={liveNow} upcoming={upcoming} />
          ) : kpiWidgets.length > 0 ? (
            <LiveDashboardKpiGroups
              widgets={kpiWidgets}
              slug={slug}
              generatedAtLabel={generatedClock}
              muted={mode === "empty"}
            />
          ) : null}

          {showPartialError && error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}

          {!showPartialError && chartWidgets.length > 0 ? (
            <LiveDashboardChartGrid widgets={chartWidgets} slug={slug} mode={mode} />
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
                {savingPreview ? "Saving..." : "Save layout"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
