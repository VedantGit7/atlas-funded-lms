export const DASHBOARD_PRIMARY_WIDGET_IDS = [
  "revenue",
  "products",
  "learners",
  "current-mau",
  "active-users-30d",
  "enrollments",
  "monthly-revenue",
  "monthly-enrollments",
  "top-products",
  "payment-orders",
  "failed-payments",
] as const;

export const INSIGHT_VIZ_TYPES = [
  "kpi",
  "table",
  "pivot",
  "line",
  "area",
  "bar",
  "combo",
  "pie",
  "donut",
  "funnel",
  "progress",
  "scatter",
  "heatmap",
  "sparkline",
] as const;

export type InsightVizType = (typeof INSIGHT_VIZ_TYPES)[number];
export type InsightWidgetSpan = "full" | "half" | "third";
export type InsightLayoutDensity = "comfortable" | "compact";
export type InsightLayoutSharing = "private" | "tenant";

export type InsightLayoutWidget = {
  id: string;
  hidden: boolean;
  span: InsightWidgetSpan;
  viz: InsightVizType;
  order: number;
};

export type InsightLayout = {
  density: InsightLayoutDensity;
  sharing: InsightLayoutSharing;
  widgets: InsightLayoutWidget[];
};

export type InsightLayoutCatalogItem = {
  id: string;
  title: string;
  defaultViz: InsightVizType;
  span: InsightWidgetSpan;
};

export type InsightLayoutState = {
  tenant: Record<string, InsightLayout>;
  members: Record<string, Record<string, InsightLayout>>;
};

export type InsightLayoutMutation =
  | { type: "save"; layout: InsightLayout }
  | { type: "reset" }
  | {
      type: "copy";
      layout: InsightLayout;
      targetSlug: string;
      targetCatalog: InsightLayoutCatalogItem[];
    };

const VIZ_SET = new Set<string>(INSIGHT_VIZ_TYPES);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isViz(value: unknown): value is InsightVizType {
  return typeof value === "string" && VIZ_SET.has(value);
}

export function emptyInsightLayoutState(): InsightLayoutState {
  return { tenant: {}, members: {} };
}

export function allowedVizFor(defaultViz: InsightVizType): InsightVizType[] {
  switch (defaultViz) {
    case "kpi":
      return ["kpi"];
    case "line":
    case "area":
    case "sparkline":
      return ["line", "area", "bar", "sparkline"];
    case "bar":
    case "combo":
      return ["bar", "line", "area", "combo"];
    case "pie":
    case "donut":
      return ["pie", "donut", "bar"];
    case "funnel":
      return ["funnel", "bar"];
    case "table":
    case "pivot":
    case "heatmap":
      return ["table", "bar"];
    case "progress":
      return ["progress", "bar"];
    case "scatter":
      return ["scatter"];
    default:
      return [defaultViz];
  }
}

export function widgetsToCatalog(
  widgets: Array<{
    id: string;
    title: string;
    defaultViz: InsightVizType;
    span: InsightWidgetSpan;
  }>,
): InsightLayoutCatalogItem[] {
  return widgets.map((widget) => ({
    id: widget.id,
    title: widget.title,
    defaultViz: widget.defaultViz,
    span: widget.span,
  }));
}

export function factoryLayout(slug: string, catalog: InsightLayoutCatalogItem[]): InsightLayout {
  const primary = new Set<string>(DASHBOARD_PRIMARY_WIDGET_IDS);
  return {
    density: "comfortable",
    sharing: "private",
    widgets: catalog.map((item, index) => ({
      id: item.id,
      hidden: slug === "dashboard" && !primary.has(item.id),
      span: item.span,
      viz: item.defaultViz,
      order: index,
    })),
  };
}

export function parseInsightLayout(value: unknown): InsightLayout | null {
  const record = asRecord(value);
  if (!record) return null;
  const widgetsRaw = record["widgets"];
  if (!Array.isArray(widgetsRaw)) return null;
  const widgets: InsightLayoutWidget[] = [];
  for (const item of widgetsRaw) {
    const row = asRecord(item);
    if (!row) continue;
    const id = row["id"];
    if (typeof id !== "string" || id.length === 0) continue;
    const span = row["span"];
    const viz = row["viz"];
    const order = row["order"];
    widgets.push({
      id,
      hidden: row["hidden"] === true,
      span: span === "full" || span === "third" ? span : "half",
      viz: isViz(viz) ? viz : "bar",
      order: typeof order === "number" && Number.isFinite(order) ? order : widgets.length,
    });
  }
  return {
    density: record["density"] === "compact" ? "compact" : "comfortable",
    sharing: record["sharing"] === "tenant" ? "tenant" : "private",
    widgets,
  };
}

