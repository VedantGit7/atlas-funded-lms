"use client";

/**
 * Building blocks shared by every Insights widget detail view: the frame in
 * InsightWidgetDetailView and each area's main column (School Vitals, Sales,
 * Live, Marketing, Messenger and the generic Dashboard).
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CreditCard,
  History,
  Inbox,
  Lightbulb,
  Megaphone,
  Radio,
  Table2,
  TrendingUp,
  Users,
} from "lucide-react";
import { inlineExpandClassName } from "../../studio/courses/admin-form-dropdown-shared";
import type {
  InsightDashboardRange,
  InsightWidget,
  InsightWidgetDetail,
  InsightWidgetRelatedIcon,
  InsightWidgetSplitRow,
} from "./admin-insights-api";
import {
  formatInsightMoneyWithCode,
  formatInsightNumber,
  formatPeriodLabel,
  formatRelativeTime,
} from "./admin-insights-format";
import {
  insightGhostButtonClassName,
  insightKpiValueClassName,
  insightPanelClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
  insightShimmerClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";

export type InsightRow = Record<string, string | number | null>;

/**
 * State that belongs to one widget: opening another widget starts again from
 * `initial`, as a page of its own would.
 */
export function useWidgetState<T>(
  widget: InsightWidget | null,
  initial: T,
): [T, (value: T) => void] {
  const [state, setState] = useState<{ widget: InsightWidget | null; value: T } | null>(null);
  const value = state && state.widget === widget ? state.value : initial;
  return [
    value,
    (next) => {
      setState({ widget, value: next });
    },
  ];
}

export function numericValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function stringValue(value: string | number | null | undefined, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

export function cell(row: InsightRow | undefined, key: string): string | number | null {
  return row?.[key] ?? null;
}

/** Whole numbers without decimals, anything else with one. */
export function formatAmount(value: number): string {
  return formatInsightNumber(value, value % 1 === 0 ? 0 : 1);
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${formatInsightNumber(value / 1_000_000, 1)}M`;
  if (value >= 1000) return `${formatInsightNumber(value / 1000, 0)}k`;
  return formatInsightNumber(value, value >= 100 ? 0 : 1);
}

export function isMeasureColumn(column: { kind: string }): boolean {
  return column.kind === "measure" || column.kind === "number";
}

export function isKpiWidget(widget: InsightWidget): boolean {
  return widget.defaultViz === "kpi";
}

/** Columns a person can read or export; `href` only drives row links. */
export function exportColumns(widget: InsightWidget) {
  return widget.data.columns.filter((column) => column.key !== "href");
}

export function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Keeps the largest splits and folds the rest into one "Other" row. */
export function collapseSplits(rows: InsightWidgetSplitRow[], limit = 4): InsightWidgetSplitRow[] {
  if (rows.length <= limit) return rows;
  const head = rows.slice(0, limit - 1);
  const rest = rows.slice(limit - 1);
  const value = rest.reduce((sum, row) => sum + row.value, 0);
  const share = Math.round(rest.reduce((sum, row) => sum + row.share, 0) * 10) / 10;
  return [...head, { label: `Other (${String(rest.length)})`, value, share }];
}

export type StatusTone = "success" | "warning" | "danger" | "neutral";

export function statusPillClass(tone: StatusTone): string {
  if (tone === "success") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (tone === "warning") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  if (tone === "danger") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
}

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-data text-[11px] font-semibold uppercase tracking-wide ${statusPillClass(tone)}`}
    >
      {children}
    </span>
  );
}

/**
 * How a change reads: growth is good unless the metric is inverted (failures,
 * inactivity), where growth is a warning, or for some metrics a danger.
 */
export type DeltaPolarity = "normal" | "inverted" | "inverted-danger";

export function deltaToneClass(delta: number, polarity: DeltaPolarity = "normal"): string {
  if (delta === 0) return "text-[var(--admin-on-surface-variant)]";
  if (polarity === "normal") {
    return delta > 0 ? "text-[var(--admin-success)]" : "text-[var(--admin-warning)]";
  }
  if (delta < 0) return "text-[var(--admin-success)]";
  return polarity === "inverted-danger"
    ? "text-[var(--admin-danger)]"
    : "text-[var(--admin-warning)]";
}

function deltaTintClass(delta: number | null, polarity: DeltaPolarity): string {
  if (delta == null || delta === 0) return "";
  const good = polarity === "normal" ? delta > 0 : delta < 0;
  if (good) return "bg-[color-mix(in_srgb,var(--admin-success)_6%,transparent)]";
  return polarity === "inverted-danger"
    ? "bg-[color-mix(in_srgb,var(--admin-danger)_6%,transparent)]"
    : "bg-[color-mix(in_srgb,var(--admin-warning)_6%,transparent)]";
}

