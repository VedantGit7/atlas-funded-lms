import { VIZ_TYPE_LABELS, type VizType } from "../../analytics/viz";
import type { InsightLayout, InsightLayoutCatalogItem, InsightWidget } from "./admin-insights-api";

export function layoutDraftStorageKey(slug: string): string {
  return `atlas.insights.layout-draft:${slug}`;
}

export function readLayoutDraft(slug: string): InsightLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(layoutDraftStorageKey(slug));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as InsightLayout;
    if (!Array.isArray(record.widgets)) return null;
    return record;
  } catch {
    return null;
  }
}

export function writeLayoutDraft(slug: string, layout: InsightLayout): void {
  window.sessionStorage.setItem(layoutDraftStorageKey(slug), JSON.stringify(layout));
}

export function clearLayoutDraft(slug: string): void {
  window.sessionStorage.removeItem(layoutDraftStorageKey(slug));
}

export function layoutsEqual(left: InsightLayout, right: InsightLayout): boolean {
  return JSON.stringify(normalizeLayout(left)) === JSON.stringify(normalizeLayout(right));
}

function normalizeLayout(layout: InsightLayout): unknown {
  return {
    density: layout.density,
    sharing: layout.sharing,
    widgets: [...layout.widgets]
      .sort((left, right) => left.order - right.order)
      .map((entry) => ({
        id: entry.id,
        hidden: entry.hidden,
        span: entry.span,
        viz: entry.viz,
      })),
  };
}

export function applyInsightLayout<T extends Pick<InsightWidget, "id" | "span" | "defaultViz">>(
  widgets: T[],
  layout: InsightLayout,
): T[] {
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));
  const result: T[] = [];
  for (const entry of [...layout.widgets].sort((left, right) => left.order - right.order)) {
    if (entry.hidden) continue;
    const widget = byId.get(entry.id);
    if (!widget) continue;
    result.push({
      ...widget,
      span: entry.span,
      defaultViz: entry.viz,
    });
  }
  return result;
}

export function catalogById(
  catalog: InsightLayoutCatalogItem[],
): Map<string, InsightLayoutCatalogItem> {
  return new Map(catalog.map((item) => [item.id, item]));
}

export function isKpiCatalogItem(item: InsightLayoutCatalogItem | undefined): boolean {
  return item?.defaultViz === "kpi";
}

export function vizLabel(viz: VizType): string {
  return VIZ_TYPE_LABELS[viz];
}

export function summarizeDraft(
  layout: InsightLayout,
  catalog: InsightLayoutCatalogItem[],
): { widgets: number; hidden: number; kpis: number } {
  const byId = catalogById(catalog);
  let widgets = 0;
  let hidden = 0;
  let kpis = 0;
  for (const entry of layout.widgets) {
    const item = byId.get(entry.id);
    if (!item) continue;
    if (entry.hidden) {
      hidden += 1;
      continue;
    }
    widgets += 1;
    if (item.defaultViz === "kpi") kpis += 1;
  }
  return { widgets, hidden, kpis };
}

export function countVizOverrides(draft: InsightLayout, factory: InsightLayout): number {
  const factoryById = new Map(factory.widgets.map((entry) => [entry.id, entry]));
  let count = 0;
  for (const entry of draft.widgets) {
    const original = factoryById.get(entry.id);
    if (!original) continue;
    if (entry.viz !== original.viz) count += 1;
  }
  return count;
}

export function catalogKindCounts(catalog: InsightLayoutCatalogItem[]): {
  kpis: number;
  charts: number;
} {
  let kpis = 0;
  let charts = 0;
  for (const item of catalog) {
    if (item.defaultViz === "kpi") kpis += 1;
    else charts += 1;
  }
  return { kpis, charts };
}

export function moveLayoutWidget(
  layout: InsightLayout,
  id: string,
  targetId: string,
): InsightLayout {
  if (id === targetId) return layout;
  const widgets = [...layout.widgets].sort((left, right) => left.order - right.order);
  const fromIndex = widgets.findIndex((entry) => entry.id === id);
  const toIndex = widgets.findIndex((entry) => entry.id === targetId);
  if (fromIndex < 0 || toIndex < 0) return layout;
  const [moved] = widgets.splice(fromIndex, 1);
  if (!moved) return layout;
  widgets.splice(toIndex, 0, moved);
  return {
    ...layout,
    widgets: widgets.map((entry, index) => ({ ...entry, order: index })),
  };
}

export function shiftLayoutWidget(
  layout: InsightLayout,
  id: string,
  ids: string[],
  direction: -1 | 1,
): InsightLayout {
  const index = ids.indexOf(id);
  const swapWith = ids[index + direction];
  if (!swapWith) return layout;
  return moveLayoutWidget(layout, id, swapWith);
}

export function patchLayoutWidget(
  layout: InsightLayout,
  id: string,
  patch: Partial<Pick<InsightLayout["widgets"][number], "hidden" | "span" | "viz">>,
): InsightLayout {
  return {
    ...layout,
    widgets: layout.widgets.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
  };
}

export const INSIGHT_SPAN_OPTIONS = [
  { value: "full", label: "Full" },
  { value: "half", label: "Half" },
  { value: "third", label: "Third" },
] as const;

export function widgetEditorSpanClass(span: InsightWidget["span"]): string {
  if (span === "full") return "col-span-6";
  if (span === "third") return "col-span-6 md:col-span-2";
  return "col-span-6 md:col-span-3";
}
