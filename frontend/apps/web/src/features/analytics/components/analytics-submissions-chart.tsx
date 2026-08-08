"use client";

import { useMemo } from "react";
import type { ChartGranularity, TrendPoint } from "../analytics-studio-shared";
import {
  chartFill,
  chartGridStroke,
  chartLineStroke,
  panelHeaderClassName,
} from "../analytics-studio-shared";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

type AnalyticsSubmissionsChartProps = {
  points: TrendPoint[];
  granularity: ChartGranularity;
  onGranularityChange: (value: ChartGranularity) => void;
  loading?: boolean | undefined;
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
    const x =
      padding + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const y = padding + innerHeight - (point.count / maxCount) * innerHeight;
    return { x, y };
  });

  if (coords.length === 1) {
    const only = defined(coords[0]);
    return `M ${String(only.x)} ${String(only.y)}`;
  }

  let path = `M ${String(defined(coords[0]).x)} ${String(defined(coords[0]).y)}`;
  for (let index = 1; index < coords.length; index += 1) {
    const prev = defined(coords[index - 1]);
    const current = defined(coords[index]);
    const cx = (prev.x + current.x) / 2;
    path += ` C ${String(cx)} ${String(prev.y)}, ${String(cx)} ${String(current.y)}, ${String(current.x)} ${String(current.y)}`;
  }
  return path;
}

export function AnalyticsSubmissionsChart({
  points,
  granularity,
  onGranularityChange,
  loading = false,
}: AnalyticsSubmissionsChartProps) {
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
    return `${linePath} L ${String(lastX)} ${String(height - padding)} L ${String(padding)} ${String(height - padding)} Z`;
  }, [linePath, points.length, width]);

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <section
      className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm"
      aria-labelledby="submissions-chart-heading"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="submissions-chart-heading" className={panelHeaderClassName}>
          Submissions over time
        </h2>
        <div className="flex gap-3" role="tablist" aria-label="Chart granularity">
          {GRANULARITY_OPTIONS.map((option) => {
            const selected = granularity === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`border-b-2 pb-0.5 text-xs font-semibold transition-colors ${
                  selected
                    ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                    : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                }`}
                onClick={() => {
                  onGranularityChange(option.value);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative h-64 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading chart…</p>
          </div>
        ) : points.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 text-center">
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              No submission activity in this range yet.
            </p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${String(width)} ${String(height + 20)}`}
            className="h-full w-full overflow-visible"
            role="img"
            aria-label="Assessment submissions trend chart"
          >
            {gridLines.map((ratio) => {
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
              <path
                d={linePath}
                fill="none"
                stroke={chartLineStroke}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
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
                points.length <= 8 ||
                index === 0 ||
                index === points.length - 1 ||
                index % Math.ceil(points.length / 7) === 0;
              return (
                <g key={point.sortKey}>
                  <circle cx={x} cy={y} r={3} fill={chartLineStroke} />
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
