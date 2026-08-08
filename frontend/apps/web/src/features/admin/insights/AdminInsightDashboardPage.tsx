"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  analyticsAlertErrorClassName,
  ghostButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  generalSettingsFormCardClassName,
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";
import { VisualizationPanel } from "../../analytics/viz";
import {
  fetchInsightDashboard,
  type InsightAlert,
  type InsightDashboard,
} from "./admin-insights-api";

type AdminInsightDashboardPageProps = {
  slug: string;
  title: string;
};

function widgetSpanClassName(span: InsightDashboard["widgets"][number]["span"]): string {
  switch (span) {
    case "full":
      return "lg:col-span-2";
    case "third":
      return "lg:col-span-1";
    case "half":
    default:
      return "lg:col-span-1";
  }
}

function alertClassName(severity: InsightAlert["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-red-300 bg-red-50 text-red-950";
    case "warning":
      return "border-amber-300 bg-amber-50 text-amber-950";
    default:
      return "border-neutral-200 bg-neutral-50 text-neutral-900";
  }
}

function dashboardDescription(slug: string, title: string): string {
  if (slug === "dashboard") {
    return "Academy overview: revenue, learners, orders, learning activity, pending tasks, and upcoming live classes.";
  }
  if (slug === "school-vitals") {
    return "Learning health for the last 30 days: engagement, lessons, assessments, practice, community, content vitality, and top courses.";
  }
  if (slug === "sales-insight") {
    return "Sales conversion: revenue, pipeline, paid vs trial/free, top products, orders, and attribution sources.";
  }
  if (slug === "live-dashboard") {
    return "Live class ops: sessions, attendance rate, watch time, upcoming/live now, and low-attendance alerts.";
  }
  if (slug === "marketing-insight") {
    return "Lead generation & channels: attribution, forms, CTAs, workflows, coupons, campaigns, and events.";
  }
  if (slug === "messenger-insight") {
    return "Messaging performance: email, push, WhatsApp, announcements, inbox volume, and delivery health.";
  }
  return `Live insight widgets for ${title.toLowerCase()} across your academy.`;
}

export function AdminInsightDashboardPage({ slug, title }: AdminInsightDashboardPageProps) {
  const [dashboard, setDashboard] = useState<InsightDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightDashboard(slug);
      setDashboard({
        ...response.data,
        alerts: response.data.alerts ?? [],
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load insight dashboard.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const kpiWidgets = dashboard?.widgets.filter((widget) => widget.defaultViz === "kpi") ?? [];
  const chartWidgets = dashboard?.widgets.filter((widget) => widget.defaultViz !== "kpi") ?? [];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={generalSettingsPageTitleClassName}>{title}</h1>
          <p className={generalSettingsPageDescClassName}>
            {dashboardDescription(slug, title)}
            {dashboard?.currency ? ` Currency: ${dashboard.currency}.` : null}
          </p>
        </div>
        <button
          type="button"
          className={ghostButtonClassName}
          disabled={loading}
          onClick={() => void loadDashboard()}
        >
          Refresh
        </button>
      </header>

      {error ? <div className={analyticsAlertErrorClassName}>{error}</div> : null}

      {dashboard && dashboard.alerts.length > 0 ? (
        <div className="space-y-2">
          {dashboard.alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border px-4 py-3 text-sm ${alertClassName(alert.severity)}`}
            >
              <p className="font-semibold">{alert.title}</p>
              <p className="mt-0.5 opacity-90">{alert.message}</p>
              {alert.href ? (
                <Link href={alert.href} prefetch={false} className="mt-2 inline-block underline">
                  Open
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {loading && !dashboard ? (
        <div className={generalSettingsFormCardClassName}>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading dashboard…</p>
        </div>
      ) : null}

      {dashboard ? (
        <>
          {kpiWidgets.length > 0 ? (
            <div
              className={
                slug === "school-vitals" ||
                slug === "sales-insight" ||
                slug === "live-dashboard" ||
                slug === "marketing-insight" ||
                slug === "messenger-insight"
                  ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              }
            >
              {kpiWidgets.map((widget) => (
                <div key={widget.id}>
                  <VisualizationPanel
                    preferenceKey={`insight:${slug}:${widget.id}`}
                    title={widget.title}
                    data={widget.data}
                    defaultViz={widget.defaultViz}
                    loading={loading}
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            {chartWidgets.map((widget) => (
              <div key={widget.id} className={widgetSpanClassName(widget.span)}>
                <VisualizationPanel
                  preferenceKey={`insight:${slug}:${widget.id}`}
                  title={widget.title}
                  data={widget.data}
                  defaultViz={widget.defaultViz}
                  loading={loading}
                />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
