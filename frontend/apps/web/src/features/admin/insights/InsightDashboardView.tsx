"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  TriangleAlert,
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
import { downloadCsv } from "./insight-detail-kit";

/** What a section's renderers get: the dashboard and its visible widgets, split by kind. */
export type InsightDashboardContext = {
  slug: string;
  range: InsightDashboardRange;
  dashboard: InsightDashboard;
  kpiWidgets: InsightWidget[];
  chartWidgets: InsightWidget[];
  compact: boolean;
};

/** What a section changes about the frame for the data it has. */
export type InsightDashboardFraming = {
  heading?: { title: string; description: string } | undefined;
  status?: ReactNode;
  banner?: ReactNode;
  hideAlerts?: boolean | undefined;
  generatedLabel?: string | undefined;
};

/**
 * What one Insights section's dashboard shows inside the shared frame. The
 * frame owns the header, range, actions, module tabs, alert banners, error,
 * empty and preview states; a section supplies its KPI groups, its charts and
 * its loading skeleton, and can adjust the frame to its data.
 */
export type InsightDashboardArea = {
  /** Sections whose widgets use fixed windows show the range picker disabled, with this caption. */
  fixedWindowCaption?: string | undefined;
  links?: ReadonlyArray<{ href: (slug: string) => string; label: string; icon: ReactNode }>;
  showCurrency?: boolean | undefined;
  /** Whose activity fills the dashboard, for the empty state: "academy", "marketing"... */
  activity: string;
  skeleton: ReactNode;
  /** The widgets shown when the operator has not saved a layout. */
  defaultWidgets?: ((widgets: InsightWidget[]) => InsightWidget[]) | undefined;
  framing?: ((context: InsightDashboardContext) => InsightDashboardFraming) | undefined;
  kpis: (context: InsightDashboardContext) => ReactNode;
  charts: (context: InsightDashboardContext) => ReactNode;
};

