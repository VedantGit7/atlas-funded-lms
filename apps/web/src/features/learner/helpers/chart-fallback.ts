export type ChartPoint = {
  label: string;
  value: string;
};

export function buildChartTableFallback(points: ChartPoint[]): {
  mode: "table";
  headers: string[];
  rows: string[][];
} {
  return {
    mode: "table",
    headers: ["Label", "Value"],
    rows: points.map((point) => [point.label, point.value]),
  };
}

export function shouldUseChartTableFallback(
  preferReducedMotion: boolean,
  pointCount: number,
): boolean {
  return preferReducedMotion || pointCount === 0;
}
