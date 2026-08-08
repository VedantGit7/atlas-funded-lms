"use client";

import type { NormalizedResult } from "./types";
import {
  analyticsChartPanelClassName,
  analyticsEmptyStateClassName,
  analyticsMetricLabelClassName,
  analyticsMetricValueClassName,
  analyticsTableHeadClassName,
  analyticsTableRowClassName,
  analyticsTableShellClassName,
  chartFill,
  chartGridStroke,
  chartLineStroke,
} from "../analytics-admin-shared";
import { aggregatePivot, firstMeasureLabel, firstMeasureValue } from "./normalize";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 220;
const CHART_PADDING = 20;

type ChartCommonProps = {
  data: NormalizedResult;
};

function resolveAxes(data: NormalizedResult): {
  dimensionKey: string;
  measureKey: string;
  dimensionLabel: string;
  measureLabel: string;
} | null {
  const dimensionKey =
    data.dimensions?.[0] ??
    data.columns.find((column) => column.kind === "dimension" || column.kind === "string" || column.kind === "date")?.key;
  const measureKey =
    data.measures?.[0] ??
    data.columns.find((column) => column.kind === "measure" || column.kind === "number")?.key;

  if (!dimensionKey || !measureKey) return null;

  return {
    dimensionKey,
    measureKey,
    dimensionLabel: data.columns.find((column) => column.key === dimensionKey)?.label ?? dimensionKey,
    measureLabel: data.columns.find((column) => column.key === measureKey)?.label ?? measureKey,
  };
}

function numericValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function ChartEmpty({ message }: { message: string }) {
  return <div className={analyticsEmptyStateClassName}>{message}</div>;
}

export function KpiView({ data }: ChartCommonProps) {
  const value = firstMeasureValue(data);
  const label = firstMeasureLabel(data);

  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center py-6 text-center">
      <p className={analyticsMetricLabelClassName}>{label}</p>
      <p className={`${analyticsMetricValueClassName} mt-2`}>
        {value == null ? "—" : formatNumber(value)}
      </p>
    </div>
  );
}

