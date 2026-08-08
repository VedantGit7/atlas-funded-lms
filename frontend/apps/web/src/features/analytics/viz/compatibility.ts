import type { NormalizedResult, VizType } from "./types";

function hasDimension(data: NormalizedResult): boolean {
  return (
    (data.dimensions?.length ?? 0) > 0 ||
    data.columns.some((column) => column.kind === "dimension" || column.kind === "string" || column.kind === "date")
  );
}

function hasMeasure(data: NormalizedResult): boolean {
  return (
    (data.measures?.length ?? 0) > 0 ||
    data.columns.some((column) => column.kind === "measure" || column.kind === "number")
  );
}

function rowCount(data: NormalizedResult): number {
  return data.rows.length;
}

function columnCount(data: NormalizedResult): number {
  return data.columns.length;
}

export function getCompatibleVizTypes(data: NormalizedResult): VizType[] {
  if (data.rows.length === 0) {
    return ["table", "kpi"];
  }

  const compatible: VizType[] = ["table"];

  if (hasMeasure(data)) {
    compatible.push("kpi");
  }

  if (hasDimension(data) && hasMeasure(data)) {
    compatible.push("pivot", "bar", "pie", "donut", "funnel", "progress");

    if (rowCount(data) >= 2) {
      compatible.push("line", "area", "combo", "sparkline");
    }

    if (rowCount(data) >= 3) {
      compatible.push("scatter");
    }
  }

  if (rowCount(data) >= 2 && columnCount(data) >= 3 && hasMeasure(data)) {
    compatible.push("heatmap");
  }

  return compatible;
}

export function resolveDefaultVizType(data: NormalizedResult, preferred?: VizType): VizType {
  const compatible = getCompatibleVizTypes(data);
  if (preferred && compatible.includes(preferred)) {
    return preferred;
  }
  if (compatible.includes("bar")) return "bar";
  if (compatible.includes("line")) return "line";
  if (compatible.includes("kpi")) return "kpi";
  return compatible[0] ?? "table";
}
