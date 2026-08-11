import { describe, expect, it } from "vitest";
import {
  applyInsightLayoutMutation,
  applyLayoutToWidgets,
  catalogKindCounts,
  countVizOverrides,
  emptyInsightLayoutState,
  factoryLayout,
  layoutsEqual,
  mergeLayoutWithCatalog,
  parseInsightLayoutState,
  resolveStoredLayout,
  summarizeLayout,
  type InsightLayoutCatalogItem,
} from "../../../backend/apps/api/src/server/insights/insights-layout";
import { insightLayoutResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

const CATALOG: InsightLayoutCatalogItem[] = [
  { id: "revenue", title: "Revenue", defaultViz: "kpi", span: "third" },
  { id: "learners", title: "Learners", defaultViz: "kpi", span: "third" },
  { id: "monthly-revenue", title: "Monthly Revenue", defaultViz: "line", span: "full" },
  { id: "top-products", title: "Top products", defaultViz: "table", span: "half" },
  { id: "pending-tasks", title: "Pending tasks", defaultViz: "kpi", span: "third" },
];

describe("insight dashboard layout", () => {
  it("hides non-primary dashboard widgets in the factory layout", () => {
    const layout = factoryLayout("dashboard", CATALOG);
    const pending = layout.widgets.find((entry) => entry.id === "pending-tasks");
    const revenue = layout.widgets.find((entry) => entry.id === "revenue");
    expect(pending?.hidden).toBe(true);
    expect(revenue?.hidden).toBe(false);
    expect(summarizeLayout(layout, CATALOG)).toEqual({ widgets: 4, hidden: 1, kpis: 2 });
  });

  it("applies order, span, and viz and skips hidden widgets", () => {
    const layout = factoryLayout("dashboard", CATALOG);
    const monthly = layout.widgets.find((entry) => entry.id === "monthly-revenue");
    if (monthly) {
      monthly.span = "half";
      monthly.viz = "bar";
    }
    const widgets = applyLayoutToWidgets(
      CATALOG.map((item) => ({ ...item })),
      layout,
    );
    expect(widgets.map((widget) => widget.id)).toEqual([
      "revenue",
      "learners",
      "monthly-revenue",
      "top-products",
    ]);
    expect(widgets.find((widget) => widget.id === "monthly-revenue")?.span).toBe("half");
    expect(widgets.find((widget) => widget.id === "monthly-revenue")?.defaultViz).toBe("bar");
  });

  it("lets a private layout override the tenant default", () => {
    const factory = factoryLayout("dashboard", CATALOG);
    const tenantLayout = { ...factory, sharing: "tenant" as const };
    const personal = {
      ...factory,
      sharing: "private" as const,
      widgets: factory.widgets.map((entry) =>
        entry.id === "learners" ? { ...entry, hidden: true } : entry,
      ),
    };
    const state = parseInsightLayoutState({
      tenant: { dashboard: tenantLayout },
      members: { "mem-1": { dashboard: personal } },
    });
    const resolved = mergeLayoutWithCatalog(
      resolveStoredLayout(state, "dashboard", "mem-1"),
      CATALOG,
      "dashboard",
    );
    expect(resolved.sharing).toBe("private");
    expect(resolved.widgets.find((entry) => entry.id === "learners")?.hidden).toBe(true);
  });

  it("resets a private layout back to factory defaults", () => {
    const factory = factoryLayout("dashboard", CATALOG);
    const personal = {
      ...factory,
      widgets: factory.widgets.map((entry) => ({ ...entry, hidden: true })),
    };
    const saved = applyInsightLayoutMutation({
      state: emptyInsightLayoutState(),
      membershipId: "mem-1",
      slug: "dashboard",
      catalog: CATALOG,
      action: { type: "save", layout: personal },
    });
    expect(layoutsEqual(saved.layout, factory)).toBe(false);

    const reset = applyInsightLayoutMutation({
      state: saved.state,
      membershipId: "mem-1",
      slug: "dashboard",
      catalog: CATALOG,
      action: { type: "reset" },
    });
    expect(layoutsEqual(reset.layout, factory)).toBe(true);
    expect(resolveStoredLayout(reset.state, "dashboard", "mem-1")).toBeNull();
  });

  it("parses a layout board response", () => {
    const layout = factoryLayout("dashboard", CATALOG);
    const parsed = insightLayoutResponseSchema.parse({
      data: {
        slug: "dashboard",
        title: "Dashboard",
        generatedAt: "2026-08-11T12:00:00.000Z",
        layout,
        factory: layout,
        catalog: CATALOG,
        summary: { widgets: 4, hidden: 1, kpis: 2 },
        copyTargets: [{ slug: "school-vitals", title: "School Vitals" }],
      },
    });
    expect(parsed.data.catalog).toHaveLength(5);
    expect(parsed.data.layout.density).toBe("comfortable");
  });

  it("counts personal visualization overrides against the factory layout", () => {
    const factory = factoryLayout("school-vitals", CATALOG);
    const draft = {
      ...factory,
      widgets: factory.widgets.map((entry) =>
        entry.id === "monthly-revenue" ? { ...entry, viz: "bar" as const } : entry,
      ),
    };
    expect(countVizOverrides(factory, factory)).toBe(0);
    expect(countVizOverrides(draft, factory)).toBe(1);
    expect(catalogKindCounts(CATALOG)).toEqual({ kpis: 3, charts: 2 });
    expect(JSON.stringify(draft)).not.toContain("At-Risk Cohorts");
    expect(JSON.stringify(draft)).not.toContain("Course Completion Velocity");
  });
});
