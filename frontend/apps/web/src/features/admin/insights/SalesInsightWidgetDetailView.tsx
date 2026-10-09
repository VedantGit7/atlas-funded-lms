"use client";

import { CheckCircle2 } from "lucide-react";
import {
  adminInsightAttributionHref,
  adminInsightOpportunityHref,
  adminInsightPipelineHref,
} from "./admin-insights-catalog";
import type { InsightWidget, InsightWidgetDetail } from "./admin-insights-api";
import { formatInsightMoneyWithCode, formatInsightNumber } from "./admin-insights-format";
import {
  insightKpiValueClassName,
  insightPanelClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";
import {
  cell,
  ChartLegend,
  DeltaReading,
  DetailPanel,
  EmptyCanvas,
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
  SALES_FIXED_WINDOW_CAPTION,
  SALES_INSIGHT_FUNNEL_IDS,
  SALES_INSIGHT_INVERTED_WIDGET_IDS,
  SALES_INSIGHT_MONEY_WIDGET_IDS,
  SALES_INSIGHT_PERCENT_KPI_IDS,
  SALES_INSIGHT_TABLE_IDS,
  SALES_PIPELINE_EMPTY_CAPTION,
} from "./sales-insight-meta";

function measureKey(widget: InsightWidget): string {
  if (widget.id === "top-products" || widget.id === "top-sources") return "revenue";
  if (widget.id === "failed-payments") return "amount";
  return widget.data.measures?.[0] ?? (SALES_INSIGHT_FUNNEL_IDS.has(widget.id) ? "count" : "value");
}

function isMoneyWidget(widgetId: string): boolean {
  return SALES_INSIGHT_MONEY_WIDGET_IDS.has(widgetId);
}

function isPercent(widgetId: string): boolean {
  return SALES_INSIGHT_PERCENT_KPI_IDS.has(widgetId);
}

function moneyColumn(key: string): boolean {
  return key === "revenue" || key === "amount" || key === "value";
}

function widgetHasNoEvents(widget: InsightWidget): boolean {
  if (widget.data.rows.length === 0) return true;
  if (SALES_INSIGHT_FUNNEL_IDS.has(widget.id)) {
    return numericValue(cell(widget.data.rows[0], "count")) <= 0;
  }
  if (isPercent(widget.id) && widget.footnote === SALES_PIPELINE_EMPTY_CAPTION) return true;
  const key = measureKey(widget);
  return widget.data.rows.every((row) => numericValue(cell(row, key)) === 0);
}

function formatMetric(value: number, widgetId: string, currency?: string): string {
  if (isPercent(widgetId)) return `${formatInsightNumber(value)}%`;
  if (isMoneyWidget(widgetId)) return formatInsightMoneyWithCode(value, currency);
  return formatInsightNumber(value, value % 1 === 0 ? 0 : 1);
}

function formatTick(value: number, money: boolean): string {
  if (money) {
    if (value >= 1_000_000) return `${formatInsightNumber(value / 1_000_000, 1)}M`;
    if (value >= 1000) return `${formatInsightNumber(value / 1000, 0)}k`;
  }
  return formatInsightNumber(value, value >= 100 ? 0 : 1);
}

function vizOptions(widget: InsightWidget): DetailViz[] {
  if (SALES_INSIGHT_FUNNEL_IDS.has(widget.id) || widget.defaultViz === "funnel") {
    return ["funnel", "bar", "table"];
  }
  if (SALES_INSIGHT_TABLE_IDS.has(widget.id) || widget.defaultViz === "table") {
    return ["table", "bar"];
  }
  if (widget.defaultViz === "kpi") return ["table"];
  if (widget.defaultViz === "area") return ["area", "line", "bar", "table"];
  if (widget.defaultViz === "bar") return ["bar", "table"];
  return ["line", "area", "bar", "table"];
}

function pipelineCounts(widget: InsightWidget) {
  const rows = widget.data.rows;
  return {
    visited: numericValue(cell(rows[0], "count")),
    started: numericValue(cell(rows[1], "count")),
    enrolled: numericValue(cell(rows[2], "count")),
  };
}

function stepConversion(from: number, to: number): string {
  if (from <= 0) return "-";
  return `${formatInsightNumber(Math.round((to / from) * 100))}%`;
}

function reportHref(detail: InsightWidgetDetail | null): string | null {
  return (
    detail?.widget.href ??
    detail?.related.find((item) => item.href.startsWith("/admin/reports"))?.href ??
    null
  );
}

function FunnelConnector({ rate }: { rate: string }) {
  return (
    <div className="relative z-0 -my-1 flex w-full justify-center">
      <svg fill="none" height="40" viewBox="0 0 120 40" width="120" aria-hidden="true">
        <path d="M0 0L30 40H90L120 0H0Z" fill="var(--admin-border)" fillOpacity="0.55" />
        <path
          d="M0 0L30 40M120 0L90 40"
          stroke="var(--admin-outline)"
          strokeDasharray="2 2"
          strokeWidth="1"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="z-[1] rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-2 py-0.5 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
          {rate}
        </span>
      </div>
    </div>
  );
}

function FunnelPanel({ widget }: { widget: InsightWidget }) {
  const { visited, started, enrolled } = pipelineCounts(widget);
  const empty = visited <= 0;
  const stages = [
    { label: "Visited", count: visited, width: "90%", terminal: false },
    { label: "Started diagnostic", count: started, width: "75%", terminal: false },
    { label: "Enrolled", count: enrolled, width: "60%", terminal: true },
  ];
  const connectors = [stepConversion(visited, started), stepConversion(started, enrolled)];
  const dropoffs = [
    { count: null as number | null, rate: "-" },
    { count: Math.max(visited - started, 0), rate: stepConversion(visited, started) },
    { count: Math.max(started - enrolled, 0), rate: stepConversion(started, enrolled) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex min-h-[280px] w-full flex-col items-center justify-center py-4">
        {stages.map((stage, index) => (
          <div key={stage.label} className="flex w-full flex-col items-center">
            <div
              className={`relative z-[1] flex h-16 w-full items-center justify-between px-6 transition-colors ${
                stage.terminal
                  ? "rounded-b-lg border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))]"
                  : index === 0
                    ? "rounded-t-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]"
                    : "border border-[var(--admin-border)] bg-[var(--admin-surface-low)]"
              }`}
              style={{ maxWidth: stage.width }}
            >
              <span
                className={`text-sm font-medium ${
                  stage.terminal ? "text-[var(--admin-primary)]" : "text-[var(--admin-on-surface)]"
                }`}
              >
                {stage.label}
              </span>
              <span
                className={`font-data text-sm ${
                  stage.terminal
                    ? "font-semibold text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface)]"
                }`}
              >
                {empty ? "-" : formatInsightNumber(stage.count)}
              </span>
            </div>
            {index < connectors.length ? (
              <FunnelConnector rate={empty ? "-" : (connectors[index] ?? "-")} />
            ) : null}
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--admin-border)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[var(--admin-surface-low)]">
              <th className={`${insightTableHeadClassName} px-4 py-3`}>Stage name</th>
              <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>Count</th>
              <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>
                Conversion rate
              </th>
              <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>Drop-off</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, index) => {
              const dropoff = dropoffs.at(index) ?? { count: null, rate: "-" };
              return (
                <tr
                  key={stage.label}
                  className={`${insightTableRowClassName} ${
                    stage.terminal
                      ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                      : ""
                  }`}
                >
                  <td
                    className={`relative px-4 py-2 text-sm font-medium ${
                      stage.terminal
                        ? "text-[var(--admin-primary)]"
                        : "text-[var(--admin-on-surface)]"
                    }`}
                  >
                    {stage.terminal ? (
                      <span
                        className="absolute inset-y-0 left-0 w-0.5 bg-[var(--admin-primary)]"
                        aria-hidden="true"
                      />
                    ) : null}
                    {stage.label}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-data text-sm ${
                      stage.terminal ? "font-semibold text-[var(--admin-primary)]" : ""
                    }`}
                  >
                    {empty ? "-" : formatInsightNumber(stage.count)}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-sm">
                    {empty ? "-" : dropoff.rate}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-danger)]">
                    {empty || dropoff.count == null ? "-" : formatInsightNumber(dropoff.count)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {widget.footnote ? (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">{widget.footnote}</p>
      ) : null}
    </div>
  );
}

function SalesHeadline({ canvas }: { canvas: DetailCanvas }) {
  const { detail, widget, empty } = canvas;
  const currency = detail.currency;
  const comparison = detail.comparison;

  if (SALES_INSIGHT_FUNNEL_IDS.has(widget.id)) {
    const { visited, enrolled } = pipelineCounts(widget);
    return (
      <HeadlineStrip>
        <HeadlineCell label="Conversion">
          <div className={`${insightKpiValueClassName} text-[var(--admin-primary)]`}>
            {stepConversion(visited, enrolled)}
          </div>
        </HeadlineCell>
        <HeadlineDivider from="md" />
        <HeadlineCell label="Visited">
          <div className={insightKpiValueClassName}>
            {empty ? "-" : formatInsightNumber(visited)}
          </div>
        </HeadlineCell>
        <HeadlineDivider />
        <HeadlineCell label="Enrolled">
          <div className={insightKpiValueClassName}>
            {empty ? "-" : formatInsightNumber(enrolled)}
          </div>
        </HeadlineCell>
      </HeadlineStrip>
    );
  }

  const inverted = SALES_INSIGHT_INVERTED_WIDGET_IDS.has(widget.id);
  const money = isMoneyWidget(widget.id);
  const total = seriesPoints(widget, canvas.range, [measureKey(widget)]).reduce(
    (sum, point) => sum + (point.values[measureKey(widget)] ?? 0),
    0,
  );
  const headlineValue =
    comparison?.current ??
    (widget.defaultViz === "kpi"
      ? numericValue(cell(widget.data.rows[0], "value"))
      : total || numericValue(cell(widget.data.rows[0], measureKey(widget))));
  const failed = widget.id === "failed-payments";

  return (
    <HeadlineStrip>
      <HeadlineCell
        label={
          failed
            ? "Total failed volume"
            : (comparison?.currentLabel ?? (money ? "Total revenue" : "Current"))
        }
      >
        <div
          className={`${insightKpiValueClassName} ${inverted ? "text-[var(--admin-warning)]" : ""}`}
        >
          {empty && isPercent(widget.id)
            ? "-"
            : formatMetric(empty && failed ? 0 : headlineValue, widget.id, currency)}
        </div>
        {empty && failed ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
            <CheckCircle2 className="h-4 w-4 text-[var(--admin-success)]" aria-hidden="true" />
            No failed payments in this window
          </div>
        ) : inverted ? (
          <p className="mt-1 text-[10px] text-[var(--admin-warning)]">Higher is worse</p>
        ) : null}
      </HeadlineCell>
      <HeadlineDivider from="md" />
      <HeadlineCell label={comparison?.previousLabel ?? "Previous period"}>
        {comparison ? (
          <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
            {formatMetric(comparison.previous, widget.id, currency)}
          </span>
        ) : (
          <NoComparison />
        )}
      </HeadlineCell>
      <HeadlineCell label="Delta">
        {comparison ? (
          <DeltaReading
            delta={comparison.deltaAbs}
            text={formatMetric(comparison.deltaAbs, widget.id, currency)}
            pct={comparison.deltaPct}
            polarity={inverted ? "inverted" : "normal"}
          />
        ) : (
          <NoComparison />
        )}
      </HeadlineCell>
      {detail.average != null ? (
        <>
          <HeadlineDivider />
          <HeadlineCell label={widget.id === "top-products" ? "Average / product" : "Average / mo"}>
            <span className="font-data text-sm text-[var(--admin-on-surface)]">
              {formatMetric(detail.average, widget.id, currency)}
            </span>
          </HeadlineCell>
        </>
      ) : null}
      {detail.failureRate ? (
        <>
          <HeadlineDivider />
          <HeadlineCell label="Failure rate">
            <span className="font-data text-sm text-[var(--admin-warning)]">
              {`${formatInsightNumber(detail.failureRate.currentPct, detail.failureRate.currentPct % 1 === 0 ? 0 : 1)}%`}
            </span>
            {detail.failureRate.note ? (
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                {detail.failureRate.note}
              </p>
            ) : null}
          </HeadlineCell>
        </>
      ) : null}
    </HeadlineStrip>
  );
}

const EMPTY_TABLE_COPY: Record<string, { title: string; body: string; action?: string }> = {
  "failed-payments": {
    title: "No failed payments recorded.",
    body: "Everything is running smoothly. Your transaction pipeline is currently clear of errors or declined payments for the selected window.",
    action: "Open reports",
  },
  "top-products": { title: "No products yet", body: "Records appear here once activity starts." },
  "top-sources": {
    title: "No attribution events recorded",
    body: "Sources come from tracked visits. Open attribution once campaign events start arriving.",
    action: "Open attribution",
  },
  "opportunity-pool": {
    title: "No data in this window",
    body: "Enrollment segments appear after the first enrollment is recorded.",
    action: "Open opportunity",
  },
};

function SalesMain({ canvas }: { canvas: DetailCanvas }) {
  const { slug, detail, widget, viz, empty, range, copyCsv } = canvas;
  const currency = detail.currency;
  const money = isMoneyWidget(widget.id);
  const funnel = SALES_INSIGHT_FUNNEL_IDS.has(widget.id);
  const tableDefault = SALES_INSIGHT_TABLE_IDS.has(widget.id);
  const key = measureKey(widget);
  const moneyColumns = money ? moneyColumn : undefined;
  const report = reportHref(detail);

  let panel;
  if (funnel) {
    const visited = pipelineCounts(widget).visited || 1;
    panel = (
      <section className={`${insightPanelClassName} p-6`}>
        <div className="mb-4 flex items-center justify-between border-b border-[var(--admin-border)] pb-4">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Funnel visualization
          </h2>
        </div>
        {viz === "table" && !empty ? (
          <SplitTable
            rows={widget.data.rows.map((row) => {
              const count = numericValue(cell(row, "count"));
              return {
                label: stringValue(cell(row, "stage")),
                value: count,
                share: Math.round((count / visited) * 1000) / 10,
              };
            })}
          />
        ) : viz === "bar" && !empty ? (
          <SeriesChart
            points={widget.data.rows.map((row) => ({
              label: stringValue(cell(row, "stage")),
              longLabel: stringValue(cell(row, "stage")),
              values: { count: numericValue(cell(row, "count")) },
            }))}
            series={[{ key: "count", label: widget.title, color: "var(--admin-primary)" }]}
            mainKey="count"
            viz="bar"
            average={null}
            widgetTitle={widget.title}
            formatTick={(value) => formatTick(value, false)}
            tooltip={singleSeriesTooltip("count", (value) => formatInsightNumber(value))}
          />
        ) : (
          <FunnelPanel widget={widget} />
        )}
      </section>
    );
  } else if (tableDefault && viz === "table") {
    const copy = EMPTY_TABLE_COPY[widget.id];
    const failed = widget.id === "failed-payments";
    panel = empty ? (
      <DetailPanel title={failed ? "Transaction timeline" : widget.title}>
        <EmptyCanvas
          title={copy?.title ?? "No data in this window"}
          body={copy?.body ?? "Records appear here once activity starts."}
          href={
            widget.id === "top-sources"
              ? adminInsightAttributionHref(slug)
              : widget.id === "opportunity-pool"
                ? adminInsightOpportunityHref(slug)
                : report
          }
          hrefLabel={copy?.action}
          success={failed}
          icon={failed ? <CheckCircle2 className="h-12 w-12" aria-hidden="true" /> : undefined}
        />
      </DetailPanel>
    ) : (
      <InsightDataTable
        widget={widget}
        currency={currency}
        isMoneyColumn={moneyColumns}
        shareKey={widget.id === "top-products" || widget.id === "top-sources" ? key : null}
        initialSortKey={
          widget.data.columns.find(
            (column) =>
              column.key === "revenue" || column.key === "amount" || column.kind === "measure",
          )?.key
        }
        searchPlaceholder={widget.id === "top-products" ? "Search products..." : undefined}
        leadEmphasis={widget.id === "top-products"}
        isDangerRow={failed ? () => true : undefined}
      />
    );
  } else {
    const formatValue = (value: number) =>
      money ? formatInsightMoneyWithCode(value, currency) : formatInsightNumber(value);
    panel = (
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
              title={
                widget.id === "monthly-revenue"
                  ? "No paid revenue in the last 12 months"
                  : "No data in this window"
              }
              body={
                widget.id === "monthly-revenue"
                  ? "Paid orders will plot here once checkout activity starts."
                  : "Activity appears here once events are recorded."
              }
              href={report}
            />
          ) : viz === "table" ? (
            <UnderlyingTable
              widget={widget}
              range={range}
              isMoneyColumn={moneyColumns}
              currency={currency}
            />
          ) : (
            <SeriesChart
              points={seriesPoints(widget, range, [key])}
              series={[{ key, label: widget.title, color: "var(--admin-primary)" }]}
              mainKey={key}
              viz={viz === "bar" ? "bar" : viz === "area" ? "area" : "line"}
              average={detail.average}
              widgetTitle={widget.title}
              formatTick={(value) => formatTick(value, money)}
              formatAverage={(value) =>
                `${formatTick(value, money)}${money && currency ? ` ${currency}` : ""}`
              }
              tooltip={singleSeriesTooltip(key, formatValue)}
            />
          )}
        </div>
        {detail.insightNote && !empty ? <InsightNote note={detail.insightNote} /> : null}
      </DetailPanel>
    );
  }

  const showSplits = !funnel && (tableDefault ? !empty && viz === "table" : viz !== "table");
  return (
    <>
      <SalesHeadline canvas={canvas} />
      {panel}
      {showSplits ? <SplitBreakdown detail={detail} money={money} currency={currency} /> : null}
      {viz !== "table" && !tableDefault && !empty ? (
        <UnderlyingDataToggle onCopyCsv={copyCsv}>
          <UnderlyingTable
            widget={widget}
            range={range}
            isMoneyColumn={moneyColumns}
            currency={currency}
          />
        </UnderlyingDataToggle>
      ) : null}
    </>
  );
}

function salesArea(slug: string): InsightDetailArea {
  return {
    vizOptions,
    isEmpty: widgetHasNoEvents,
    primaryAction: (detail) => {
      const id = detail?.widget.id;
      if (id && SALES_INSIGHT_FUNNEL_IDS.has(id)) {
        return { href: adminInsightPipelineHref(slug), label: "Compare windows" };
      }
      if (id === "top-sources") {
        return { href: adminInsightAttributionHref(slug), label: "Open attribution" };
      }
      if (id === "opportunity-pool") {
        return { href: adminInsightOpportunityHref(slug), label: "Open opportunity" };
      }
      const href = reportHref(detail);
      return href ? { href, label: "Open the full report" } : null;
    },
    renderMain: (canvas) => <SalesMain canvas={canvas} />,
    renderRail: ({ detail }) => (
      <RelatedRail
        related={detail.related}
        metadata={widgetMetadata(detail, SALES_FIXED_WINDOW_CAPTION, detail.currency)}
      />
    ),
  };
}

export function SalesInsightWidgetDetailView(props: InsightWidgetDetailViewProps) {
  return <InsightWidgetDetailView {...props} area={salesArea(props.slug)} />;
}
