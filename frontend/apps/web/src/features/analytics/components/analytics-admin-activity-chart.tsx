"use client";

import { useMemo } from "react";
import type { ChartGranularity, TrendPoint } from "../analytics-studio-shared";
import {
  analyticsChartPanelClassName,
  chartFill,
  chartGridStroke,
  chartLineStroke,
} from "../analytics-admin-shared";

type AnalyticsAdminActivityChartProps = {
  points: TrendPoint[];
  granularity: ChartGranularity;
  onGranularityChange: (value: ChartGranularity) => void;
  onPointClick?: (point: TrendPoint) => void;
  loading?: boolean;
};

const GRANULARITY_OPTIONS: Array<{ value: ChartGranularity; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function buildPath(points: TrendPoint[], width: number, height: number, padding: number): string {
  if (points.length === 0) return "";
  const maxCount = Math.max(...points.map((point) => point.count), 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const coords = points.map((point, index) => {
    const x = padding + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const y = padding + innerHeight - (point.count / maxCount) * innerHeight;
    return { x, y };
  });
  if (coords.length === 1) {
    const only = coords[0]!;
    return `M ${only.x} ${only.y}`;
  }
  let path = `M ${coords[0]!.x} ${coords[0]!.y}`;
  for (let index = 1; index < coords.length; index += 1) {
    const prev = coords[index - 1]!;
    const current = coords[index]!;
    const cx = (prev.x + current.x) / 2;
    path += ` C ${cx} ${prev.y}, ${cx} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

export function AnalyticsAdminActivityChart({
  points,
  granularity,
  onGranularityChange,
  onPointClick,
  loading = false,
}: AnalyticsAdminActivityChartProps) {
  const width = 800;
  const height = 240;
  const padding = 16;

  const linePath = useMemo(() => buildPath(points, width, height, padding), [points]);
  const areaPath = useMemo(() => {
    if (!linePath || points.length === 0) return "";
    const lastX =
      points.length === 1
        ? padding + (width - padding * 2) / 2
        : padding + ((points.length - 1) / Math.max(points.length - 1, 1)) * (width - padding * 2);
    return `${linePath} L ${lastX} ${height - padding} L ${padding} ${height - padding} Z`;
  }, [linePath, points.length, width]);

  return (
    <section className={analyticsChartPanelClassName} aria-labelledby="activity-chart-heading">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="activity-chart-heading" className="text-lg font-semibold text-[var(--admin-on-surface)]">
            Daily learning activity
          </h2>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Lessons completed over the selected date range
          </p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Chart granularity">
          {GRANULARITY_OPTIONS.map((option) => {
            const selected = granularity === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                  selected
                    ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-sm"
                    : "border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                }`}
                onClick={() => onGranularityChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative h-64 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--admin-on-surface-variant)]">
            Loading chart…
          </div>
        ) : points.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-center text-sm text-[var(--admin-on-surface-variant)]">
            No lesson activity in this range yet.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height + 20}`}
            className="h-full w-full overflow-visible"
            role="img"
            aria-label="Lessons completed trend chart"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding + (height - padding * 2) * ratio;
              return (
                <line
                  key={ratio}
                  x1={0}
                  x2={width}
                  y1={y}
                  y2={y}
                  stroke={chartGridStroke}
                  strokeDasharray={ratio === 1 ? undefined : "4"}
                />
              );
            })}
            {areaPath ? <path d={areaPath} fill={chartFill} /> : null}
            {linePath ? (
              <path d={linePath} fill="none" stroke={chartLineStroke} strokeWidth={2.5} strokeLinecap="round" />
            ) : null}
            {points.map((point, index) => {
              const maxCount = Math.max(...points.map((entry) => entry.count), 1);
              const innerWidth = width - padding * 2;
              const innerHeight = height - padding * 2;
              const x =
                padding +
                (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
              const y = padding + innerHeight - (point.count / maxCount) * innerHeight;
              const showLabel =
                points.length <= 6 || index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 5) === 0;
              return (
                <g key={point.sortKey}>
                  <circle
                    cx={x}
                    cy={y}
                    r={onPointClick ? 6 : 3}
                    fill={chartLineStroke}
                    className={onPointClick ? "cursor-pointer" : undefined}
                    role={onPointClick ? "button" : undefined}
                    aria-label={onPointClick ? `${point.label}: ${String(point.count)} lessons` : undefined}
                    onClick={
                      onPointClick
                        ? () => {
                            onPointClick(point);
                          }
                        : undefined
                    }
                  />
                  {showLabel ? (
                    <text
                      x={x}
                      y={height + 14}
                      textAnchor="middle"
                      fill="var(--admin-on-surface-variant)"
                      fontSize={10}
                      fontWeight={500}
                    >
                      {point.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </section>
  );
}
