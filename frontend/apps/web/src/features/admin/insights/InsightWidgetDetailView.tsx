"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AreaChart,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  Copy,
  Download,
  Filter,
  LineChart,
  RefreshCw,
  Table2,
  X,
} from "lucide-react";
import {
  ADMIN_INSIGHTS_HREF,
  adminInsightHref,
  adminInsightWidgetHref,
} from "./admin-insights-catalog";
import type {
  InsightDashboardRange,
  InsightWidget,
  InsightWidgetDetail,
} from "./admin-insights-api";
import {
  formatInsightMoneyWithCode,
  formatInsightNumber,
  widgetToCsv,
} from "./admin-insights-format";
import {
  INSIGHT_RANGE_OPTIONS,
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
  insightKpiValueClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPrimaryButtonClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
} from "./admin-insights-shared";
import {
  cell,
  ChartLegend,
  copyText,
  DeltaReading,
  DetailPanel,
  downloadCsv,
  EmptyCanvas,
  exportColumns,
  formatAmount,
  HeadlineCell,
  HeadlineDivider,
  HeadlineStrip,
  InsightNote,
  isKpiWidget,
  KpiValueTable,
  LEGEND_AVERAGE_SWATCH,
  LEGEND_CURRENT_SWATCH,
  NoComparison,
  numericValue,
  RelatedRail,
  Shimmer,
  SplitBreakdown,
  UnderlyingDataToggle,
  UnderlyingTable,
  widgetMetadata,
  WidgetDetailSkeleton,
} from "./insight-detail-kit";
import {
  seriesColor,
  SeriesChart,
  seriesPoints,
  singleSeriesTooltip,
  widgetMeasureKeys,
} from "./insight-detail-charts";
import { InsightDataTable } from "./insight-detail-data-table";

export type DetailViz = "area" | "line" | "bar" | "funnel" | "table";

export type InsightWidgetDetailViewProps = {
  slug: string;
  sectionTitle: string;
  detail: InsightWidgetDetail | null;
  loading: boolean;
  error: string | null;
  range: InsightDashboardRange;
  overlay: boolean;
  onRangeChange: (range: InsightDashboardRange) => void;
  onRefresh: () => void;
};

/** What an area's main column and rail render from. */
export type DetailCanvas = {
  slug: string;
  range: InsightDashboardRange;
  overlay: boolean;
  detail: InsightWidgetDetail;
  widget: InsightWidget;
  viz: DetailViz;
  empty: boolean;
  /** Copies the widget's rows as CSV and confirms it on the toolbar button. */
  copyCsv: () => void;
};

/**
 * How one Insights section fills the shared widget detail: which
 * visualizations a widget offers, when it counts as empty, the toolbar's
 * primary link and the content of the main column and rail.
 */
export type InsightDetailArea = {
  vizOptions: (widget: InsightWidget) => DetailViz[];
  /** Whether to show the visualization switcher; by default when there is a choice. */
  showVizSwitcher?: ((widget: InsightWidget, options: DetailViz[]) => boolean) | undefined;
  isEmpty: (widget: InsightWidget) => boolean;
  /** Sections whose numbers follow the chosen date range show a range picker. */
  rangePicker?: boolean | undefined;
  /** A note under the description, such as a section's fixed window. */
  windowCaption?: string | undefined;
  primaryAction: (detail: InsightWidgetDetail | null) => { href: string; label: string } | null;
  toolbarExtras?: ReactNode;
  skeletonHeadlines?: number | undefined;
  renderMain: (canvas: DetailCanvas) => ReactNode;
  renderRail: (canvas: DetailCanvas) => ReactNode;
};

const VIZ_LABEL: Record<DetailViz, string> = {
  area: "Area",
  line: "Line",
  bar: "Bar",
  funnel: "Funnel",
  table: "Table",
};