export function signed(value: number, text: string): string {
  return `${value >= 0 ? "+" : ""}${text}`;
}

export function formatSignedPct(pct: number): string {
  return signed(pct, `${formatInsightNumber(pct, 1)}%`);
}

export function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

/** The row of headline numbers above an area's main panel. */
export function HeadlineStrip({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-wrap items-end gap-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
      {children}
    </section>
  );
}

export function HeadlineCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-[140px] flex-1">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
        {label}
      </p>
      {children}
    </div>
  );
}

export function HeadlineDivider({ from = "lg" }: { from?: "md" | "lg" }) {
  return (
    <div
      className={`hidden h-10 w-px bg-[var(--admin-border)] ${from === "md" ? "md:block" : "lg:block"}`}
      aria-hidden="true"
    />
  );
}

/** An absolute change with its arrow, and the percentage change when known. */
export function DeltaReading({
  delta,
  text,
  pct,
  polarity = "normal",
}: {
  delta: number;
  text: string;
  pct?: number | null | undefined;
  polarity?: DeltaPolarity | undefined;
}) {
  return (
    <div className={`flex items-center gap-2 font-data text-sm ${deltaToneClass(delta, polarity)}`}>
      {delta >= 0 ? (
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      )}
      <span>{signed(delta, text)}</span>
      {pct != null ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,currentColor_20%,transparent)] bg-[color-mix(in_srgb,currentColor_10%,transparent)] px-2 py-0.5 font-data text-[11px]">
          {formatSignedPct(pct)}
        </span>
      ) : null}
    </div>
  );
}

/** A tinted headline cell for the percentage change. */
export function PctDeltaCell({
  pct,
  polarity = "normal",
  trendIcon = false,
}: {
  pct: number | null;
  polarity?: DeltaPolarity | undefined;
  trendIcon?: boolean | undefined;
}) {
  return (
    <div
      className={`relative min-w-[140px] flex-1 overflow-hidden rounded-lg p-1 ${deltaTintClass(pct, polarity)}`}
    >
      <HeadlineCell label="Pct delta">
        {pct != null ? (
          <div
            className={`flex items-center gap-2 font-data text-sm ${deltaToneClass(pct, polarity)}`}
          >
            {trendIcon && pct > 0 ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : null}
            {trendIcon && pct < 0 ? <ArrowDown className="h-4 w-4" aria-hidden="true" /> : null}
            <span className={insightKpiValueClassName}>{formatSignedPct(pct)}</span>
          </div>
        ) : (
          <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">-</span>
        )}
      </HeadlineCell>
    </div>
  );
}

export function NoComparison() {
  return (
    <p className="text-sm text-[var(--admin-on-surface-variant)]">No comparable previous period</p>
  );
}

export function EmptyCanvas({
  title,
  body,
  href,
  hrefLabel,
  icon,
  success,
}: {
  title: string;
  body: string;
  href?: string | null | undefined;
  hrefLabel?: string | undefined;
  icon?: ReactNode | undefined;
  success?: boolean | undefined;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-b-xl bg-[color-mix(in_srgb,var(--admin-page)_50%,transparent)] px-8 py-12 text-center">
      <div
        className={`mb-4 ${success ? "text-[var(--admin-success)]" : "text-[var(--admin-on-surface-variant)]"}`}
      >
        {icon ?? <Activity className="h-12 w-12" aria-hidden="true" />}
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">{body}</p>
      {href ? (
        <Link
          href={href}
          prefetch={false}
          className={`${insightGhostButtonClassName} mt-6 border-[var(--admin-primary)] text-[var(--admin-primary)] hover:bg-[var(--admin-primary-container)]`}
        >
          {hrefLabel ?? "Open related report"}
        </Link>
      ) : null}
    </div>
  );
}

/** A panel with a titled header; `aside` sits at the header's end. */
export function DetailPanel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={insightPanelClassName}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-3">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export const LEGEND_CURRENT_SWATCH =
  "h-3 w-3 rounded-full border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_20%,transparent)]";
export const LEGEND_AVERAGE_SWATCH =
  "inline-block w-3 border-t border-dashed border-[var(--admin-outline)]";