export type InsightDashboardViewProps = {
  slug: string;
  title: string;
  area: InsightDashboardArea;
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

const RANGE_SHORT_LABELS: Record<InsightDashboardRange, string> = {
  "12m": "12m",
  "30d": "30d",
  ytd: "YTD",
};

function RangeControl({
  range,
  fixed,
  onRangeChange,
}: {
  range: InsightDashboardRange;
  fixed: boolean;
  onRangeChange: (range: InsightDashboardRange) => void;
}) {
  return (
    <div
      className={`${insightSegmentTrackClassName} ${fixed ? "cursor-not-allowed opacity-60" : ""}`}
      role="radiogroup"
      aria-label="Date range"
      aria-disabled={fixed || undefined}
    >
      {INSIGHT_RANGE_OPTIONS.map((option) => {
        const active = option.value === range;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={fixed}
            className={active ? insightSegmentButtonActiveClassName : insightSegmentButtonClassName}
            onClick={() => {
              onRangeChange(option.value);
            }}
          >
            {fixed ? (
              RANGE_SHORT_LABELS[option.value]
            ) : (
              <>
                <span className="sm:hidden">{RANGE_SHORT_LABELS[option.value]}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </>
            )}
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

  const items = [
    { href: adminInsightSettingsHref(slug), label: "Settings", Icon: Settings },
    { href: adminInsightLibraryHref(slug), label: "Library", Icon: LayoutGrid },
    { href: adminInsightDigestsHref(slug), label: "Digests", Icon: Mail },
  ];

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
          {items.map(({ href, label, Icon }) => (
            <Link
              key={label}
              href={href}
              prefetch={false}
              role="menuitem"
              className={dropdownItemClassName}
              onClick={() => {
                setOpen(false);
              }}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const ALERT_TONE: Record<InsightAlert["severity"], { wrap: string; icon: string }> = {
  critical: {
    wrap: "border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))]",
    icon: "text-[var(--admin-danger)]",
  },
  warning: {
    wrap: "border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-warning)_15%,var(--admin-surface))]",
    icon: "text-[var(--admin-warning)]",
  },
  info: {
    wrap: "border-[var(--admin-border)] bg-[var(--admin-surface-low)] hover:bg-[var(--admin-surface-high)]",
    icon: "text-[var(--admin-primary)]",
  },
};

function AlertBanners({ alerts }: { alerts: InsightAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="Insight alerts">
      {alerts.map((alert) => {
        const tone = ALERT_TONE[alert.severity];
        const Icon =
          alert.severity === "critical"
            ? AlertCircle
            : alert.severity === "warning"
              ? TriangleAlert
              : Info;
        const body = (
          <>
            <div className="flex min-w-0 items-start gap-3">
              <Icon className={`h-5 w-5 shrink-0 ${tone.icon}`} aria-hidden="true" />
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                <span className="font-semibold text-[var(--admin-on-surface)]">{alert.title}</span>{" "}
                {alert.message}
              </p>
            </div>
            {alert.href ? (
              <ChevronRight
                className="h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
            ) : null}
          </>
        );
        const className = `flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors ${tone.wrap}`;
        return alert.href ? (
          <Link
            key={alert.id}
            href={alert.href}
            prefetch={false}
            className={`${className} outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30`}
          >
            {body}
          </Link>
        ) : (
          <div key={alert.id} className={className}>
            {body}
          </div>
        );
      })}
    </section>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]">
        <AlertCircle className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-[var(--admin-danger)]">
          Could not load insight data
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">{message}</p>
        <button
          type="button"
          className={`${insightGhostButtonClassName} mt-4 border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-outline))] text-[var(--admin-danger)]`}
          onClick={onRetry}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    </div>
  );
}

export function InsightDashboardView({
  slug,
  title,
  area,
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
}: InsightDashboardViewProps) {
  const activeLayout = previewLayout ?? dashboard?.layout ?? null;

  const visibleWidgets = useMemo(() => {
    const widgets = dashboard?.widgets ?? [];
    if (activeLayout) return applyInsightLayout(widgets, activeLayout);
    return area.defaultWidgets ? area.defaultWidgets(widgets) : widgets;
  }, [activeLayout, area, dashboard?.widgets]);

  const kpiWidgets = visibleWidgets.filter((widget) => widget.defaultViz === "kpi");
  const chartWidgets = visibleWidgets.filter((widget) => widget.defaultViz !== "kpi");

  const showSkeleton = loading && !dashboard;
  const showPartialError = Boolean(error && dashboard);
  const showFullError = Boolean(error && !dashboard);
  const context: InsightDashboardContext | null =
    dashboard && !showFullError
      ? {
          slug,
          range,
          dashboard,
          kpiWidgets,
          chartWidgets,
          compact: activeLayout?.density === "compact",
        }
      : null;
  const framing = context ? (area.framing?.(context) ?? {}) : {};
  const fixedWindow = Boolean(area.fixedWindowCaption);
  const alertCount = dashboard?.alerts.length ?? 0;
  const alertBadgeTone = dashboard?.alerts.some((alert) => alert.severity === "critical")
    ? "bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]"
    : "bg-[color-mix(in_srgb,var(--admin-warning)_14%,transparent)] text-[var(--admin-warning)]";

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
          <h1 className={insightPageTitleClassName}>{framing.heading?.title ?? title}</h1>
          <p className={insightPageDescClassName}>
            {framing.heading?.description ?? dashboardDescription(slug)}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 md:items-end">
          {framing.status ? (
            <div className="flex flex-wrap items-center justify-end gap-2">{framing.status}</div>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {area.showCurrency && dashboard?.currency ? (
              <span className="rounded bg-[var(--admin-surface-high)] px-2 py-1 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                {dashboard.currency}
              </span>
            ) : null}
            <RangeControl range={range} fixed={fixedWindow} onRangeChange={onRangeChange} />
            {area.links?.map((link) => (
              <Link
                key={link.label}
                href={link.href(slug)}
                prefetch={false}
                className={insightGhostButtonClassName}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
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
                  `insights-${slug}${fixedWindow ? "" : `-${range}`}.csv`,
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
              {alertCount > 0 ? (
                <span className={`rounded px-1.5 py-0.5 font-data text-[11px] ${alertBadgeTone}`}>
                  {alertCount}
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
                className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
          <div className="flex flex-col gap-0.5 md:items-end">
            {area.fixedWindowCaption ? (
              <p className="max-w-md text-xs text-[var(--admin-on-surface-variant)] md:text-right">
                {area.fixedWindowCaption}
              </p>
            ) : null}
            {showLastUpdated ? (
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                {dashboard?.generatedAt
                  ? (framing.generatedLabel ??
                    `Generated ${formatRelativeTime(dashboard.generatedAt)}`)
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
                aria-current={active ? "page" : undefined}
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

      {showSkeleton ? area.skeleton : null}

      {showFullError && error ? <LoadError message={error} onRetry={onRefresh} /> : null}

      {context ? (
        <>
          {framing.banner}

          {framing.hideAlerts ? null : <AlertBanners alerts={context.dashboard.alerts} />}

          {area.kpis(context)}

          {showPartialError && error ? <LoadError message={error} onRetry={onRefresh} /> : null}

          {!showPartialError && chartWidgets.length > 0 ? area.charts(context) : null}

          {!loading && kpiWidgets.length === 0 && chartWidgets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
              <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                No widgets to show
              </h3>
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                Turn widgets back on from Customize, or wait for {area.activity} activity to
                populate this view.
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