function VizIcon({ viz }: { viz: DetailViz }) {
  const className = "h-4 w-4";
  if (viz === "area") return <AreaChart className={className} aria-hidden="true" />;
  if (viz === "line") return <LineChart className={className} aria-hidden="true" />;
  if (viz === "bar") return <BarChart3 className={className} aria-hidden="true" />;
  if (viz === "funnel") return <Filter className={className} aria-hidden="true" />;
  return <Table2 className={className} aria-hidden="true" />;
}

/** The widget's own visualization when the section offers it, else the first option. */
export function preferredViz(widget: InsightWidget, options: DetailViz[]): DetailViz {
  const own = widget.defaultViz as string;
  const match = options.find((option) => option === own);
  return match ?? options[0] ?? "table";
}

const pressClassName = "motion-safe:active:translate-y-px";

/**
 * The detail page (or overlay) for one Insights widget: breadcrumb, title,
 * toolbar, CSV copy and export, error and loading states, and the overlay
 * dialog. The section's area supplies everything inside the two columns.
 */
export function InsightWidgetDetailView({
  slug,
  sectionTitle,
  detail,
  loading,
  error,
  range,
  overlay,
  onRangeChange,
  onRefresh,
  area = genericInsightArea,
}: InsightWidgetDetailViewProps & { area?: InsightDetailArea }) {
  const router = useRouter();
  const titleId = useId();
  const widget = detail?.widget ?? null;
  const vizOptions = widget ? area.vizOptions(widget) : [];
  // A choice belongs to the widget it was made on; a new widget starts on its own default.
  const [chosenViz, setChosenViz] = useState<{ widget: InsightWidget; viz: DetailViz } | null>(
    null,
  );
  const viz =
    widget && chosenViz?.widget === widget
      ? chosenViz.viz
      : widget
        ? preferredViz(widget, vizOptions)
        : "line";
  const [copied, setCopied] = useState<"id" | "csv" | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeHref = adminInsightHref(slug);

  useEffect(() => {
    if (!overlay) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") router.push(closeHref);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [closeHref, overlay, router]);

  function flashCopied(kind: "id" | "csv") {
    setCopied(kind);
    window.setTimeout(() => {
      setCopied(null);
    }, 1600);
  }

  function copyCsv() {
    if (!widget) return;
    void copyText(widgetToCsv(exportColumns(widget), widget.data.rows)).then((ok) => {
      if (ok) flashCopied("csv");
    });
  }

  const showVizSwitcher =
    widget != null &&
    (area.showVizSwitcher
      ? area.showVizSwitcher(widget, vizOptions)
      : vizOptions.length > 1 && !isKpiWidget(widget));
  const primaryAction = area.primaryAction(detail);
  const canvas: DetailCanvas | null =
    detail && widget
      ? { slug, range, overlay, detail, widget, viz, empty: area.isEmpty(widget), copyCsv }
      : null;

  const page = (
    <div
      className={overlay ? "flex min-h-0 flex-1 flex-col overflow-y-auto" : insightPageClassName}
    >
      {!overlay ? (
        <nav className={insightBreadcrumbClassName} aria-label="Breadcrumb">
          {[
            { href: "/admin", label: "Admin" },
            { href: ADMIN_INSIGHTS_HREF, label: "Insights" },
            { href: closeHref, label: sectionTitle },
          ].map((crumb) => (
            <span key={crumb.href} className="contents">
              <Link
                href={crumb.href}
                prefetch={false}
                className="hover:text-[var(--admin-on-surface)]"
              >
                {crumb.label}
              </Link>
              <span className="text-[var(--admin-outline)]" aria-hidden="true">
                /
              </span>
            </span>
          ))}
          <span className="font-medium text-[var(--admin-on-surface)]">
            {widget?.title ?? "Widget"}
          </span>
        </nav>
      ) : null}

      <header
        className={`flex flex-col justify-between gap-4 xl:flex-row xl:items-start ${overlay ? "px-6 pt-5" : ""}`}
      >
        {!overlay ? (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={closeHref}
                prefetch={false}
                className={`rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${pressClassName}`}
                aria-label={`Back to ${sectionTitle}`}
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className={insightPageTitleClassName}>
                {widget?.title ?? (loading ? "Loading widget" : "Widget")}
              </h1>
              {widget ? (
                <button
                  type="button"
                  title="Copy widget ID"
                  className={`inline-flex items-center gap-1 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-0.5 font-data text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)] outline-none hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-low)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${pressClassName}`}
                  onClick={() => {
                    void copyText(widget.id).then((ok) => {
                      if (ok) flashCopied("id");
                    });
                  }}
                >
                  {widget.id}
                  {copied === "id" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              ) : loading ? (
                <Shimmer className="h-4 w-32" />
              ) : null}
            </div>
            <p className={insightPageDescClassName}>
              {detail?.description ?? (loading ? " " : "Widget detail")}
            </p>
            {area.windowCaption ? (
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                {area.windowCaption}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {showVizSwitcher ? (
            <div className={insightSegmentTrackClassName} role="group" aria-label="Visualization">
              {vizOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={
                    viz === option
                      ? insightSegmentButtonActiveClassName
                      : insightSegmentButtonClassName
                  }
                  onClick={() => {
                    setChosenViz({ widget, viz: option });
                  }}
                >
                  <VizIcon viz={option} />
                  {VIZ_LABEL[option]}
                </button>
              ))}
            </div>
          ) : null}
          {area.rangePicker ? (
            <div className={insightSegmentTrackClassName} role="radiogroup" aria-label="Date range">
              {INSIGHT_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={option.value === range}
                  className={
                    option.value === range
                      ? insightSegmentButtonActiveClassName
                      : insightSegmentButtonClassName
                  }
                  onClick={() => {
                    onRangeChange(option.value);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
          {area.toolbarExtras}
          <button
            type="button"
            className={`${insightGhostButtonClassName} ${pressClassName}`}
            disabled={!widget}
            onClick={copyCsv}
          >
            {copied === "csv" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy as CSV
          </button>
          <button
            type="button"
            className={`${insightGhostButtonClassName} ${pressClassName}`}
            disabled={!widget}
            onClick={() => {
              if (!widget) return;
              downloadCsv(
                area.rangePicker ? `${widget.id}-${range}.csv` : `${widget.id}.csv`,
                widgetToCsv(exportColumns(widget), widget.data.rows),
              );
            }}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          {primaryAction ? (
            <Link
              href={primaryAction.href}
              prefetch={false}
              className={`${insightPrimaryButtonClassName} ${pressClassName}`}
            >
              {primaryAction.label}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </header>

      <div className={overlay ? "flex min-h-0 flex-1 flex-col gap-6 p-6" : "flex flex-col gap-6"}>
        {error ? (
          <div className="flex items-start gap-4 rounded border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" />
            <div>
              <h3 className="text-base font-semibold text-[var(--admin-danger)]">
                Could not load this widget
              </h3>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
              <button
                type="button"
                className={`${insightGhostButtonClassName} mt-4 ${pressClassName}`}
                onClick={onRefresh}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {loading && !detail ? (
          <WidgetDetailSkeleton headlineCount={area.skeletonHeadlines} />
        ) : null}

        {canvas && !error ? (
          // Keyed by widget so panels with their own state start fresh on a new widget.
          <div
            key={canvas.widget.id}
            className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12"
          >
            <div className="flex flex-col gap-6 lg:col-span-8">{area.renderMain(canvas)}</div>
            {area.renderRail(canvas)}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!overlay) return page;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--admin-scrim)] p-4 backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out] md:p-8"
      role="presentation"
      onClick={() => {
        router.push(closeHref);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[calc(100dvh-64px)] w-full max-w-[1440px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_32px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6">
          <h2
            id={titleId}
            className="truncate text-xl font-semibold tracking-tight text-[var(--admin-on-surface)]"
          >
            {widget?.title ?? "Widget"}
          </h2>
          <div className="flex items-center gap-2">
            {widget ? (
              <Link
                href={adminInsightWidgetHref(slug, widget.id)}
                prefetch={false}
                className={insightGhostButtonClassName}
              >
                Open full page
              </Link>
            ) : null}
            <button
              ref={closeButtonRef}
              type="button"
              className={`flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${pressClassName}`}
              aria-label="Close overlay"
              onClick={() => {
                router.push(closeHref);
              }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        {page}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * The generic area: the main Dashboard and any section without its own.
 * ------------------------------------------------------------------------- */

const GENERIC_MONEY_WIDGET_IDS = new Set(["revenue", "monthly-revenue", "failed-payments"]);

function genericMoney(detail: InsightWidgetDetail): boolean {
  return detail.comparison?.unit === "money" || GENERIC_MONEY_WIDGET_IDS.has(detail.widget.id);
}

function genericMoneyColumn(key: string): boolean {
  return key === "amount" || key === "revenue";
}

function GenericHeadline({ detail, money }: { detail: InsightWidgetDetail; money: boolean }) {
  const { widget, comparison, currency } = detail;
  const format = (value: number) =>
    money ? formatInsightMoneyWithCode(value, currency) : formatAmount(value);
  const keys = widgetMeasureKeys(widget);
  const total = widget.data.rows.reduce(
    (sum, row) => sum + numericValue(cell(row, keys[0] ?? "value")),
    0,
  );
  return (
    <HeadlineStrip>
      <HeadlineCell
        label={comparison?.currentLabel ?? (isKpiWidget(widget) ? widget.title : "Total")}
      >
        <div className={insightKpiValueClassName}>{format(comparison?.current ?? total)}</div>
      </HeadlineCell>
      <HeadlineDivider from="md" />
      <HeadlineCell label={comparison?.previousLabel ?? "Previous period"}>
        {comparison ? (
          <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
            {format(comparison.previous)}
          </span>
        ) : (
          <NoComparison />
        )}
      </HeadlineCell>
      {comparison ? (
        <HeadlineCell label="Delta">
          <DeltaReading
            delta={comparison.deltaAbs}
            text={format(comparison.deltaAbs)}
            pct={comparison.deltaPct}
            polarity={widget.id === "failed-payments" ? "inverted" : "normal"}
          />
        </HeadlineCell>
      ) : null}
      {detail.average != null ? (
        <>
          <HeadlineDivider />
          <HeadlineCell label="Average">
            <span className="font-data text-sm text-[var(--admin-on-surface)]">
              {format(detail.average)}
            </span>
          </HeadlineCell>
        </>
      ) : null}
      {detail.failureRate ? (
        <>
          <HeadlineDivider />
          <HeadlineCell label="Failure rate">
            <span className="font-data text-sm text-[var(--admin-warning)]">
              {`${formatInsightNumber(detail.failureRate.currentPct, 1)}%`}
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

function GenericMain({ canvas }: { canvas: DetailCanvas }) {
  const { detail, widget, viz, empty, range, copyCsv } = canvas;
  const money = genericMoney(detail);
  const currency = detail.currency;
  const tableWidget = widget.defaultViz === "table";
  const emptyCanvas = (
    <EmptyCanvas
      title={`No ${widget.title.toLowerCase()} yet`}
      body="There is no data recorded for this period. Try a wider date range or check related reports."
      href={widget.href ?? null}
    />
  );

  if (isKpiWidget(widget)) {
    return (
      <>
        <GenericHeadline detail={detail} money={money} />
        <DetailPanel title="Value">
          {empty ? (
            emptyCanvas
          ) : (
            <KpiValueTable
              label={widget.title}
              value={
                money
                  ? formatInsightMoneyWithCode(
                      numericValue(cell(widget.data.rows[0], "value")),
                      currency,
                    )
                  : formatAmount(numericValue(cell(widget.data.rows[0], "value")))
              }
            />
          )}
        </DetailPanel>
        <SplitBreakdown detail={detail} money={money} currency={currency} />
      </>
    );
  }

  const keys = widgetMeasureKeys(widget);
  const format = (value: number) =>
    money ? formatInsightMoneyWithCode(value, currency) : formatInsightNumber(value);
  const series = keys.map((key, index) => ({
    key,
    label: widget.data.columns.find((column) => column.key === key)?.label ?? key,
    color: seriesColor(index),
  }));
  const chart = (
    <SeriesChart
      points={seriesPoints(widget, range, keys)}
      series={series}
      mainKey={keys[0] ?? "value"}
      viz={viz === "bar" ? "bar" : viz === "area" ? "area" : "line"}
      average={detail.average}
      widgetTitle={widget.title}
      tooltip={
        series.length === 1
          ? singleSeriesTooltip(keys[0] ?? "value", format)
          : (point) => [
              { text: point.longLabel, size: 10 },
              ...series.map((item) => ({
                text: `${item.label} ${format(point.values[item.key] ?? 0)}`,
                strong: true,
              })),
            ]
      }
      tooltipWidth={series.length === 1 ? 144 : 168}
    />
  );

  return (
    <>
      <GenericHeadline detail={detail} money={money} />
      {tableWidget && viz === "table" ? (
        empty ? (
          <DetailPanel title={widget.title}>{emptyCanvas}</DetailPanel>
        ) : (
          <InsightDataTable
            widget={widget}
            currency={currency}
            isMoneyColumn={genericMoneyColumn}
            isDangerRow={widget.id === "failed-payments" ? () => true : undefined}
          />
        )
      ) : (
        <DetailPanel
          title={viz === "table" ? "Records" : "Trend"}
          aside={
            viz !== "table" ? (
              <ChartLegend
                items={[
                  ...(series.length > 1
                    ? series.map((item) => ({
                        label: item.label,
                        swatch: "h-3 w-3 rounded-full",
                        color: item.color,
                      }))
                    : [{ label: "Current period", swatch: LEGEND_CURRENT_SWATCH }]),
                  ...(detail.average != null
                    ? [{ label: "Average", swatch: LEGEND_AVERAGE_SWATCH }]
                    : []),
                ]}
              />
            ) : null
          }
        >
          <div className="p-5">
            {empty ? (
              emptyCanvas
            ) : viz === "table" ? (
              <UnderlyingTable
                widget={widget}
                range={range}
                isMoneyColumn={money ? genericMoneyColumn : undefined}
                currency={currency}
              />
            ) : (
              chart
            )}
          </div>
          {detail.insightNote && !empty ? <InsightNote note={detail.insightNote} /> : null}
        </DetailPanel>
      )}
      <SplitBreakdown detail={detail} money={money} currency={currency} />
      {viz !== "table" && !empty ? (
        <UnderlyingDataToggle onCopyCsv={copyCsv}>
          <UnderlyingTable
            widget={widget}
            range={range}
            isMoneyColumn={money ? genericMoneyColumn : undefined}
            currency={currency}
          />
        </UnderlyingDataToggle>
      ) : null}
    </>
  );
}

export const genericInsightArea: InsightDetailArea = {
  vizOptions: (widget) => {
    if (isKpiWidget(widget)) return ["table"];
    if (widget.defaultViz === "table") return ["table", "bar"];
    if (widget.defaultViz === "bar" || widget.defaultViz === "funnel") {
      return ["bar", "line", "table"];
    }
    if (widget.defaultViz === "area") return ["area", "line", "bar", "table"];
    return ["line", "area", "bar", "table"];
  },
  isEmpty: (widget) => widget.data.rows.length === 0,
  rangePicker: true,
  primaryAction: (detail) =>
    detail?.widget.href ? { href: detail.widget.href, label: "Open the full report" } : null,
  renderMain: (canvas) => <GenericMain canvas={canvas} />,
  renderRail: ({ detail, range }) => (
    <RelatedRail
      related={detail.related}
      metadata={widgetMetadata(
        detail,
        INSIGHT_RANGE_OPTIONS.find((option) => option.value === range)?.label ?? range,
        detail.currency,
      )}
    />
  ),
};