export function ChartLegend({
  items,
}: {
  /** `color` fills the swatch, for series coloured from a palette. */
  items: Array<{ label: string; swatch: string; color?: string | undefined }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--admin-on-surface-variant)]">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className={item.swatch}
            style={item.color ? { background: item.color } : undefined}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function InsightNote({ note }: { note: string }) {
  return (
    <div className="mx-5 mb-5 mt-1 flex items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-4">
      <Lightbulb
        className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]"
        aria-hidden="true"
      />
      <p className="text-sm leading-relaxed text-[var(--admin-on-surface)]">
        <span className="font-semibold text-[var(--admin-primary)]">Insight: </span>
        {note}
      </p>
    </div>
  );
}

export function PanelCaption({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-[var(--admin-border)] px-5 py-3 text-xs text-[var(--admin-on-surface-variant)]">
      {children}
    </p>
  );
}

export function SplitTable({
  rows,
  money,
  currency,
}: {
  rows: InsightWidgetSplitRow[];
  money?: boolean | undefined;
  currency?: string | undefined;
}) {
  const display = collapseSplits(rows);
  if (display.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
        This widget has no further breakdown.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-6 py-3`}>Label</th>
            <th className={`${insightTableHeadClassName} px-6 py-3 text-right`}>Value</th>
            <th className={`${insightTableHeadClassName} px-6 py-3`}>Share</th>
          </tr>
        </thead>
        <tbody>
          {display.map((row, index) => {
            const aggregated = row.label.startsWith("Other");
            return (
              <tr key={row.label} className={insightTableRowClassName}>
                <td
                  className={`px-6 py-2 text-sm ${
                    aggregated
                      ? "text-[var(--admin-on-surface-variant)]"
                      : "font-medium text-[var(--admin-on-surface)]"
                  }`}
                >
                  {row.label}
                </td>
                <td className="px-6 py-2 text-right font-data text-sm">
                  {money
                    ? formatInsightMoneyWithCode(row.value, currency)
                    : formatAmount(row.value)}
                </td>
                <td className="px-6 py-2">
                  <div className="flex items-center gap-3">
                    <span className="w-10 text-right font-data text-xs text-[var(--admin-on-surface-variant)]">
                      {`${formatAmount(row.share)}%`}
                    </span>
                    <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
                      <div
                        className={`h-full rounded-full ${
                          aggregated ? "bg-[var(--admin-outline)]" : "bg-[var(--admin-primary)]"
                        }`}
                        style={{
                          width: `${String(row.share)}%`,
                          opacity: aggregated
                            ? 0.5
                            : index === 0
                              ? 1
                              : Math.max(0.4, 1 - index * 0.15),
                        }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The widget's breakdowns with a switcher between them. Nothing renders when
 * the widget has none. Key it by widget so a new widget starts on its first split.
 */
export function SplitBreakdown({
  detail,
  money,
  currency,
}: {
  detail: InsightWidgetDetail;
  money?: boolean | undefined;
  currency?: string | undefined;
}) {
  const [activeSplit, setActiveSplit] = useState(detail.splitOptions[0]?.id ?? "");
  if (detail.splitOptions.length === 0) return null;
  return (
    <section className={insightPanelClassName}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,transparent)] px-5 py-3">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Data breakdown</h2>
        <div className={insightSegmentTrackClassName} role="group" aria-label="Split dimension">
          {detail.splitOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={
                activeSplit === option.id
                  ? insightSegmentButtonActiveClassName
                  : insightSegmentButtonClassName
              }
              onClick={() => {
                setActiveSplit(option.id);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>
      <SplitTable rows={detail.splits[activeSplit] ?? []} money={money} currency={currency} />
    </section>
  );
}

/** A switch that reveals the rows behind a chart. Key it by widget to reset it. */
export function UnderlyingDataToggle({
  children,
  onCopyCsv,
}: {
  children: ReactNode;
  onCopyCsv: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 text-left outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 motion-safe:active:translate-y-px"
        onClick={() => {
          setOpen((current) => !current);
        }}
        aria-expanded={open}
      >
        <span className="flex items-center gap-3 text-base font-semibold text-[var(--admin-on-surface)]">
          <Table2 className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
          {open ? "Hide underlying data" : "Show underlying data"}
        </span>
        <span
          className={`relative h-5 w-10 rounded-full border border-[var(--admin-outline)] p-0.5 transition-colors ${
            open ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-surface-variant)]"
          }`}
          aria-hidden="true"
        >
          <span
            className={`block h-4 w-4 rounded-full bg-[var(--admin-surface)] shadow-sm transition-transform ${
              open ? "translate-x-5" : ""
            }`}
          />
        </span>
      </button>
      {open ? (
        <div
          className={`mt-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 ${inlineExpandClassName}`}
        >
          {children}
          <button
            type="button"
            className="mt-3 text-sm font-medium text-[var(--admin-primary)] hover:underline"
            onClick={onCopyCsv}
          >
            Copy as CSV
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RowCount({ count }: { count: number }) {
  return (
    <div className="border-t border-[var(--admin-border)] px-4 py-2 text-xs text-[var(--admin-on-surface-variant)]">
      {`${String(count)} ${count === 1 ? "row" : "rows"}`}
    </div>
  );
}

/** Every row of the widget as returned, without paging. */
export function UnderlyingTable({
  widget,
  range,
  isMoneyColumn,
  currency,
  statusTone,
}: {
  widget: InsightWidget;
  range: InsightDashboardRange;
  isMoneyColumn?: ((key: string) => boolean) | undefined;
  currency?: string | undefined;
  statusTone?: ((status: string) => StatusTone) | undefined;
}) {
  const columns = exportColumns(widget);
  return (
    <div className="overflow-x-auto rounded border border-[var(--admin-border)]">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`${insightTableHeadClassName} px-4 py-2.5 ${isMeasureColumn(column) ? "text-right" : ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {widget.data.rows.map((row, index) => (
            <tr
              key={`${stringValue(cell(row, columns[0]?.key ?? "id"), "row")}-${String(index)}`}
              className={insightTableRowClassName}
            >
              {columns.map((column) => {
                const raw = cell(row, column.key);
                const measure = isMeasureColumn(column);
                let display = stringValue(raw, "");
                if (measure && isMoneyColumn?.(column.key)) {
                  display = formatInsightMoneyWithCode(numericValue(raw), currency);
                } else if (measure) {
                  display = formatAmount(numericValue(raw));
                } else if (column.key === "period") {
                  display = formatPeriodLabel(stringValue(raw), range);
                } else if (column.key === "status" && statusTone) {
                  return (
                    <td key={column.key} className="px-4 py-2">
                      <StatusPill tone={statusTone(display)}>{display || "-"}</StatusPill>
                    </td>
                  );
                }
                return (
                  <td
                    key={column.key}
                    className={`px-4 py-2 text-sm ${measure ? "text-right font-data" : "text-[var(--admin-on-surface)]"}`}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <RowCount count={widget.data.rows.length} />
    </div>
  );
}

export type SeriesPoint = {
  label: string;
  longLabel: string;
  values: Record<string, number>;
};

/** Chart points as a table: the date, then one column per series. */
export function SeriesTable({
  points,
  series,
}: {
  points: SeriesPoint[];
  series: Array<{ key: string; label: string }>;
}) {
  return (
    <div className="overflow-x-auto rounded border border-[var(--admin-border)]">
      <table className="w-full min-w-[480px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-4 py-2.5`}>Date</th>
            {series.map((item) => (
              <th key={item.key} className={`${insightTableHeadClassName} px-4 py-2.5 text-right`}>
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={`${point.longLabel}-${String(index)}`} className={insightTableRowClassName}>
              <td className="px-4 py-2 text-sm text-[var(--admin-on-surface)]">
                {point.longLabel}
              </td>
              {series.map((item) => (
                <td key={item.key} className="px-4 py-2 text-right font-data text-sm">
                  {formatInsightNumber(point.values[item.key] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <RowCount count={points.length} />
    </div>
  );
}

/** The single reading of a KPI widget as a one-row table. */
export function KpiValueTable({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string | undefined;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Metric</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr className={insightTableRowClassName}>
            <td className="px-5 py-3 text-sm text-[var(--admin-on-surface)]">{label}</td>
            <td className={`px-5 py-3 text-right font-data text-sm ${valueClassName}`}>{value}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function relatedGlyph(icon: InsightWidgetRelatedIcon): ReactNode {
  const className = "h-[18px] w-[18px]";
  switch (icon) {
    case "forecast":
      return <TrendingUp className={className} aria-hidden="true" />;
    case "history":
      return <History className={className} aria-hidden="true" />;
    case "warning":
      return <AlertCircle className={className} aria-hidden="true" />;
    case "users":
      return <Users className={className} aria-hidden="true" />;
    case "receipt":
    case "payments":
    case "wallet":
      return <CreditCard className={className} aria-hidden="true" />;
    case "campaign":
      return <Megaphone className={className} aria-hidden="true" />;
    case "live":
      return <Radio className={className} aria-hidden="true" />;
    case "inbox":
      return <Inbox className={className} aria-hidden="true" />;
  }
}

export type MetadataRow = { label: string; value: string };

/**
 * Related reports and the widget's metadata. `before` renders above the list
 * (an area's own panels), `after` between the list and the metadata.
 */
export function RelatedRail({
  related,
  metadata,
  badge,
  hrefFor,
  emptyAction,
  before,
  after,
}: {
  related: InsightWidgetDetail["related"];
  metadata: MetadataRow[];
  badge?: ((href: string) => string) | undefined;
  hrefFor?: ((href: string) => string) | undefined;
  emptyAction?: { href: string; label: string } | null | undefined;
  before?: ReactNode;
  after?: ReactNode;
}) {
  return (
    <aside className="flex flex-col gap-4 lg:col-span-4">
      {before}
      <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
        Related insights
      </h2>
      {related.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-10 text-center">
          <Inbox className="mb-2 h-6 w-6 text-[var(--admin-outline)]" aria-hidden="true" />
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            No related insights found.
          </p>
          {emptyAction ? (
            <Link
              href={emptyAction.href}
              prefetch={false}
              className={`${insightGhostButtonClassName} mt-4`}
            >
              {emptyAction.label}
            </Link>
          ) : null}
        </div>
      ) : (
        related.map((item) => (
          <Link
            key={item.href}
            href={hrefFor ? hrefFor(item.href) : item.href}
            prefetch={false}
            className="group flex items-start justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 outline-none transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 motion-safe:active:translate-y-px"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--admin-surface-low)] text-[var(--admin-primary)] group-hover:bg-[var(--admin-primary-container)]">
                {relatedGlyph(item.icon)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)]">
                    {item.title}
                  </p>
                  {badge ? (
                    <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-1.5 py-0.5 font-data text-[9px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      {badge(item.href)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-[var(--admin-on-surface-variant)]">
                  {item.description}
                </p>
              </div>
            </div>
            <ArrowRight
              className="mt-1 h-[18px] w-[18px] shrink-0 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          </Link>
        ))
      )}
      {after}
      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
          Widget metadata
        </h3>
        <dl className="flex flex-col gap-2 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
          {metadata.map((row, index) => (
            <div
              key={row.label}
              className={`flex justify-between gap-3 pb-1 ${index < metadata.length - 1 ? "border-b border-[var(--admin-border)]" : ""}`}
            >
              <dt>{row.label}</dt>
              <dd className="text-right text-[var(--admin-on-surface)]">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  );
}

/** The metadata rows every area shows: ID, window, currency, last refresh. */
export function widgetMetadata(
  detail: InsightWidgetDetail,
  window: string,
  currency?: string,
): MetadataRow[] {
  return [
    { label: "ID", value: detail.widget.id },
    { label: "Window", value: window },
    ...(currency ? [{ label: "Currency", value: currency }] : []),
    { label: "Last refreshed", value: formatRelativeTime(detail.generatedAt) },
  ];
}

export function WidgetDetailSkeleton({
  headlineCount = 4,
}: {
  headlineCount?: number | undefined;
}) {
  return (
    <div className="grid grid-cols-12 gap-6" aria-busy="true" aria-label="Loading widget detail">
      <div className="col-span-12 flex flex-wrap gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-8">
        {Array.from({ length: headlineCount }, (_, index) => (
          <div key={index} className="min-w-[140px] flex-1">
            <Shimmer className="mb-3 h-3 w-1/2" />
            <Shimmer className="h-8 w-2/3" />
          </div>
        ))}
      </div>
      <div className="col-span-12 flex flex-col gap-6 lg:col-span-8">
        <div className="flex h-[400px] flex-col rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="mb-6 flex items-center justify-between border-b border-[var(--admin-border)] pb-4">
            <Shimmer className="h-5 w-40" />
            <div className="flex gap-2">
              <Shimmer className="h-8 w-16" />
              <Shimmer className="h-8 w-16" />
            </div>
          </div>
          <div className="flex flex-1 items-end gap-4">
            {["60%", "80%", "40%", "90%", "30%", "70%", "50%"].map((height) => (
              <div
                key={height}
                className={insightShimmerClassName}
                style={{ height, width: "100%", borderRadius: "2px 2px 0 0" }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
        {[3, 3].map((rows, panel) => (
          <div
            key={panel}
            className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]"
          >
            <div className="border-b border-[var(--admin-border)] p-4">
              <Shimmer className="h-4 w-32" />
            </div>
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="rounded bg-[var(--admin-surface-low)] p-3">
                  <Shimmer className="mb-2 h-3 w-full" />
                  <Shimmer className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
