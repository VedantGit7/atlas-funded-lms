"use client";

import {
  ClipboardList,
  GitBranch,
  Inbox,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Radio,
  Users,
} from "lucide-react";
import {
  adminInsightAttendanceHref,
  adminInsightAttributionHref,
  adminInsightCaptureHref,
  adminInsightChannelsHref,
  adminInsightInboxHref,
  adminInsightNowHref,
  adminInsightSessionsHref,
  adminInsightWhatsappHref,
  adminInsightWidgetHref,
  adminInsightWorkflowsHref,
} from "./admin-insights-catalog";
import type { InsightDashboard, InsightWidget } from "./admin-insights-api";
import { formatRelativeTime } from "./admin-insights-format";
import { DASHBOARD_PRIMARY_WIDGET_IDS } from "./admin-insights-shared";
import { numericValue, Shimmer } from "./insight-detail-kit";
import {
  InsightKpiCard,
  renderSpecializedWidget,
  widgetSpanClassName,
} from "./InsightDashboardWidgets";
import type { InsightDashboardArea, InsightDashboardContext } from "./InsightDashboardView";
import { LIVE_FIXED_WINDOW_CAPTION, liveOpsMode } from "./live-dashboard-meta";
import {
  LiveDashboardChartGrid,
  LiveDashboardKpiGroups,
  LiveDashboardQuietKpis,
  LiveDashboardSkeleton,
} from "./LiveDashboardWidgets";
import { MARKETING_FIXED_WINDOW_CAPTION } from "./marketing-insight-meta";
import {
  MarketingInsightChartGrid,
  MarketingInsightKpiGroups,
  MarketingInsightSkeleton,
} from "./MarketingInsightWidgets";
import { MESSENGER_FIXED_WINDOW_CAPTION } from "./messenger-insight-meta";
import {
  MessengerInsightChartGrid,
  MessengerInsightKpiGroups,
  MessengerInsightSkeleton,
} from "./MessengerInsightWidgets";
import { SALES_FIXED_WINDOW_CAPTION } from "./sales-insight-meta";
import {
  SalesInsightChartGrid,
  SalesInsightKpiGroups,
  SalesInsightSkeleton,
} from "./SalesInsightWidgets";
import { SCHOOL_VITALS_CHART_WIDGET_IDS } from "./school-vitals-meta";
import {
  SchoolVitalsChartWidget,
  SchoolVitalsKpiGroups,
  SchoolVitalsSkeleton,
  schoolVitalsWidgetSpanClass,
} from "./SchoolVitalsWidgets";

const linkIconClassName = "h-4 w-4";

function kpiValue(widgets: InsightWidget[], id: string): number {
  return numericValue(widgets.find((widget) => widget.id === id)?.data.rows[0]?.["value"]);
}

/* Dashboard */

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading insights dashboard">
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
      <div className="h-[400px] rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex h-11 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
          <Shimmer className="h-4 w-48" />
          <Shimmer className="h-6 w-6" />
        </div>
        <div className="p-6">
          <Shimmer className="h-56 w-full opacity-60" />
        </div>
      </div>
    </div>
  );
}

const primaryDashboardWidgets = new Set<string>(DASHBOARD_PRIMARY_WIDGET_IDS);

