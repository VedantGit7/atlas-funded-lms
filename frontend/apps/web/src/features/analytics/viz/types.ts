export type VizType =
  | "kpi"
  | "table"
  | "pivot"
  | "line"
  | "area"
  | "bar"
  | "combo"
  | "pie"
  | "donut"
  | "funnel"
  | "progress"
  | "scatter"
  | "heatmap"
  | "sparkline";

export type NormalizedColumnKind = "dimension" | "measure" | "string" | "number" | "date";

export type NormalizedColumn = {
  key: string;
  label: string;
  kind: NormalizedColumnKind;
};

export type NormalizedRow = Record<string, string | number | null>;

export type NormalizedSeries = {
  key: string;
  label: string;
};

export type NormalizedResult = {
  columns: NormalizedColumn[];
  rows: NormalizedRow[];
  dimensions?: string[] | undefined;
  measures?: string[] | undefined;
  series?: NormalizedSeries[] | undefined;
};

export const ALL_VIZ_TYPES: VizType[] = [
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
];

export const VIZ_TYPE_LABELS: Record<VizType, string> = {
  kpi: "KPI",
  table: "Table",
  pivot: "Pivot",
  line: "Line",
  area: "Area",
  bar: "Bar",
  combo: "Combo",
  pie: "Pie",
  donut: "Donut",
  funnel: "Funnel",
  progress: "Progress",
  scatter: "Scatter",
  heatmap: "Heatmap",
  sparkline: "Sparkline",
};
