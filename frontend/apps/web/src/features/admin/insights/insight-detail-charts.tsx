"use client";

import { useId, useState } from "react";
import type { InsightDashboardRange, InsightWidget } from "./admin-insights-api";
import { formatInsightNumber, formatPeriodLabel, formatPeriodLong } from "./admin-insights-format";
import {
  cell,
  formatCompact,
  isMeasureColumn,
  numericValue,
  stringValue,
  type SeriesPoint,
} from "./insight-detail-kit";

/** One line, area or set of bars in a SeriesChart. */
export type ChartSeries = {
  key: string;
  label: string;
  /** Any CSS colour; use admin tokens. */
  color: string;
  strokeWidth?: number | undefined;
  dashed?: boolean | undefined;
  /** Series on the right axis get their own scale and tick labels. */
  axis?: "left" | "right" | undefined;
  barOpacity?: number | undefined;
};

const SERIES_COLORS = [
  "var(--admin-primary)",
  "var(--admin-primary-container)",
  "color-mix(in srgb, var(--admin-primary) 60%, var(--admin-surface))",
  "color-mix(in srgb, var(--admin-primary) 35%, var(--admin-outline))",
];

/** Colours for a widget's measures in order: the first is the primary series. */
export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length] ?? "var(--admin-primary)";
}

export type TooltipLine = { text: string; strong?: boolean | undefined; size?: number | undefined };

/**
 * Chart points from a widget's rows. Rows with a period are labelled by date;
 * other rows by their first dimension (a stage, a status, a product).
 */
export function seriesPoints(
  widget: InsightWidget,
  range: InsightDashboardRange,
  measureKeys: string[] = widgetMeasureKeys(widget),
): SeriesPoint[] {
  const labelKey =
    widget.data.dimensions?.[0] ??
    widget.data.columns.find(
      (column) =>
        column.kind === "dimension" ||
        column.kind === "date" ||
        column.kind === "string" ||
        column.key === "period",
    )?.key ??
    "period";
  return widget.data.rows.map((row) => {
    const period = cell(row, "period");
    const isPeriod = period != null || labelKey === "period";
    const raw = stringValue(period ?? cell(row, labelKey));
    return {
      label: isPeriod ? formatPeriodLabel(raw, range) : raw,
      longLabel: isPeriod
        ? range === "30d"
          ? formatPeriodLabel(raw, range)
          : formatPeriodLong(raw)
        : raw,
      values: Object.fromEntries(measureKeys.map((key) => [key, numericValue(cell(row, key))])),
    };
  });
}

export function widgetMeasureKeys(widget: InsightWidget): string[] {
  if (widget.data.measures && widget.data.measures.length > 0) return widget.data.measures;
  const keys = widget.data.columns.filter(isMeasureColumn).map((column) => column.key);
  return keys.length > 0 ? keys : ["value"];
}

/** Tooltip for a single series: the value and its change from the previous point. */
export function singleSeriesTooltip(
  key: string,
  format: (value: number) => string,
): (point: SeriesPoint, index: number, visible: SeriesPoint[]) => TooltipLine[] {
  return (point, index, visible) => {
    const value = point.values[key] ?? 0;
    const previous = index > 0 ? (visible[index - 1]?.values[key] ?? 0) : 0;
    const lines: TooltipLine[] = [
      { text: point.longLabel, size: 10 },
      { text: format(value), strong: true, size: 12 },
    ];
    if (previous > 0) {
      const pct = Math.round(((value - previous) / previous) * 100);
      lines.push({ text: `${pct >= 0 ? "+" : ""}${formatInsightNumber(pct)}% vs prev.`, size: 10 });
    }
    return lines;
  };
}

const WIDTH = 800;
const HEIGHT = 300;
const PAD_L = 52;
const PAD_T = 16;
const PAD_B = 32;
const TICKS = [1, 0.75, 0.5, 0.25, 0];

/**
 * Line, area or grouped-bar chart over time for one or more series, with an
 * average line, a hover readout and, for long series, a brush to zoom in.
 */