export function parseInsightLayoutState(value: unknown): InsightLayoutState {
  const record = asRecord(value);
  if (!record) return emptyInsightLayoutState();
  const tenant: Record<string, InsightLayout> = {};
  const tenantRaw = asRecord(record["tenant"]);
  if (tenantRaw) {
    for (const [slug, entry] of Object.entries(tenantRaw)) {
      const parsed = parseInsightLayout(entry);
      if (parsed) tenant[slug] = parsed;
    }
  }
  const members: Record<string, Record<string, InsightLayout>> = {};
  const membersRaw = asRecord(record["members"]);
  if (membersRaw) {
    for (const [membershipId, layoutsRaw] of Object.entries(membersRaw)) {
      const layoutsRecord = asRecord(layoutsRaw);
      if (!layoutsRecord) continue;
      const layouts: Record<string, InsightLayout> = {};
      for (const [slug, entry] of Object.entries(layoutsRecord)) {
        const parsed = parseInsightLayout(entry);
        if (parsed) layouts[slug] = parsed;
      }
      if (Object.keys(layouts).length > 0) members[membershipId] = layouts;
    }
  }
  return { tenant, members };
}

export function resolveStoredLayout(
  state: InsightLayoutState,
  slug: string,
  membershipId: string,
): InsightLayout | null {
  const memberLayouts = state["members"][membershipId];
  const personal = memberLayouts ? memberLayouts[slug] : undefined;
  if (personal) return { ...personal, sharing: "private" };
  const tenant = state["tenant"][slug];
  if (tenant) return { ...tenant, sharing: "tenant" };
  return null;
}

export function mergeLayoutWithCatalog(
  layout: InsightLayout | null,
  catalog: InsightLayoutCatalogItem[],
  slug: string,
): InsightLayout {
  const factory = factoryLayout(slug, catalog);
  if (!layout) return factory;
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const widgets: InsightLayoutWidget[] = [];
  const seen = new Set<string>();
  for (const entry of [...layout.widgets].sort((a, b) => a.order - b.order)) {
    const item = catalogById.get(entry.id);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    const allowed = allowedVizFor(item.defaultViz);
    widgets.push({
      id: item.id,
      hidden: entry.hidden,
      span: item.defaultViz === "kpi" ? item.span : entry.span,
      viz: allowed.includes(entry.viz) ? entry.viz : item.defaultViz,
      order: widgets.length,
    });
  }
  for (const factoryEntry of factory.widgets) {
    if (seen.has(factoryEntry.id)) continue;
    widgets.push({ ...factoryEntry, order: widgets.length });
  }
  return {
    density: layout.density === "compact" ? "compact" : "comfortable",
    sharing: layout.sharing === "tenant" ? "tenant" : "private",
    widgets,
  };
}

export function applyLayoutToWidgets<
  T extends { id: string; span: InsightWidgetSpan; defaultViz: InsightVizType },