/** The cross-section Dashboard: headline KPI cards and the widget grid. */
export const dashboardInsightArea: InsightDashboardArea = {
  activity: "academy",
  showCurrency: true,
  skeleton: <DashboardSkeleton />,
  defaultWidgets: (widgets) => widgets.filter((widget) => primaryDashboardWidgets.has(widget.id)),
  kpis: ({ slug, range, dashboard, kpiWidgets, compact }) =>
    kpiWidgets.length > 0 ? (
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 ${compact ? "gap-4" : "gap-8"}`}
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
    ) : null,
  charts: ({ slug, range, chartWidgets, compact }) => (
    <div className={`mb-8 grid grid-cols-1 md:grid-cols-12 ${compact ? "gap-4" : "gap-8"}`}>
      {chartWidgets.map((widget) => (
        <div key={widget.id} className={widgetSpanClassName(widget.span)}>
          {renderSpecializedWidget(widget, range, slug)}
        </div>
      ))}
    </div>
  ),
};

/* School Vitals */

const schoolVitalsChartOrder = new Map<string, number>(
  SCHOOL_VITALS_CHART_WIDGET_IDS.map((id, index) => [id, index]),
);

export const schoolVitalsInsightArea: InsightDashboardArea = {
  activity: "academy",
  skeleton: <SchoolVitalsSkeleton />,
  kpis: ({ slug, range, kpiWidgets }) =>
    kpiWidgets.length > 0 ? (
      <SchoolVitalsKpiGroups widgets={kpiWidgets} slug={slug} range={range} />
    ) : null,
  charts: ({ slug, range, chartWidgets }) => (
    <div className="grid grid-cols-12 gap-6">
      {chartWidgets
        .slice()
        .sort(
          (left, right) =>
            (schoolVitalsChartOrder.get(left.id) ?? 99) -
            (schoolVitalsChartOrder.get(right.id) ?? 99),
        )
        .map((widget) => (
          <div key={widget.id} className={schoolVitalsWidgetSpanClass(widget.span)}>
            <SchoolVitalsChartWidget widget={widget} slug={slug} range={range} />
          </div>
        ))}
    </div>
  ),
};

/* Sales Insight */

export const salesInsightArea: InsightDashboardArea = {
  activity: "sales",
  fixedWindowCaption: SALES_FIXED_WINDOW_CAPTION,
  skeleton: <SalesInsightSkeleton />,
  kpis: ({ slug, dashboard, kpiWidgets }) =>
    kpiWidgets.length > 0 ? (
      <SalesInsightKpiGroups widgets={kpiWidgets} slug={slug} currency={dashboard.currency} />
    ) : null,
  charts: ({ slug, dashboard, chartWidgets }) => (
    <SalesInsightChartGrid widgets={chartWidgets} slug={slug} currency={dashboard.currency} />
  ),
};

/* Live Dashboard */

function liveMode({ kpiWidgets }: InsightDashboardContext) {
  return liveOpsMode({
    sessionCount: kpiValue(kpiWidgets, "sessions"),
    liveNow: kpiValue(kpiWidgets, "live-now"),
    upcoming: kpiValue(kpiWidgets, "upcoming"),
  });
}

function clockLabel(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const liveChipClassName =
  "rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-2 py-1 font-data text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]";

function NoLiveSessions() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
      <Radio
        className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)]"
        aria-hidden="true"
      />
      <div>
        <h4 className="text-sm font-semibold text-[var(--admin-on-surface)]">No active sessions</h4>
        <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
          There are no live sessions, webinars or events scheduled for this academy today. Once a
          session begins, real-time data will appear here.
        </p>
      </div>
    </div>
  );
}

/**
 * Live Dashboard reads the session counts to pick a mode: with no sessions it
 * says so instead of showing alerts; with sessions but none live or upcoming
 * it shows the quiet operations view.
 */
export const liveDashboardInsightArea: InsightDashboardArea = {
  activity: "live class",
  fixedWindowCaption: LIVE_FIXED_WINDOW_CAPTION,
  links: [
    {
      href: adminInsightNowHref,
      label: "Now",
      icon: <Radio className={linkIconClassName} aria-hidden="true" />,
    },
    {
      href: adminInsightSessionsHref,
      label: "Sessions",
      icon: <LayoutGrid className={linkIconClassName} aria-hidden="true" />,
    },
    {
      href: adminInsightAttendanceHref,
      label: "Attendance",
      icon: <Users className={linkIconClassName} aria-hidden="true" />,
    },
  ],
  skeleton: <LiveDashboardSkeleton />,
  framing: (context) => {
    const mode = liveMode(context);
    const generatedAt = context.dashboard.generatedAt;
    return {
      heading:
        mode === "quiet"
          ? {
              title: "Live Operations",
              description: "Real-time session monitoring across the academy.",
            }
          : undefined,
      status:
        mode === "quiet" ? (
          <>
            <span className={liveChipClassName}>System nominal</span>
            <span className={liveChipClassName}>
              Last sync: {generatedAt ? formatRelativeTime(generatedAt) : "just now"}
            </span>
          </>
        ) : undefined,
      banner: mode === "empty" ? <NoLiveSessions /> : undefined,
      hideAlerts: mode === "empty",
      generatedLabel: generatedAt
        ? `Generated ${clockLabel(generatedAt) ?? ""} · ${formatRelativeTime(generatedAt)}`
        : undefined,
    };
  },
  kpis: (context) => {
    const mode = liveMode(context);
    if (mode === "quiet") {
      return (
        <LiveDashboardQuietKpis
          liveNow={kpiValue(context.kpiWidgets, "live-now")}
          upcoming={kpiValue(context.kpiWidgets, "upcoming")}
        />
      );
    }
    return context.kpiWidgets.length > 0 ? (
      <LiveDashboardKpiGroups
        widgets={context.kpiWidgets}
        slug={context.slug}
        generatedAtLabel={clockLabel(context.dashboard.generatedAt)}
        muted={mode === "empty"}
      />
    ) : null;
  },
  charts: (context) => (
    <LiveDashboardChartGrid
      widgets={context.chartWidgets}
      slug={context.slug}
      mode={liveMode(context)}
    />
  ),
};

/* Marketing Insight */

export const marketingInsightArea: InsightDashboardArea = {
  activity: "marketing",
  fixedWindowCaption: MARKETING_FIXED_WINDOW_CAPTION,
  links: [
    {
      href: adminInsightAttributionHref,
      label: "Attribution",
      icon: <Megaphone className={linkIconClassName} aria-hidden="true" />,
    },
    {
      href: adminInsightCaptureHref,
      label: "Capture",
      icon: <ClipboardList className={linkIconClassName} aria-hidden="true" />,
    },
    {
      href: adminInsightWorkflowsHref,
      label: "Workflows",
      icon: <GitBranch className={linkIconClassName} aria-hidden="true" />,
    },
  ],
  skeleton: <MarketingInsightSkeleton />,
  kpis: ({ slug, dashboard, kpiWidgets }) =>
    kpiWidgets.length > 0 ? (
      <MarketingInsightKpiGroups widgets={kpiWidgets} slug={slug} currency={dashboard.currency} />
    ) : null,
  charts: ({ slug, dashboard, chartWidgets }) => (
    <MarketingInsightChartGrid widgets={chartWidgets} slug={slug} currency={dashboard.currency} />
  ),
};

/* Messenger Insight */

/** Nothing sent and nothing received, so the charts would all be empty. */
function noMessagingActivity(dashboard: InsightDashboard): boolean {
  return (
    kpiValue(dashboard.widgets, "outbound-sends") <= 0 &&
    kpiValue(dashboard.widgets, "inbox-messages") <= 0 &&
    kpiValue(dashboard.widgets, "announcements") <= 0
  );
}

export const messengerInsightArea: InsightDashboardArea = {
  activity: "messaging",
  fixedWindowCaption: MESSENGER_FIXED_WINDOW_CAPTION,
  links: [
    {
      href: adminInsightChannelsHref,
      label: "Channels",
      icon: <MessageSquare className={linkIconClassName} aria-hidden="true" />,
    },
    {
      href: adminInsightWhatsappHref,
      label: "WhatsApp",
      icon: <MessageCircle className={linkIconClassName} aria-hidden="true" />,
    },
    {
      href: adminInsightInboxHref,
      label: "Inbox",
      icon: <Inbox className={linkIconClassName} aria-hidden="true" />,
    },
  ],
  skeleton: <MessengerInsightSkeleton />,
  kpis: ({ slug, dashboard, kpiWidgets }) =>
    kpiWidgets.length > 0 ? (
      <MessengerInsightKpiGroups widgets={kpiWidgets} slug={slug} alerts={dashboard.alerts} />
    ) : null,
  charts: ({ slug, dashboard, chartWidgets }) =>
    noMessagingActivity(dashboard) ? (
      <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-14 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
          <Inbox className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[var(--admin-on-surface)]">
          No messaging activity yet
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
          Outbound campaigns, channel reach and inbox replies will appear here once email, push,
          WhatsApp or announcements start sending.
        </p>
      </div>
    ) : (
      <MessengerInsightChartGrid widgets={chartWidgets} slug={slug} alerts={dashboard.alerts} />
    ),
};

const AREAS: Record<string, InsightDashboardArea> = {
  dashboard: dashboardInsightArea,
  "school-vitals": schoolVitalsInsightArea,
  "sales-insight": salesInsightArea,
  "live-dashboard": liveDashboardInsightArea,
  "marketing-insight": marketingInsightArea,
  "messenger-insight": messengerInsightArea,
};

/** The dashboard spec for an Insights section; any other shows every widget in the Dashboard's grid. */
export function insightDashboardArea(slug: string): InsightDashboardArea {
  return AREAS[slug] ?? { ...dashboardInsightArea, defaultWidgets: undefined };
}
