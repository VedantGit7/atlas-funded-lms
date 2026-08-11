import { describe, expect, it } from "vitest";
import {
  buildLibraryItem,
  categorizeLibraryWidget,
  filterLibraryItems,
} from "../../../backend/apps/api/src/server/insights/insights-library";
import { setLayoutWidgetsHidden } from "../../../backend/apps/api/src/server/insights/insights-layout";
import { insightLibraryResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

const kpiWidget = {
  id: "revenue",
  title: "Revenue",
  defaultViz: "kpi" as const,
  span: "third" as const,
  deltaPct: 12.4,
  sparkline: [1, 2, 4],
  data: {
    columns: [
      { key: "metric", kind: "dimension" },
      { key: "value", kind: "measure" },
    ],
    rows: [{ metric: "Revenue", value: 18400 }],
    measures: ["value"],
  },
};

describe("insight widget library", () => {
  it("categorizes revenue and learning widgets", () => {
    expect(categorizeLibraryWidget("monthly-revenue")).toBe("revenue");
    expect(categorizeLibraryWidget("lessons-completed")).toBe("learning");
    expect(categorizeLibraryWidget("daily-attendance")).toBe("live");
  });

  it("builds a library card with a KPI preview and addable flag", () => {
    const item = buildLibraryItem({
      widget: kpiWidget,
      sourceSlug: "dashboard",
      sourceTitle: "Dashboard",
      targetHasWidget: true,
      onTarget: false,
    });
    expect(item.category).toBe("revenue");
    expect(item.preview.kind).toBe("kpi");
    expect(item.preview.value).toBe(18400);
    expect(item.preview.money).toBe(true);
    expect(item.addable).toBe(true);
    expect(item.onTarget).toBe(false);
  });

  it("filters by query, category, and on-dashboard state", () => {
    const revenue = buildLibraryItem({
      widget: kpiWidget,
      sourceSlug: "dashboard",
      sourceTitle: "Dashboard",
      targetHasWidget: true,
      onTarget: true,
    });
    const learners = buildLibraryItem({
      widget: { ...kpiWidget, id: "learners", title: "Learners" },
      sourceSlug: "dashboard",
      sourceTitle: "Dashboard",
      targetHasWidget: true,
      onTarget: false,
    });
    expect(filterLibraryItems([revenue, learners], { query: "learn" })).toEqual([learners]);
    expect(filterLibraryItems([revenue, learners], { category: "revenue" })).toEqual([revenue]);
    expect(filterLibraryItems([revenue, learners], { onDashboard: "hide" })).toEqual([learners]);
  });

  it("unhides selected widgets on the target layout", () => {
    const layout = {
      density: "comfortable" as const,
      sharing: "private" as const,
      widgets: [
        { id: "revenue", hidden: true, span: "third" as const, viz: "kpi" as const, order: 0 },
        { id: "learners", hidden: false, span: "third" as const, viz: "kpi" as const, order: 1 },
      ],
    };
    const next = setLayoutWidgetsHidden(layout, ["revenue"], false);
    expect(next.widgets.find((entry) => entry.id === "revenue")?.hidden).toBe(false);
    expect(next.widgets.find((entry) => entry.id === "learners")?.hidden).toBe(false);
  });

  it("parses a library board response", () => {
    const item = buildLibraryItem({
      widget: kpiWidget,
      sourceSlug: "dashboard",
      sourceTitle: "Dashboard",
      targetHasWidget: true,
      onTarget: false,
    });
    const parsed = insightLibraryResponseSchema.parse({
      data: {
        slug: "dashboard",
        title: "Dashboard",
        targetSlug: "dashboard",
        targetTitle: "Dashboard",
        generatedAt: "2026-08-11T12:00:00.000Z",
        range: "12m",
        sections: [{ slug: "dashboard", title: "Dashboard" }],
        categories: [{ id: "revenue", label: "Revenue" }],
        items: [item],
      },
    });
    expect(parsed.data.items).toHaveLength(1);
    expect(parsed.data.items[0]?.id).toBe("revenue");
  });
});
