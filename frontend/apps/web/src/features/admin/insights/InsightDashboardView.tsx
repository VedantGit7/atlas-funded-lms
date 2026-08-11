"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AlertCircle,
  Bell,
  Calendar,
  ChevronRight,
  Download,
  Eye,
  Info,
  LayoutGrid,
  Mail,
  RefreshCw,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ADMIN_INSIGHT_SECTIONS,
  adminInsightAlertsHref,
  adminInsightCustomizeHref,
  adminInsightDigestsHref,
  adminInsightHref,
  adminInsightLibraryHref,
  adminInsightSettingsHref,
  adminInsightWidgetHref,
} from "./admin-insights-catalog";
import type {
  InsightAlert,
  InsightDashboard,
  InsightDashboardRange,
  InsightLayout,
} from "./admin-insights-api";
import { csvEscape, dashboardDescription, formatRelativeTime } from "./admin-insights-format";
import { applyInsightLayout } from "./admin-insights-layout";
import {
  DASHBOARD_PRIMARY_WIDGET_IDS,
  INSIGHT_RANGE_OPTIONS,
  insightGhostButtonClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPrimaryButtonClassName,
  insightSelectContentClassName,
  insightSelectTriggerClassName,
  insightShimmerClassName,
} from "./admin-insights-shared";
import {
  InsightKpiCard,
  renderSpecializedWidget,
  widgetSpanClassName,
} from "./InsightDashboardWidgets";
import { SchoolVitalsDashboardView } from "./SchoolVitalsDashboardView";
import { SalesInsightDashboardView } from "./SalesInsightDashboardView";

type InsightDashboardViewProps = {
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
  onSavePreview?: () => void;
  onDiscardPreview?: () => void;
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

function dashboardToCsv(dashboard: InsightDashboard): string {
  const lines: string[] = [
    `# ${dashboard.title}`,
    `# Generated ${dashboard.generatedAt ?? ""}`,
    "",
  ];
  for (const widget of dashboard.widgets) {
    lines.push(`# ${widget.title}`);
    lines.push(widget.data.columns.map((column) => csvEscape(column.label)).join(","));
    for (const row of widget.data.rows) {
      lines.push(widget.data.columns.map((column) => csvEscape(row[column.key] ?? "")).join(","));
    }
    lines.push("");
  }
  return lines.join("\n");
}

function alertTone(severity: InsightAlert["severity"]): {
  wrap: string;
  icon: string;
  title: string;
} {
  if (severity === "critical") {
    return {
      wrap: "border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))]",
      icon: "text-[var(--admin-danger)]",
      title: "text-[var(--admin-danger)]",
    };
  }
  if (severity === "warning") {
    return {
      wrap: "border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))]",
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

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

export function InsightDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading insights dashboard">
      <div className="flex flex-col gap-2">
        <Shimmer className="h-[52px] w-full rounded-lg" />
        <Shimmer className="h-[52px] w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-8 w-32" />
            <div className="mt-1 flex items-center justify-between">
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 h-[400px] rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex h-11 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
            <Shimmer className="h-4 w-48" />
            <Shimmer className="h-6 w-6" />
          </div>
          <div className="p-6">
            <Shimmer className="h-56 w-full opacity-60" />
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_5%,var(--admin-surface))] px-6 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)]">
        <AlertCircle className="h-6 w-6 text-[var(--admin-danger)]" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
        Could not load the dashboard.
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">{message}</p>
      <button
        type="button"
        className={`${insightGhostButtonClassName} mt-6 border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-outline))] text-[var(--admin-danger)]`}
        onClick={onRetry}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}