export function SeriesChart({
  points,
  series,
  mainKey,
  viz,
  average,
  averageLabel = "Average",
  widgetTitle,
  formatTick = formatCompact,
  formatAverage,
  tooltip,
  tooltipWidth = 144,
  anchorValue,
}: {
  points: SeriesPoint[];
  series: ChartSeries[];
  mainKey: string;
  viz: "area" | "line" | "bar";
  average: number | null;
  averageLabel?: string | undefined;
  widgetTitle: string;
  formatTick?: ((value: number) => string) | undefined;
  formatAverage?: ((value: number) => string) | undefined;
  tooltip: (point: SeriesPoint, index: number, visible: SeriesPoint[]) => TooltipLine[];
  tooltipWidth?: number | undefined;
  /** The left-axis value the readout sits above; the main series by default. */
  anchorValue?: ((point: SeriesPoint) => number) | undefined;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [windowRange, setWindowRange] = useState<[number, number]>([
    0,
    Math.max(points.length - 1, 0),
  ]);
  const left = series.filter((item) => item.axis !== "right");
  const right = series.filter((item) => item.axis === "right");
  const padR = right.length > 0 ? 52 : 16;
  const visible = points.slice(windowRange[0], windowRange[1] + 1);
  const leftMax = Math.max(
    ...visible.flatMap((point) => left.map((item) => point.values[item.key] ?? 0)),
    average ?? 0,
    1,
  );
  const rightMax = Math.max(
    ...visible.flatMap((point) => right.map((item) => point.values[item.key] ?? 0)),
    1,
  );
  const innerW = WIDTH - PAD_L - padR;
  const innerH = HEIGHT - PAD_T - PAD_B;
  const slotW = innerW / Math.max(visible.length, 1);
  const xFor = (index: number) =>
    PAD_L + (visible.length <= 1 ? innerW / 2 : (index / (visible.length - 1)) * innerW);
  const yFor = (value: number, axis: ChartSeries["axis"]) =>
    PAD_T + innerH - (value / (axis === "right" ? rightMax : leftMax)) * innerH;
  const avgY = average != null ? yFor(average, "left") : null;
  const main = series.find((item) => item.key === mainKey);

  const pathFor = (item: ChartSeries) =>
    visible
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${String(xFor(index))} ${String(yFor(point.values[item.key] ?? 0, item.axis))}`,
      )
      .join(" ");
  const areaPath =
    main && visible.length > 0
      ? `${pathFor(main)} L ${String(xFor(visible.length - 1))} ${String(PAD_T + innerH)} L ${String(xFor(0))} ${String(PAD_T + innerH)} Z`
      : "";

  const hovered = hover != null ? visible[hover] : undefined;
  const readout = hovered && hover != null ? tooltip(hovered, hover, visible) : [];
  const readoutH = 12 + readout.length * 14;
  const readoutX = hover != null ? xFor(hover) : 0;
  const readoutAnchor = hovered
    ? yFor(anchorValue ? anchorValue(hovered) : (hovered.values[mainKey] ?? 0), "left")
    : 0;
  const readoutTop = Math.max(PAD_T + 4, readoutAnchor - readoutH - 6);
  const readoutCenter = Math.min(
    Math.max(readoutX, PAD_L + tooltipWidth / 2),
    WIDTH - padR - tooltipWidth / 2,
  );

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        className="h-[420px] w-full max-md:h-[280px]"
        role="img"
        aria-label={`${widgetTitle} ${viz} chart`}
        onMouseLeave={() => {
          setHover(null);
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0%"
              stopColor={main?.color ?? "var(--admin-primary)"}
              stopOpacity="0.18"
            />
            <stop
              offset="100%"
              stopColor={main?.color ?? "var(--admin-primary)"}
              stopOpacity="0.02"
            />
          </linearGradient>
        </defs>
        {TICKS.map((ratio) => {
          const y = PAD_T + innerH * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={PAD_L}
                x2={WIDTH - padR}
                y1={y}
                y2={y}
                stroke="var(--admin-border)"
                strokeDasharray={ratio === 0 || ratio === 1 ? undefined : "4 4"}
              />
              <text
                x={PAD_L - 8}
                y={y + 3}
                textAnchor="end"
                fill="var(--admin-on-surface-variant)"
                fontSize={10}
                className="font-data"
              >
                {formatTick(leftMax * ratio)}
              </text>
              {right.length > 0 ? (
                <text
                  x={WIDTH - padR + 8}
                  y={y + 3}
                  textAnchor="start"
                  fill="var(--admin-on-surface-variant)"
                  fontSize={10}
                  className="font-data"
                >
                  {formatCompact(rightMax * ratio)}
                </text>
              ) : null}
            </g>
          );
        })}
        {avgY != null ? (
          <g>
            <line
              x1={PAD_L}
              x2={WIDTH - padR}
              y1={avgY}
              y2={avgY}
              stroke="var(--admin-outline)"
              strokeDasharray="5 4"
            />
            <text
              x={WIDTH - padR}
              y={avgY - 6}
              textAnchor="end"
              fill="var(--admin-on-surface-variant)"
              fontSize={10}
              className="font-data"
            >
              {`${averageLabel} ${(formatAverage ?? formatTick)(average ?? 0)}`}
            </text>
          </g>
        ) : null}
        {viz === "bar"
          ? visible.map((point, index) => {
              const count = Math.max(series.length, 1);
              const barW =
                count === 1 ? Math.min(36, slotW - 8) : Math.min(14, slotW / (count + 1));
              const gap = count === 1 ? 0 : 3;
              const groupW = count * barW + (count - 1) * gap;
              const baseX = PAD_L + index * slotW + slotW / 2 - groupW / 2;
              const dimmed = hover != null && hover !== index;
              return (
                <g key={`bars-${String(index)}`}>
                  {series.map((item, seriesIndex) => {
                    const y = yFor(point.values[item.key] ?? 0, item.axis);
                    const opacity = item.barOpacity ?? 1;
                    return (
                      <rect
                        key={item.key}
                        x={baseX + seriesIndex * (barW + gap)}
                        y={y}
                        width={Math.max(barW, 0)}
                        height={PAD_T + innerH - y}
                        rx={2}
                        fill={item.color}
                        opacity={dimmed ? opacity * 0.45 : opacity}
                      />
                    );
                  })}
                </g>
              );
            })
          : null}
        {viz === "area" && main ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
        {viz !== "bar"
          ? series.map((item) => (
              <path
                key={item.key}
                d={pathFor(item)}
                fill="none"
                stroke={item.color}
                strokeWidth={item.strokeWidth ?? (item.key === mainKey ? 2.5 : 2)}
                strokeDasharray={item.dashed ? "5 4" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))
          : null}
        {visible.map((point, index) => {
          const x = xFor(index);
          const active = hover === index;
          return (
            <g
              key={`point-${String(index)}`}
              onMouseEnter={() => {
                setHover(index);
              }}
            >
              <rect x={x - slotW / 2} y={PAD_T} width={slotW} height={innerH} fill="transparent" />
              {viz !== "bar"
                ? series.map((item) => {
                    const isMain = item.key === mainKey;
                    return (
                      <circle
                        key={item.key}
                        cx={x}
                        cy={yFor(point.values[item.key] ?? 0, item.axis)}
                        r={isMain ? (active ? 5 : 4) : active ? 4 : 3}
                        fill={isMain && active ? item.color : "var(--admin-surface)"}
                        stroke={item.color}
                        strokeWidth={2}
                      />
                    );
                  })
                : null}
              {(visible.length <= 13 || index === 0 || index === visible.length - 1 || active) && (
                <text
                  x={x}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fill={active ? "var(--admin-primary)" : "var(--admin-on-surface-variant)"}
                  fontSize={10}
                  fontWeight={active ? 600 : 400}
                  className="font-data"
                >
                  {point.label}
                </text>
              )}
            </g>
          );
        })}
        {hovered ? (
          <g>
            <line
              x1={readoutX}
              x2={readoutX}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke="var(--admin-outline)"
              strokeDasharray="2 2"
            />
            <rect
              x={readoutCenter - tooltipWidth / 2}
              y={readoutTop}
              width={tooltipWidth}
              height={readoutH}
              rx={4}
              fill="var(--admin-on-surface)"
            />
            {readout.map((line, lineIndex) => (
              <text
                key={`${String(lineIndex)}-${line.text}`}
                x={readoutCenter}
                y={readoutTop + 18 + lineIndex * 14}
                textAnchor="middle"
                fill="var(--admin-surface)"
                fontSize={line.size ?? 11}
                fontWeight={line.strong ? 600 : 400}
                className="font-data"
              >
                {line.text}
              </text>
            ))}
          </g>
        ) : null}
      </svg>
      {points.length > 8 ? (
        <div className="relative mx-1 hidden h-8 overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] md:block">
          <div
            className="absolute inset-y-0 border-x border-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-primary)_16%,transparent)]"
            style={{
              left: `${String((windowRange[0] / Math.max(points.length - 1, 1)) * 100)}%`,
              right: `${String(100 - (windowRange[1] / Math.max(points.length - 1, 1)) * 100)}%`,
            }}
            aria-hidden="true"
          />
          <div className="relative z-[1] flex h-full">
            {points.map((point, index) => (
              <button
                key={`brush-${String(index)}`}
                type="button"
                className="h-full flex-1 outline-none focus-visible:bg-[color-mix(in_srgb,var(--admin-primary)_20%,transparent)]"
                aria-label={`Focus ${point.longLabel}`}
                onClick={() => {
                  setWindowRange([Math.max(0, index - 4), Math.min(points.length - 1, index + 4)]);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type RankedBar = { label: string; value: number };

/**
 * Horizontal bars ranked by value. With `compare`, each row also shows the
 * paired widget's value for the same label beneath it.
 */
export function RankedBarChart({
  rows,
  compare,
}: {
  rows: RankedBar[];
  compare?:
    | { values: Map<string, number>; primaryLabel: string; pairedLabel: string }
    | null
    | undefined;
}) {
  const maxPrimary = Math.max(...rows.map((row) => row.value), 1);
  const maxPaired = compare ? Math.max(...compare.values.values(), 1) : 1;
  const pairedSwatch = "bg-[color-mix(in_srgb,var(--admin-primary)_32%,var(--admin-surface))]";

  return (
    <div className="flex flex-col gap-5 p-6">
      {compare ? (
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--admin-on-surface-variant)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-[var(--admin-primary)]" aria-hidden="true" />
            {compare.primaryLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm ${pairedSwatch}`} aria-hidden="true" />
            {compare.pairedLabel}
          </span>
        </div>
      ) : null}
      {rows.map((row, index) => {
        const widthPct = Math.max((row.value / maxPrimary) * 100, row.value > 0 ? 4 : 0);
        const pairedValue = compare?.values.get(row.label.toLowerCase()) ?? 0;
        const pairedPct = Math.max((pairedValue / maxPaired) * 100, pairedValue > 0 ? 4 : 0);
        return (
          <div key={`${row.label}-${String(index)}`} className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-4">
              <div className="flex justify-end">
                <span className="inline-flex max-w-full truncate rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 font-data text-xs text-[var(--admin-on-surface-variant)]">
                  {row.label}
                </span>
              </div>
              <div className="group relative h-8 overflow-hidden rounded bg-[var(--admin-surface-low)]">
                <div
                  className="absolute inset-y-0 left-0 rounded bg-[var(--admin-primary)] motion-safe:transition-[width,opacity] motion-safe:duration-300 group-hover:opacity-100"
                  style={{
                    width: `${String(widthPct)}%`,
                    opacity: Math.max(0.25, 1 - index * 0.15),
                  }}
                />
              </div>
              <span className="w-24 text-right font-data text-sm tabular-nums text-[var(--admin-on-surface)]">
                {formatInsightNumber(row.value)}
              </span>
            </div>
            {compare ? (
              <div className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-4">
                <div aria-hidden="true" />
                <div className="relative h-5 overflow-hidden rounded bg-[var(--admin-surface-low)]">
                  <div
                    className={`absolute inset-y-0 left-0 rounded ${pairedSwatch}`}
                    style={{ width: `${String(pairedPct)}%` }}
                  />
                </div>
                <span className="w-24 text-right font-data text-xs tabular-nums text-[var(--admin-on-surface-variant)]">
                  {formatInsightNumber(pairedValue)}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** A widget's label/value rows as ranked bars. */
export function rankedBars(widget: InsightWidget): RankedBar[] {
  return widget.data.rows.map((row) => ({
    label: stringValue(cell(row, "label"), "Unknown"),
    value: numericValue(cell(row, "value")),
  }));
}
