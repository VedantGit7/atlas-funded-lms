"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Search } from "lucide-react";
import { adminInsightContentHealthHref, adminInsightFunnelHref } from "./admin-insights-catalog";
import type {
  InsightDashboardRange,
  InsightWidget,
  InsightWidgetDetail,
} from "./admin-insights-api";
import { formatInsightNumber } from "./admin-insights-format";
import {
  INSIGHT_RANGE_OPTIONS,
  insightKpiValueClassName,
  insightPanelClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";
import {
  cell,
  ChartLegend,
  DeltaReading,
  DetailPanel,
  EmptyCanvas,
  formatAmount,
  HeadlineCell,
  HeadlineDivider,
  HeadlineStrip,
  InsightNote,
  LEGEND_AVERAGE_SWATCH,
  LEGEND_CURRENT_SWATCH,
  NoComparison,
  numericValue,
  RelatedRail,
  SplitBreakdown,
  SplitTable,
  stringValue,
  UnderlyingDataToggle,
  UnderlyingTable,
  widgetMetadata,
} from "./insight-detail-kit";
import { SeriesChart, seriesPoints, singleSeriesTooltip } from "./insight-detail-charts";
import { InsightDataTable } from "./insight-detail-data-table";
import {
  InsightWidgetDetailView,
  type DetailCanvas,
  type DetailViz,
  type InsightDetailArea,
  type InsightWidgetDetailViewProps,
} from "./InsightWidgetDetailView";
import {
  SCHOOL_VITALS_INVERTED_KPI_IDS,
  SCHOOL_VITALS_PERCENT_KPI_IDS,
} from "./school-vitals-meta";

function measureKey(widget: InsightWidget): string {
  return widget.data.measures?.[0] ?? (widget.id === "engagement-funnel" ? "count" : "value");
}

function widgetHasNoEvents(widget: InsightWidget): boolean {
  if (widget.id === "content-health") return widget.data.rows.length === 0;
  if (widget.data.rows.length === 0) return true;
  const key = measureKey(widget);
  return widget.data.rows.every((row) => numericValue(cell(row, key)) === 0);
}

function formatMetric(value: number, widgetId: string): string {
  return SCHOOL_VITALS_PERCENT_KPI_IDS.has(widgetId)
    ? `${formatAmount(value)}%`
    : formatAmount(value);
}

function vizOptions(widget: InsightWidget): DetailViz[] {
  if (widget.id === "engagement-funnel" || widget.defaultViz === "funnel") {
    return ["funnel", "bar", "table"];
  }
  if (
    widget.id === "content-health" ||
    widget.id === "top-courses" ||
    widget.defaultViz === "table"
  ) {
    return ["table", "bar"];
  }
  if (widget.defaultViz === "kpi") return ["table"];
  if (widget.defaultViz === "area") return ["area", "line", "bar", "table"];
  return ["line", "area", "bar", "table"];
}

/** Related Insights pages open on the same date range. */
function relatedHref(href: string, range: InsightDashboardRange): string {
  if (!href.includes("/admin/insights/") || href.includes("?")) return href;
  return `${href}?range=${range}`;
}

function reportHref(detail: InsightWidgetDetail | null): string | null {
  return (
    detail?.widget.href ??
    detail?.related.find((item) => item.href.startsWith("/admin/reports"))?.href ??
    null
  );
}

function rangeLabel(range: InsightDashboardRange): string {
  return INSIGHT_RANGE_OPTIONS.find((option) => option.value === range)?.label ?? range;
}

function stageSplits(widget: InsightWidget) {
  const total =
    widget.data.rows.reduce((sum, row) => sum + numericValue(cell(row, "count")), 0) || 1;
  return widget.data.rows.map((row) => {
    const count = numericValue(cell(row, "count"));
    return {
      label: stringValue(cell(row, "stage")),
      value: count,
      share: Math.round((count / total) * 1000) / 10,
    };
  });
}

function FunnelPanel({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  const total = rows.reduce((sum, row) => sum + numericValue(cell(row, "count")), 0);
  const max = Math.max(...rows.map((row) => numericValue(cell(row, "count"))), 1);
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row, index) => {
        const count = numericValue(cell(row, "count"));
        const share = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
        const width = `${String(Math.max((count / max) * 100, count > 0 ? 6 : 0))}%`;
        return (
          <div
            key={`${stringValue(cell(row, "stage"))}-${String(index)}`}
            className="grid grid-cols-12 items-center gap-3"
          >
            <div className="col-span-12 truncate text-sm text-[var(--admin-on-surface)] md:col-span-3 md:text-right">
              {stringValue(cell(row, "stage"))}
            </div>
            <div className="col-span-12 h-6 overflow-hidden rounded-sm bg-[var(--admin-surface-variant)] md:col-span-6">
              <div
                className="h-full rounded-sm bg-[var(--admin-primary)]"
                style={{ width, opacity: Math.max(0.5, 1 - index * 0.08) }}
              />
            </div>
            <div className="col-span-12 flex justify-between font-data text-sm text-[var(--admin-on-surface)] md:col-span-3">
              <span>{formatInsightNumber(count)}</span>
              <span className="text-[var(--admin-on-surface-variant)]">{`${formatAmount(share)}%`}</span>
            </div>
          </div>
        );
      })}
      {widget.footnote ? (
        <p className="border-t border-[var(--admin-border)] pt-4 text-xs text-[var(--admin-on-surface-variant)]">
          {widget.footnote}
        </p>
      ) : null}
    </div>
  );
}