export function InsightDashboardView({
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
}: InsightDashboardViewProps) {
  const activeLayout = previewLayout ?? dashboard?.layout ?? null;

  const visibleWidgets = useMemo(() => {
    const widgets = dashboard?.widgets ?? [];
    if (activeLayout) return applyInsightLayout(widgets, activeLayout);
    if (slug === "dashboard") {
      const primary = new Set<string>(DASHBOARD_PRIMARY_WIDGET_IDS);
      return widgets.filter((widget) => primary.has(widget.id));
    }
    return widgets;
  }, [activeLayout, dashboard?.widgets, slug]);

  const kpiWidgets = visibleWidgets.filter((widget) => widget.defaultViz === "kpi");
  const chartWidgets = visibleWidgets.filter((widget) => widget.defaultViz !== "kpi");
  const densityGap = activeLayout?.density === "compact" ? "gap-4" : "gap-8";

  if (slug === "school-vitals") {
    return (
      <SchoolVitalsDashboardView
        slug={slug}
        title={title}
        dashboard={dashboard}
        loading={loading}
        error={error}
        range={range}
        onRangeChange={onRangeChange}
        onRefresh={onRefresh}
        showLastUpdated={showLastUpdated}
        hiddenSlugs={hiddenSlugs}
        preview={preview}
        previewLayout={previewLayout}
        savingPreview={savingPreview}
        onSavePreview={onSavePreview}
        onDiscardPreview={onDiscardPreview}
      />
    );
  }

  if (slug === "sales-insight") {
    return (
      <SalesInsightDashboardView
        slug={slug}
        title={title}
        dashboard={dashboard}
        loading={loading}
        error={error}
        range={range}
        onRefresh={onRefresh}
        showLastUpdated={showLastUpdated}
        hiddenSlugs={hiddenSlugs}
        preview={preview}
        previewLayout={previewLayout}
        savingPreview={savingPreview}
        onSavePreview={onSavePreview}
        onDiscardPreview={onDiscardPreview}
      />
    );
  }

  return (
    <div className={`${insightPageClassName} ${preview ? "pb-24" : ""}`}>
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className={insightPageTitleClassName}>{title}</h1>
          <p className={insightPageDescClassName}>{dashboardDescription(slug)}</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <div className="flex flex-wrap items-center justify-end gap-3">
            {dashboard?.currency ? (
              <span className="rounded bg-[var(--admin-surface-high)] px-2 py-1 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                {dashboard.currency}
              </span>
            ) : null}
            <Select
              ariaLabel="Date range"
              value={range}
              onValueChange={(value) => {
                onRangeChange(value as InsightDashboardRange);
              }}
              options={[...INSIGHT_RANGE_OPTIONS]}
              className={insightSelectTriggerClassName}
              contentClassName={insightSelectContentClassName}
            />
            <Link
              href={adminInsightSettingsHref(slug)}
              prefetch={false}
              className={insightGhostButtonClassName}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              Settings
            </Link>
            <Link
              href={adminInsightCustomizeHref(slug)}
              prefetch={false}
              className={insightGhostButtonClassName}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Customize
            </Link>
            <Link
              href={adminInsightLibraryHref(slug)}
              prefetch={false}
              className={insightGhostButtonClassName}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              Library
            </Link>
            <Link
              href={adminInsightDigestsHref(slug)}
              prefetch={false}
              className={insightGhostButtonClassName}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Digests
            </Link>
            <Link
              href={`${adminInsightAlertsHref(slug)}?range=${range}`}
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
            <button
              type="button"
              className={insightGhostButtonClassName}
              disabled={!dashboard}
              onClick={() => {
                if (!dashboard) return;
                downloadCsv(`insights-${slug}-${range}.csv`, dashboardToCsv(dashboard));
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
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
          {showLastUpdated ? (
            <span className="text-xs text-[var(--admin-on-surface-variant)]">
              {dashboard?.generatedAt
                ? `Last updated ${formatRelativeTime(dashboard.generatedAt)}`
                : loading
                  ? "Fetching analytics..."
                  : " "}
            </span>
          ) : null}
        </div>
      </header>

      <nav
        className="flex items-center gap-8 overflow-x-auto border-b border-[var(--admin-border)]"
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
                    ? "-mb-px border-b-2 border-[var(--admin-primary)] pb-2 text-base font-semibold text-[var(--admin-primary)]"
                    : "pb-2 text-base font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
                }
              >
                {section.label}
              </Link>
            );
          },
        )}
      </nav>

      {error ? <InsightErrorState message={error} onRetry={onRefresh} /> : null}

      {loading && !dashboard ? <InsightDashboardSkeleton /> : null}

      {dashboard && !error ? (
        <>
          {dashboard.alerts.length > 0 ? (
            <div className="flex flex-col gap-2">
              {dashboard.alerts.map((alert) => {
                const tone = alertTone(alert.severity);
                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${tone.wrap}`}
                  >
                    {alert.severity === "critical" ? (
                      <AlertCircle className={`mt-0.5 h-5 w-5 ${tone.icon}`} aria-hidden="true" />
                    ) : alert.id === "upcoming-live" ? (
                      <Calendar className={`mt-0.5 h-5 w-5 ${tone.icon}`} aria-hidden="true" />
                    ) : (
                      <Info className={`mt-0.5 h-5 w-5 ${tone.icon}`} aria-hidden="true" />
                    )}
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <p className="text-sm">
                        <span className={`font-medium ${tone.title}`}>{alert.title}</span>
                        <span className={`${tone.title} opacity-80`}> {alert.message}</span>
                      </p>
                      <Link
                        href={alert.href ?? `${adminInsightAlertsHref(slug)}?range=${range}`}
                        prefetch={false}
                        className={`rounded p-1 ${tone.icon} hover:bg-[color-mix(in_srgb,var(--admin-on-surface)_6%,transparent)]`}
                        aria-label={`Open ${alert.title}`}
                      >
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {kpiWidgets.length > 0 ? (
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 ${densityGap}`}
            >
              {kpiWidgets.map((widget) => (
                <InsightKpiCard
                  key={widget.id}
                  widget={widget}
                  currency={dashboard.currency}
                  href={`${adminInsightWidgetHref(slug, widget.id)}?range=${range}`}
                />
              ))}
            </div>
          ) : null}

          {chartWidgets.length > 0 ? (
            <div className={`mb-8 grid grid-cols-1 md:grid-cols-12 ${densityGap}`}>
              {chartWidgets.map((widget) => (
                <div key={widget.id} className={widgetSpanClassName(widget.span)}>
                  {renderSpecializedWidget(widget, range, slug)}
                </div>
              ))}
            </div>
          ) : null}

          {!loading && kpiWidgets.length === 0 && chartWidgets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
              <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                No widgets to show
              </h3>
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                Turn widgets back on from Customize, or wait for academy activity to populate this
                view.
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
                Save layout
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