>(widgets: T[], layout: InsightLayout): T[] {
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));
  const result: T[] = [];
  for (const entry of [...layout.widgets].sort((a, b) => a.order - b.order)) {
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

export function summarizeLayout(
  layout: InsightLayout,
  catalog: InsightLayoutCatalogItem[],
): { widgets: number; hidden: number; kpis: number } {
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  let widgets = 0;
  let hidden = 0;
  let kpis = 0;
  for (const entry of layout.widgets) {
    const item = catalogById.get(entry.id);
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

export function layoutsEqual(left: InsightLayout, right: InsightLayout): boolean {
  return JSON.stringify(normalizeLayout(left)) === JSON.stringify(normalizeLayout(right));
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

export function copyLayoutOntoCatalog(
  source: InsightLayout,
  targetCatalog: InsightLayoutCatalogItem[],
  targetSlug: string,
): InsightLayout {
  const byId = new Map(source.widgets.map((entry) => [entry.id, entry]));
  const factory = factoryLayout(targetSlug, targetCatalog);
  return {
    density: source.density,
    sharing: source.sharing,
    widgets: factory.widgets.map((entry, index) => {
      const copied = byId.get(entry.id);
      if (!copied) return { ...entry, order: index };
      const item = targetCatalog.find((row) => row.id === entry.id);
      const allowed = item ? allowedVizFor(item.defaultViz) : [entry.viz];
      return {
        id: entry.id,
        hidden: copied.hidden,
        span: item?.defaultViz === "kpi" ? entry.span : copied.span,
        viz: allowed.includes(copied.viz) ? copied.viz : entry.viz,
        order: index,
      };
    }),
  };
}

function cloneState(state: InsightLayoutState): InsightLayoutState {
  return JSON.parse(JSON.stringify(state)) as InsightLayoutState;
}

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [entryKey, value] of Object.entries(record)) {
    if (entryKey !== key) next[entryKey] = value;
  }
  return next;
}

function writeMemberLayouts(
  members: Record<string, Record<string, InsightLayout>>,
  membershipId: string,
  layouts: Record<string, InsightLayout>,
): Record<string, Record<string, InsightLayout>> {
  if (Object.keys(layouts).length === 0) {
    return omitKey(members, membershipId);
  }
  return { ...members, [membershipId]: layouts };
}

function writeLayout(
  state: InsightLayoutState,
  membershipId: string,
  slug: string,
  layout: InsightLayout,
): InsightLayoutState {
  const next = cloneState(state);
  if (layout.sharing === "tenant") {
    next["tenant"][slug] = layout;
    const memberLayouts = next["members"][membershipId];
    if (memberLayouts) {
      next["members"] = writeMemberLayouts(
        next["members"],
        membershipId,
        omitKey(memberLayouts, slug),
      );
    }
    return next;
  }
  const existing = next["members"][membershipId] ?? {};
  next["members"][membershipId] = { ...existing, [slug]: layout };
  return next;
}

function deleteLayout(
  state: InsightLayoutState,
  membershipId: string,
  slug: string,
  sharing: InsightLayoutSharing,
): InsightLayoutState {
  const next = cloneState(state);
  if (sharing === "tenant") {
    next["tenant"] = omitKey(next["tenant"], slug);
    return next;
  }
  const memberLayouts = next["members"][membershipId];
  if (!memberLayouts) return next;
  next["members"] = writeMemberLayouts(next["members"], membershipId, omitKey(memberLayouts, slug));
  return next;
}

export function setLayoutWidgetsHidden(
  layout: InsightLayout,
  ids: string[],
  hidden: boolean,
): InsightLayout {
  const idSet = new Set(ids);
  return {
    ...layout,
    widgets: layout.widgets.map((entry) => (idSet.has(entry.id) ? { ...entry, hidden } : entry)),
  };
}

export function applyInsightLayoutMutation(args: {
  state: InsightLayoutState;
  membershipId: string;
  slug: string;
  catalog: InsightLayoutCatalogItem[];
  action: InsightLayoutMutation;
}): { state: InsightLayoutState; layout: InsightLayout } {
  if (args.action.type === "reset") {
    const current = mergeLayoutWithCatalog(
      resolveStoredLayout(args.state, args.slug, args.membershipId),
      args.catalog,
      args.slug,
    );
    const nextState = deleteLayout(args.state, args.membershipId, args.slug, current.sharing);
    return {
      state: nextState,
      layout: mergeLayoutWithCatalog(null, args.catalog, args.slug),
    };
  }

  if (args.action.type === "copy") {
    const copied = mergeLayoutWithCatalog(
      copyLayoutOntoCatalog(args.action.layout, args.action.targetCatalog, args.action.targetSlug),
      args.action.targetCatalog,
      args.action.targetSlug,
    );
    const nextState = writeLayout(args.state, args.membershipId, args.action.targetSlug, copied);
    return {
      state: nextState,
      layout: mergeLayoutWithCatalog(
        resolveStoredLayout(nextState, args.slug, args.membershipId),
        args.catalog,
        args.slug,
      ),
    };
  }

  const saved = mergeLayoutWithCatalog(args.action.layout, args.catalog, args.slug);
  const nextState = writeLayout(args.state, args.membershipId, args.slug, saved);
  return { state: nextState, layout: saved };
}