export function TableView({ data }: ChartCommonProps) {
  if (data.rows.length === 0) {
    return <ChartEmpty message="No rows to display." />;
  }

  return (
    <div className={analyticsTableShellClassName}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              {data.columns.map((column) => (
                <th key={column.key} className={`${analyticsTableHeadClassName} px-4 py-3`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, index) => (
              <tr key={index} className={analyticsTableRowClassName}>
                {data.columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-[var(--admin-on-surface)]">
                    {row[column.key] == null ? "—" : String(row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PivotView({ data }: ChartCommonProps) {
  return <TableView data={aggregatePivot(data)} />;
}

function GridLines() {
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = CHART_PADDING + (CHART_HEIGHT - CHART_PADDING * 2) * ratio;
    return (
      <line
        key={ratio}
        x1={0}
        x2={CHART_WIDTH}
        y1={y}
        y2={y}
        stroke={chartGridStroke}
        strokeDasharray={ratio === 1 ? undefined : "4"}
      />
    );
  });
}

function buildSeriesPoints(data: NormalizedResult) {
  const axes = resolveAxes(data);
  if (!axes) return null;

  const maxValue = Math.max(...data.rows.map((row) => numericValue(row[axes.measureKey])), 1);
  const innerWidth = CHART_WIDTH - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;

  return data.rows.map((row, index) => {
    const x =
      CHART_PADDING +
      (data.rows.length === 1 ? innerWidth / 2 : (index / Math.max(data.rows.length - 1, 1)) * innerWidth);
    const value = numericValue(row[axes.measureKey]);
    const y = CHART_PADDING + innerHeight - (value / maxValue) * innerHeight;
    return {
      x,
      y,
      value,
      label: String(row[axes.dimensionKey] ?? ""),
    };
  });
}

function buildLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const only = points[0]!;
    return `M ${only.x} ${only.y}`;
  }
  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]!;
    const current = points[index]!;
    const cx = (prev.x + current.x) / 2;
    path += ` C ${cx} ${prev.y}, ${cx} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

export function LineChartView({ data }: ChartCommonProps) {
  const points = buildSeriesPoints(data);
  if (!points || points.length === 0) return <ChartEmpty message="Need a dimension and measure for line charts." />;

  const linePath = buildLinePath(points);
  const lastX = points[points.length - 1]!.x;
  const areaPath = `${linePath} L ${lastX} ${CHART_HEIGHT - CHART_PADDING} L ${CHART_PADDING} ${CHART_HEIGHT - CHART_PADDING} Z`;

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 24}`} className="h-64 w-full" role="img" aria-label="Line chart">
      <GridLines />
      <path d={areaPath} fill={chartFill} />
      <path d={linePath} fill="none" stroke={chartLineStroke} strokeWidth={2.5} strokeLinecap="round" />
      {points.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          <circle cx={point.x} cy={point.y} r={3} fill={chartLineStroke} />
          {(points.length <= 8 || index === 0 || index === points.length - 1) && (
            <text x={point.x} y={CHART_HEIGHT + 16} textAnchor="middle" fill="var(--admin-on-surface-variant)" fontSize={10}>
              {point.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function AreaChartView({ data }: ChartCommonProps) {
  const points = buildSeriesPoints(data);
  if (!points || points.length === 0) return <ChartEmpty message="Need a dimension and measure for area charts." />;

  const linePath = buildLinePath(points);
  const baselineY = CHART_HEIGHT - CHART_PADDING;
  const firstX = points[0]!.x;
  const lastX = points[points.length - 1]!.x;
  const areaPath = `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 24}`} className="h-64 w-full" role="img" aria-label="Area chart">
      <GridLines />
      <path d={areaPath} fill={chartFill} stroke={chartLineStroke} strokeWidth={1} strokeOpacity={0.35} />
      {points.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          {(points.length <= 8 || index === 0 || index === points.length - 1) && (
            <text x={point.x} y={CHART_HEIGHT + 16} textAnchor="middle" fill="var(--admin-on-surface-variant)" fontSize={10}>
              {point.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function BarChartView({ data }: ChartCommonProps) {
  const points = buildSeriesPoints(data);
  if (!points || points.length === 0) return <ChartEmpty message="Need a dimension and measure for bar charts." />;

  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const barWidth = Math.min(48, (CHART_WIDTH - CHART_PADDING * 2) / Math.max(points.length, 1) - 8);

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 24}`} className="h-64 w-full" role="img" aria-label="Bar chart">
      <GridLines />
      {points.map((point, index) => {
        const barHeight = ((point.value / maxValue) * (CHART_HEIGHT - CHART_PADDING * 2));
        const x = point.x - barWidth / 2;
        const y = CHART_HEIGHT - CHART_PADDING - barHeight;
        return (
          <g key={`${point.label}-${index}`}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={4} fill={chartLineStroke} opacity={0.85} />
            <text x={point.x} y={CHART_HEIGHT + 16} textAnchor="middle" fill="var(--admin-on-surface-variant)" fontSize={10}>
              {point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ComboChartView({ data }: ChartCommonProps) {
  return (
    <div className="space-y-2">
      <BarChartView data={data} />
      <LineChartView data={data} />
    </div>
  );
}

export function PieChartView({ data, donut = false }: ChartCommonProps & { donut?: boolean }) {
  const axes = resolveAxes(data);
  if (!axes) return <ChartEmpty message="Need a dimension and measure for pie charts." />;

  const values = data.rows.map((row) => ({
    label: String(row[axes.dimensionKey] ?? ""),
    value: numericValue(row[axes.measureKey]),
  }));
  const total = values.reduce((sum, entry) => sum + entry.value, 0) || 1;
  const cx = 160;
  const cy = 120;
  const radius = 88;
  const innerRadius = donut ? 52 : 0;

  let cursor = -Math.PI / 2;
  const slices = values.map((entry, index) => {
    const angle = (entry.value / total) * Math.PI * 2;
    const start = cursor;
    const end = cursor + angle;
    cursor = end;

    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const largeArc = angle > Math.PI ? 1 : 0;
    const fill = `color-mix(in srgb, var(--admin-primary) ${String(20 + (index * 60) / Math.max(values.length, 1))}%, var(--admin-surface-high))`;

    if (donut) {
      const ix1 = cx + innerRadius * Math.cos(end);
      const iy1 = cy + innerRadius * Math.sin(end);
      const ix2 = cx + innerRadius * Math.cos(start);
      const iy2 = cy + innerRadius * Math.sin(start);
      return {
        path: `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`,
        fill,
        label: entry.label,
        value: entry.value,
      };
    }

    return {
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      fill,
      label: entry.label,
      value: entry.value,
    };
  });

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <svg viewBox="0 0 320 240" className="mx-auto h-56 w-full max-w-sm" role="img" aria-label={donut ? "Donut chart" : "Pie chart"}>
        {slices.map((slice, index) => (
          <path key={`${slice.label}-${index}`} d={slice.path} fill={slice.fill} stroke="var(--admin-surface)" strokeWidth={1} />
        ))}
      </svg>
      <ul className="flex-1 space-y-2 text-sm">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between gap-3 text-[var(--admin-on-surface-variant)]">
            <span>{slice.label}</span>
            <span className="font-semibold text-[var(--admin-on-surface)]">{formatNumber(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FunnelChartView({ data }: ChartCommonProps) {
  const axes = resolveAxes(data);
  if (!axes) return <ChartEmpty message="Need stages and values for funnel charts." />;

  const maxValue = Math.max(...data.rows.map((row) => numericValue(row[axes.measureKey])), 1);

  return (
    <div className="space-y-3">
      {data.rows.map((row, index) => {
        const value = numericValue(row[axes.measureKey]);
        const widthPct = Math.max(18, (value / maxValue) * 100);
        return (
          <div key={`${String(row[axes.dimensionKey])}-${index}`} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--admin-on-surface-variant)]">
              <span>{String(row[axes.dimensionKey] ?? "")}</span>
              <span className="font-semibold text-[var(--admin-on-surface)]">{formatNumber(value)}</span>
            </div>
            <div className="h-8 rounded-md bg-[var(--admin-surface-low)]">
              <div
                className="flex h-full items-center rounded-md bg-[color-mix(in_srgb,var(--admin-primary)_75%,var(--admin-surface))] px-3 text-xs font-semibold text-[var(--admin-on-primary,var(--admin-on-surface))]"
                style={{ width: `${widthPct}%` }}
              >
                {Math.round((value / maxValue) * 100)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProgressChartView({ data }: ChartCommonProps) {
  const axes = resolveAxes(data);
  if (!axes) return <ChartEmpty message="Need labels and values for progress charts." />;

  const maxValue = Math.max(...data.rows.map((row) => numericValue(row[axes.measureKey])), 1);

  return (
    <div className="space-y-4">
      {data.rows.map((row, index) => {
        const value = numericValue(row[axes.measureKey]);
        const pct = Math.round((value / maxValue) * 100);
        return (
          <div key={`${String(row[axes.dimensionKey])}-${index}`}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-[var(--admin-on-surface)]">{String(row[axes.dimensionKey] ?? "")}</span>
              <span className="text-[var(--admin-on-surface-variant)]">{formatNumber(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
              <div className="h-full rounded-full bg-[var(--admin-primary)]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ScatterChartView({ data }: ChartCommonProps) {
  const numericColumns = data.columns.filter((column) => column.kind === "number" || column.kind === "measure");
  const xKey = numericColumns[0]?.key;
  const yKey = numericColumns[1]?.key ?? data.measures?.[1];
  if (!xKey || !yKey) return <ChartEmpty message="Need at least two numeric columns for scatter charts." />;

  const points = data.rows.map((row) => ({
    x: numericValue(row[xKey]),
    y: numericValue(row[yKey]),
  }));
  const maxX = Math.max(...points.map((point) => point.x), 1);
  const maxY = Math.max(...points.map((point) => point.y), 1);

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-64 w-full" role="img" aria-label="Scatter chart">
      <GridLines />
      {points.map((point, index) => {
        const x = CHART_PADDING + (point.x / maxX) * (CHART_WIDTH - CHART_PADDING * 2);
        const y = CHART_HEIGHT - CHART_PADDING - (point.y / maxY) * (CHART_HEIGHT - CHART_PADDING * 2);
        return <circle key={index} cx={x} cy={y} r={4} fill={chartLineStroke} opacity={0.85} />;
      })}
    </svg>
  );
}

export function HeatmapChartView({ data }: ChartCommonProps) {
  const dimensionKey = data.dimensions?.[0] ?? data.columns[0]?.key;
  const measureColumns = data.columns.filter((column) => column.kind === "number" || column.kind === "measure");
  if (!dimensionKey || measureColumns.length === 0) {
    return <ChartEmpty message="Need a label column and numeric columns for heatmaps." />;
  }

  const maxValue = Math.max(
    ...data.rows.flatMap((row) => measureColumns.map((column) => numericValue(row[column.key]))),
    1,
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr>
            <th className="px-2 py-2 text-left text-[var(--admin-on-surface-variant)]">{dimensionKey}</th>
            {measureColumns.map((column) => (
              <th key={column.key} className="px-2 py-2 text-left text-[var(--admin-on-surface-variant)]">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td className="px-2 py-2 font-medium text-[var(--admin-on-surface)]">{String(row[dimensionKey] ?? "")}</td>
              {measureColumns.map((column) => {
                const value = numericValue(row[column.key]);
                const intensity = value / maxValue;
                return (
                  <td
                    key={column.key}
                    className="px-2 py-2 text-[var(--admin-on-surface)]"
                    style={{
                      background: `color-mix(in srgb, var(--admin-primary) ${String(Math.round(intensity * 55))}%, var(--admin-surface))`,
                    }}
                  >
                    {formatNumber(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SparklineChartView({ data }: ChartCommonProps) {
  const points = buildSeriesPoints(data);
  if (!points || points.length === 0) return <ChartEmpty message="Need time-series values for sparklines." />;

  const width = 240;
  const height = 56;
  const padding = 4;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const coords = points.map((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = padding + (height - padding * 2) - (point.value / maxValue) * (height - padding * 2);
    return { x, y };
  });
  const path = buildLinePath(coords);

  return (
    <div className={`${analyticsChartPanelClassName} flex items-center justify-between gap-4`}>
      <div>
        <p className={analyticsMetricLabelClassName}>{firstMeasureLabel(data)}</p>
        <p className="mt-1 text-2xl font-bold text-[var(--admin-on-surface)]">
          {formatNumber(points[points.length - 1]?.value ?? 0)}
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-40" aria-hidden>
        <path d={path} fill="none" stroke={chartLineStroke} strokeWidth={2} strokeLinecap="round" />
      </svg>
    </div>
  );
}