function ContentHealthTable({ widget }: { widget: InsightWidget }) {
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState<"all" | "warning" | "neutral">("all");
  const [sortKey, setSortKey] = useState("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let next = widget.data.rows;
    if (needle) {
      next = next.filter((row) =>
        ["signal", "consequence", "tone"].some((key) =>
          stringValue(cell(row, key)).toLowerCase().includes(needle),
        ),
      );
    }
    if (tone !== "all") {
      next = next.filter((row) => stringValue(cell(row, "tone"), "neutral") === tone);
    }
    return [...next].sort((a, b) => {
      const av = cell(a, sortKey);
      const bv = cell(b, sortKey);
      const an = typeof av === "number" ? av : Number(av);
      const bn = typeof bv === "number" ? bv : Number(bv);
      if (Number.isFinite(an) && Number.isFinite(bn)) {
        return sortDir === "asc" ? an - bn : bn - an;
      }
      return sortDir === "asc"
        ? stringValue(av).localeCompare(stringValue(bv))
        : stringValue(bv).localeCompare(stringValue(av));
    });
  }, [query, sortDir, sortKey, tone, widget.data.rows]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "count" ? "desc" : "asc");
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3">
        <label className="relative h-9 w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search signals..."
            aria-label="Search signals"
            className="h-full w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </label>
        <div className={insightSegmentTrackClassName} role="group" aria-label="Filter by tone">
          {(["all", "warning", "neutral"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={
                tone === option
                  ? insightSegmentButtonActiveClassName
                  : insightSegmentButtonClassName
              }
              onClick={() => {
                setTone(option);
              }}
            >
              {option === "all" ? "All" : option === "warning" ? "Warning" : "Neutral"}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {(
                [
                  { key: "signal", label: "Signal", numeric: false },
                  { key: "count", label: "Count", numeric: true },
                  { key: "tone", label: "Consequence", numeric: false },
                  { key: "href", label: "Action", numeric: false },
                ] as const
              ).map((column) => (
                <th
                  key={column.key}
                  className={`${insightTableHeadClassName} px-4 py-3 ${column.numeric ? "text-right" : ""}`}
                >
                  {column.key === "href" ? (
                    column.label
                  ) : (
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 ${column.numeric ? "w-full justify-end" : ""}`}
                      onClick={() => {
                        toggleSort(column.key);
                      }}
                    >
                      {column.label}
                      {sortKey === column.key ? (
                        sortDir === "desc" ? (
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        )
                      ) : null}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const warning =
                stringValue(cell(row, "tone")) === "warning" &&
                numericValue(cell(row, "count")) > 0;
              const href = stringValue(cell(row, "href"));
              return (
                <tr
                  key={`${stringValue(cell(row, "signal"))}-${String(index)}`}
                  className={`${insightTableRowClassName} group`}
                >
                  <td className="px-4 py-2 text-sm font-medium text-[var(--admin-on-surface)]">
                    {stringValue(cell(row, "signal"))}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-sm">
                    {formatInsightNumber(numericValue(cell(row, "count")))}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] uppercase tracking-wide ${
                        warning
                          ? "border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] text-[var(--admin-warning)]"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]"
                      }`}
                    >
                      {warning ? "Warning" : "Neutral"}
                    </span>
                    <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      {stringValue(cell(row, "consequence"))}
                    </p>
                  </td>
                  <td className="px-4 py-2">
                    {href ? (
                      <Link
                        href={href}
                        prefetch={false}
                        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-primary)] opacity-100 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                      >
                        Review
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex h-12 items-center justify-between border-t border-[var(--admin-border)] px-4 text-xs text-[var(--admin-on-surface-variant)]">
        <span>{`Showing ${String(rows.length)} of ${String(widget.data.rows.length)} signals`}</span>
      </div>
    </div>
  );
}

function SchoolVitalsHeadline({ canvas }: { canvas: DetailCanvas }) {
  const { detail, widget, empty, range } = canvas;
  const comparison = detail.comparison;
  const inverted = SCHOOL_VITALS_INVERTED_KPI_IDS.has(widget.id);
  const key = measureKey(widget);
  const points = seriesPoints(widget, range, [key]);
  const values = points.map((point) => point.values[key] ?? 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  const headlineValue =
    comparison?.current ??
    (widget.defaultViz === "kpi"
      ? numericValue(cell(widget.data.rows[0], "value"))
      : widget.id === "daily-active-users" && values.length > 0
        ? Math.round(total / values.length)
        : total || numericValue(cell(widget.data.rows[0], key)));
  const peak =
    widget.defaultViz === "kpi" || points.length === 0
      ? null
      : points.reduce((best, point) =>
          (point.values[key] ?? 0) > (best.values[key] ?? 0) ? point : best,
        );

  return (
    <HeadlineStrip>
      <HeadlineCell label={comparison?.currentLabel ?? "Selected window"}>
        <div
          className={`${insightKpiValueClassName} ${inverted ? "text-[var(--admin-warning)]" : ""}`}
        >
          {empty ? "0" : formatMetric(headlineValue, widget.id)}
        </div>
        {empty ? (
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            No data in selected window
          </p>
        ) : inverted ? (
          <p className="mt-1 text-[10px] text-[var(--admin-warning)]">Higher is worse</p>
        ) : null}
      </HeadlineCell>
      <HeadlineDivider from="md" />
      <HeadlineCell label={comparison?.previousLabel ?? "Previous window"}>
        {comparison ? (
          <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
            {formatMetric(comparison.previous, widget.id)}
          </span>
        ) : (
          <NoComparison />
        )}
      </HeadlineCell>
      <HeadlineCell label="Change">
        {comparison ? (
          <DeltaReading
            delta={comparison.deltaAbs}
            text={formatMetric(comparison.deltaAbs, widget.id)}
            pct={comparison.deltaPct}
            polarity={inverted ? "inverted" : "normal"}
          />
        ) : (
          <NoComparison />
        )}
      </HeadlineCell>
      <HeadlineDivider />
      <HeadlineCell label={peak ? `Peak (${peak.longLabel})` : "Average"}>
        <span className="font-data text-sm text-[var(--admin-on-surface)]">
          {peak
            ? formatInsightNumber(peak.values[key] ?? 0)
            : detail.average != null
              ? formatAmount(detail.average)
              : "n/a"}
        </span>
        {detail.average != null && peak ? (
          <p className="mt-1 text-[11px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            {`Average ${formatAmount(detail.average)}`}
          </p>
        ) : null}
      </HeadlineCell>
    </HeadlineStrip>
  );
}

function SchoolVitalsMain({ canvas }: { canvas: DetailCanvas }) {
  const { detail, widget, viz, empty, range, copyCsv } = canvas;
  const key = measureKey(widget);
  const chartViz = viz === "bar" ? "bar" : viz === "area" ? "area" : "line";
  const chart = (
    <SeriesChart
      points={seriesPoints(widget, range, [key])}
      series={[{ key, label: widget.title, color: "var(--admin-primary)" }]}
      mainKey={key}
      viz={chartViz}
      average={detail.average}
      widgetTitle={widget.title}
      formatTick={(value) => formatInsightNumber(value, value >= 100 ? 0 : 1)}
      tooltip={singleSeriesTooltip(key, (value) => formatInsightNumber(value))}
    />
  );
  const report = reportHref(detail);

  if (widget.id === "content-health") {
    return empty ? (
      <DetailPanel title={widget.title}>
        <EmptyCanvas
          title="No content health signals yet"
          body="Dormant courses, inactivity, and moderation load will list here."
        />
      </DetailPanel>
    ) : (
      <ContentHealthTable widget={widget} />
    );
  }

  if (widget.id === "engagement-funnel") {
    return (
      <>
        <SchoolVitalsHeadline canvas={canvas} />
        <section className={`${insightPanelClassName} p-5`}>
          <div className="mb-4 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
            These are event counts over the window, not a single cohort moving through steps. A
            learner can appear in several stages, and later stages are not subsets of earlier ones.
          </div>
          {empty ? (
            <EmptyCanvas
              title="No learning events recorded in this window"
              body="Engagement funnels need session data to render stage counts."
              href={report}
            />
          ) : viz === "table" ? (
            <SplitTable rows={stageSplits(widget)} />
          ) : (
            <FunnelPanel widget={widget} />
          )}
        </section>
        {!empty ? (
          <DetailPanel title="Stage splits">
            <SplitTable rows={stageSplits(widget)} />
          </DetailPanel>
        ) : null}
        {viz !== "table" && !empty ? (
          <UnderlyingDataToggle onCopyCsv={copyCsv}>
            <UnderlyingTable widget={widget} range={range} />
          </UnderlyingDataToggle>
        ) : null}
      </>
    );
  }

  const tableWidget = widget.id === "top-courses" || widget.defaultViz === "table";
  return (
    <>
      <SchoolVitalsHeadline canvas={canvas} />
      {tableWidget && viz === "table" && !empty ? (
        <InsightDataTable widget={widget} />
      ) : (
        <DetailPanel
          title={viz === "table" ? "Records" : "Trend"}
          aside={
            detail.average != null && viz !== "table" ? (
              <ChartLegend
                items={[
                  { label: "Current period", swatch: LEGEND_CURRENT_SWATCH },
                  { label: "Average", swatch: LEGEND_AVERAGE_SWATCH },
                ]}
              />
            ) : null
          }
        >
          <div className="p-5">
            {empty ? (
              <EmptyCanvas
                title="No learning events recorded in this window"
                body="Activity appears here once learners interact with modules."
                href={report}
              />
            ) : viz === "table" ? (
              <UnderlyingTable widget={widget} range={range} />
            ) : viz === "funnel" ? (
              <FunnelPanel widget={widget} />
            ) : (
              chart
            )}
          </div>
          {detail.insightNote && !empty ? <InsightNote note={detail.insightNote} /> : null}
        </DetailPanel>
      )}
      {viz !== "table" ? <SplitBreakdown detail={detail} /> : null}
      {viz !== "table" && !empty ? (
        <UnderlyingDataToggle onCopyCsv={copyCsv}>
          <UnderlyingTable widget={widget} range={range} />
        </UnderlyingDataToggle>
      ) : null}
    </>
  );
}

function schoolVitalsArea(slug: string): InsightDetailArea {
  return {
    vizOptions,
    isEmpty: widgetHasNoEvents,
    rangePicker: true,
    primaryAction: (detail) => {
      if (detail?.widget.id === "engagement-funnel") {
        return {
          href: `${adminInsightFunnelHref(slug)}?range=${detail.range}`,
          label: "Open full funnel",
        };
      }
      if (detail?.widget.id === "content-health") {
        return {
          href: `${adminInsightContentHealthHref(slug)}?range=${detail.range}`,
          label: "Open full content health",
        };
      }
      const href = reportHref(detail);
      return href ? { href, label: "Open the full report" } : null;
    },
    renderMain: (canvas) => <SchoolVitalsMain canvas={canvas} />,
    renderRail: ({ detail, range }) => (
      <RelatedRail
        related={detail.related}
        hrefFor={(href) => relatedHref(href, range)}
        metadata={widgetMetadata(detail, rangeLabel(range))}
      />
    ),
  };
}

export function SchoolVitalsWidgetDetailView(props: InsightWidgetDetailViewProps) {
  return <InsightWidgetDetailView {...props} area={schoolVitalsArea(props.slug)} />;
}
