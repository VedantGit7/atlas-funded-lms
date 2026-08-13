import { describe, expect, it } from "vitest";
import { insightDashboardResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

describe("insight dashboard schema", () => {
  it("accepts Learnyst-style dashboard payload with alerts and widgets", () => {
    const parsed = insightDashboardResponseSchema.parse({
      data: {
        slug: "dashboard",
        title: "Dashboard",
        currency: "INR",
        range: "12m",
        generatedAt: "2026-08-11T06:35:00.000Z",
        alerts: [
          {
            id: "failed-payments",
            severity: "warning",
            title: "Failed payments",
            message: "3 payments failed recently.",
            href: "/admin/reports/payments",
          },
        ],
        widgets: [
          {
            id: "revenue",
            title: "Revenue",
            defaultViz: "kpi",
            span: "third",
            deltaPct: 12.4,
            sparkline: [2100, 4800, 9200, 18400],
            data: {
              columns: [
                { key: "metric", label: "Metric", kind: "dimension" },
                { key: "value", label: "Revenue", kind: "measure" },
              ],
              rows: [{ metric: "Revenue", value: 1200 }],
              measures: ["value"],
            },
          },
        ],
      },
    });

    expect(parsed.data.slug).toBe("dashboard");
    expect(parsed.data.range).toBe("12m");
    expect(parsed.data.generatedAt).toBe("2026-08-11T06:35:00.000Z");
    expect(parsed.data.alerts).toHaveLength(1);
    expect(parsed.data.widgets[0]?.id).toBe("revenue");
    expect(parsed.data.widgets[0]?.deltaPct).toBe(12.4);
    expect(parsed.data.widgets[0]?.sparkline).toEqual([2100, 4800, 9200, 18400]);
  });

  it("defaults alerts to empty array when omitted", () => {
    const parsed = insightDashboardResponseSchema.parse({
      data: {
        slug: "school-vitals",
        title: "School Vitals",
        widgets: [],
      },
    });
    expect(parsed.data.alerts).toEqual([]);
  });

  it("accepts Learnyst-style school vitals payload with learning KPIs and funnel", () => {
    const parsed = insightDashboardResponseSchema.parse({
      data: {
        slug: "school-vitals",
        title: "School Vitals",
        alerts: [
          {
            id: "inactive-learners",
            severity: "info",
            title: "Inactive learners",
            message: "12 learners inactive for 30+ days.",
            href: "/admin/reports/resource-usage",
          },
        ],
        widgets: [
          {
            id: "lessons-completed",
            title: "Lessons completed",
            defaultViz: "kpi",
            span: "third",
            data: {
              columns: [
                { key: "metric", label: "Metric", kind: "dimension" },
                { key: "value", label: "Lessons completed", kind: "measure" },
              ],
              rows: [{ metric: "Lessons completed", value: 42 }],
              measures: ["value"],
            },
          },
          {
            id: "engagement-funnel",
            title: "Learning engagement funnel (30d)",
            defaultViz: "funnel",
            span: "half",
            data: {
              columns: [
                { key: "stage", label: "Stage", kind: "dimension" },
                { key: "count", label: "Events", kind: "measure" },
              ],
              rows: [
                { stage: "Lessons completed", count: 42 },
                { stage: "Assessments submitted", count: 18 },
              ],
              dimensions: ["stage"],
              measures: ["count"],
            },
          },
          {
            id: "daily-active-users",
            title: "Daily active users (30d)",
            defaultViz: "area",
            span: "full",
            data: {
              columns: [
                { key: "period", label: "Period", kind: "date" },
                { key: "value", label: "Active users", kind: "measure" },
              ],
              rows: [{ period: "2026-08-01", value: 7 }],
              dimensions: ["period"],
              measures: ["value"],
            },
          },
        ],
      },
    });

    expect(parsed.data.slug).toBe("school-vitals");
    expect(parsed.data.alerts).toHaveLength(1);
    expect(parsed.data.widgets.map((widget) => widget.id)).toEqual([
      "lessons-completed",
      "engagement-funnel",
      "daily-active-users",
    ]);
  });

  it("accepts Learnyst-style sales insight payload with revenue and pipeline", () => {
    const parsed = insightDashboardResponseSchema.parse({
      data: {
        slug: "sales-insight",
        title: "Sales Insight",
        currency: "INR",
        alerts: [
          {
            id: "failed-payments",
            severity: "warning",
            title: "Failed payments",
            message: "2 failed payments. Recover revenue from Reports → Payments.",
            href: "/admin/reports/payments",
          },
        ],
        widgets: [
          {
            id: "revenue",
            title: "Total revenue",
            defaultViz: "kpi",
            span: "third",
            data: {
              columns: [
                { key: "metric", label: "Metric", kind: "dimension" },
                { key: "value", label: "Total revenue", kind: "measure" },
              ],
              rows: [{ metric: "Total revenue", value: 15000 }],
              measures: ["value"],
            },
          },
          {
            id: "pipeline",
            title: "Sales pipeline (all time)",
            defaultViz: "funnel",
            span: "half",
            data: {
              columns: [
                { key: "stage", label: "Stage", kind: "dimension" },
                { key: "count", label: "Leads", kind: "measure" },
              ],
              rows: [
                { stage: "Visited", count: 100 },
                { stage: "Started diagnostic", count: 40 },
                { stage: "Enrolled", count: 12 },
              ],
              dimensions: ["stage"],
              measures: ["count"],
            },
          },
        ],
      },
    });

    expect(parsed.data.slug).toBe("sales-insight");
    expect(parsed.data.currency).toBe("INR");
    expect(parsed.data.alerts).toHaveLength(1);
    expect(parsed.data.widgets[0]?.id).toBe("revenue");
    expect(parsed.data.widgets[1]?.defaultViz).toBe("funnel");
  });

  it("accepts Learnyst-style live dashboard payload with attendance widgets", () => {
    const parsed = insightDashboardResponseSchema.parse({
      data: {
        slug: "live-dashboard",
        title: "Live Dashboard",
        alerts: [
          {
            id: "live-now",
            severity: "info",
            title: "Live now",
            message: "1 session currently live.",
            href: "/admin/live-sessions",
          },
        ],
        widgets: [
          {
            id: "sessions",
            title: "Total sessions",
            defaultViz: "kpi",
            span: "third",
            data: {
              columns: [
                { key: "metric", label: "Metric", kind: "dimension" },
                { key: "value", label: "Total sessions", kind: "measure" },
              ],
              rows: [{ metric: "Total sessions", value: 12 }],
              measures: ["value"],
            },
          },
          {
            id: "daily-attendance",
            title: "Daily attendance (30d)",
            defaultViz: "line",
            span: "full",
            data: {
              columns: [
                { key: "period", label: "Period", kind: "date" },
                { key: "attended", label: "Attended", kind: "measure" },
                { key: "registered", label: "Registered", kind: "measure" },
              ],
              rows: [{ period: "2026-08-01", attended: 20, registered: 35 }],
              dimensions: ["period"],
              measures: ["attended", "registered"],
            },
          },
        ],
      },
    });

    expect(parsed.data.slug).toBe("live-dashboard");
    expect(parsed.data.alerts).toHaveLength(1);
    expect(parsed.data.widgets.map((widget) => widget.id)).toEqual([
      "sessions",
      "daily-attendance",
    ]);
  });

  it("accepts Learnyst-style marketing insight payload with attribution and forms", () => {
    const parsed = insightDashboardResponseSchema.parse({
      data: {
        slug: "marketing-insight",
        title: "Marketing Insight",
        alerts: [
          {
            id: "new-contacts",
            severity: "info",
            title: "New contacts (30d)",
            message: "15 new contacts from forms and CTAs.",
            href: "/admin/marketing/forms/contacts",
          },
        ],
        widgets: [
          {
            id: "attribution-by-source",
            title: "Attribution by source",
            defaultViz: "bar",
            span: "half",
            data: {
              columns: [
                { key: "label", label: "Source", kind: "dimension" },
                { key: "value", label: "Events", kind: "measure" },
              ],
              rows: [
                { label: "google", value: 40 },
                { label: "direct", value: 22 },
              ],
              dimensions: ["label"],
              measures: ["value"],
            },
          },
          {
            id: "top-forms",
            title: "Top forms by submissions",
            defaultViz: "table",
            span: "half",
            data: {
              columns: [
                { key: "title", label: "Form", kind: "string" },
                { key: "status", label: "Status", kind: "dimension" },
                { key: "submissions", label: "Submissions", kind: "measure" },
              ],
              rows: [{ title: "Lead magnet", status: "LIVE", submissions: 18 }],
              measures: ["submissions"],
            },
          },
        ],
      },
    });

    expect(parsed.data.slug).toBe("marketing-insight");
    expect(parsed.data.alerts).toHaveLength(1);
    expect(parsed.data.widgets[0]?.defaultViz).toBe("bar");
    expect(parsed.data.widgets[1]?.id).toBe("top-forms");
  });

  it("accepts Learnyst-style messenger insight payload with channel KPIs", () => {
    const parsed = insightDashboardResponseSchema.parse({
      data: {
        slug: "messenger-insight",
        title: "Messenger Insight",
        alerts: [
          {
            id: "whatsapp-failures",
            severity: "warning",
            title: "WhatsApp delivery failures",
            message: "12 failed WhatsApp sends across campaigns.",
            href: "/admin/insights/messenger-insight/whatsapp",
          },
        ],
        widgets: [
          {
            id: "email-sent",
            title: "Email campaigns sent",
            defaultViz: "kpi",
            span: "third",
            data: {
              columns: [
                { key: "metric", label: "Metric", kind: "dimension" },
                { key: "value", label: "Email campaigns sent", kind: "measure" },
              ],
              rows: [{ metric: "Email campaigns sent", value: 9 }],
              measures: ["value"],
            },
          },
          {
            id: "daily-volume",
            title: "Daily messaging volume (30d)",
            defaultViz: "line",
            span: "full",
            data: {
              columns: [
                { key: "period", label: "Period", kind: "date" },
                { key: "email", label: "Email reach", kind: "measure" },
                { key: "push", label: "Push reach", kind: "measure" },
              ],
              rows: [{ period: "2026-08-01", email: 120, push: 80 }],
              dimensions: ["period"],
              measures: ["email", "push"],
            },
          },
        ],
      },
    });

    expect(parsed.data.slug).toBe("messenger-insight");
    expect(parsed.data.alerts).toHaveLength(1);
    expect(parsed.data.widgets.map((widget) => widget.id)).toEqual(["email-sent", "daily-volume"]);
  });
});
