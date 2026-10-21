import { describe, expect, it } from "vitest";
import type {
  InsightDashboard,
  InsightWidget,
} from "../../../frontend/apps/web/src/features/admin/insights/admin-insights-api";
import { DASHBOARD_PRIMARY_WIDGET_IDS } from "../../../frontend/apps/web/src/features/admin/insights/admin-insights-shared";
import {
  dashboardInsightArea,
  insightDashboardArea,
  liveDashboardInsightArea,
} from "../../../frontend/apps/web/src/features/admin/insights/insight-dashboard-areas";
import type { InsightDashboardContext } from "../../../frontend/apps/web/src/features/admin/insights/InsightDashboardView";

function kpi(id: string, value: number): InsightWidget {
  return {
    id,
    title: id,
    defaultViz: "kpi",
    span: "third",
    data: {
      columns: [{ key: "value", label: "Value", kind: "measure" }],
      rows: [{ value }],
    },
  } as InsightWidget;
}

function liveContext(counts: { sessions: number; liveNow: number; upcoming: number }) {
  const kpiWidgets = [
    kpi("sessions", counts.sessions),
    kpi("live-now", counts.liveNow),
    kpi("upcoming", counts.upcoming),
  ];
  return {
    slug: "live-dashboard",
    range: "12m",
    dashboard: {
      slug: "live-dashboard",
      title: "Live Dashboard",
      generatedAt: "2026-10-17T07:26:00.000Z",
      alerts: [],
      widgets: kpiWidgets,
    } as unknown as InsightDashboard,
    kpiWidgets,
    chartWidgets: [],
    compact: false,
  } satisfies InsightDashboardContext;
}

describe("insight dashboard view", () => {
  it("disables the range picker on the sections whose widgets use fixed windows", () => {
    for (const slug of [
      "sales-insight",
      "live-dashboard",
      "marketing-insight",
      "messenger-insight",
    ]) {
      expect(insightDashboardArea(slug).fixedWindowCaption).toMatch(/fixed windows/);
    }
    expect(insightDashboardArea("dashboard").fixedWindowCaption).toBeUndefined();
    expect(insightDashboardArea("school-vitals").fixedWindowCaption).toBeUndefined();
  });

  it("shows the Dashboard's primary widgets until a layout is saved, and every widget elsewhere", () => {
    const widgets = [kpi("revenue", 1), kpi("not-primary", 2)];
    expect(DASHBOARD_PRIMARY_WIDGET_IDS).toContain("revenue");
    expect(dashboardInsightArea.defaultWidgets?.(widgets).map((widget) => widget.id)).toEqual([
      "revenue",
    ]);
    expect(insightDashboardArea("some-new-section").defaultWidgets).toBeUndefined();
    expect(insightDashboardArea("sales-insight").defaultWidgets).toBeUndefined();
  });

  it("frames Live Dashboard by whether sessions exist and whether any are live or upcoming", () => {
    const empty = liveDashboardInsightArea.framing?.(
      liveContext({ sessions: 0, liveNow: 0, upcoming: 0 }),
    );
    expect(empty?.hideAlerts).toBe(true);
    expect(empty?.banner).toBeTruthy();
    expect(empty?.heading).toBeUndefined();

    const quiet = liveDashboardInsightArea.framing?.(
      liveContext({ sessions: 12, liveNow: 0, upcoming: 0 }),
    );
    expect(quiet?.heading?.title).toBe("Live Operations");
    expect(quiet?.hideAlerts).toBe(false);
    expect(quiet?.status).toBeTruthy();

    const active = liveDashboardInsightArea.framing?.(
      liveContext({ sessions: 12, liveNow: 2, upcoming: 3 }),
    );
    expect(active?.heading).toBeUndefined();
    expect(active?.banner).toBeUndefined();
    expect(active?.generatedLabel).toMatch(/^Generated /);
  });
});
