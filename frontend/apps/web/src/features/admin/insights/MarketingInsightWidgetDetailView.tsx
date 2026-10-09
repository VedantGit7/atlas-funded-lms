"use client";

import Link from "next/link";
import { Activity, Share2, Table2, Workflow } from "lucide-react";
import { adminInsightWidgetHref } from "./admin-insights-catalog";
import type { InsightWidget, InsightWidgetDetail } from "./admin-insights-api";
import { formatInsightMoneyWithCode, formatInsightNumber } from "./admin-insights-format";
import { insightGhostButtonClassName, insightKpiValueClassName } from "./admin-insights-shared";
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
  isKpiWidget,
  KpiValueTable,
  LEGEND_AVERAGE_SWATCH,
  numericValue,
  PanelCaption,
  PctDeltaCell,
  RelatedRail,
  SeriesTable,
  SplitBreakdown,
  stringValue,
  UnderlyingDataToggle,
  UnderlyingTable,
  widgetMetadata,
} from "./insight-detail-kit";
import {
  RankedBarChart,
  rankedBars,
  SeriesChart,
  seriesPoints,
  type ChartSeries,
} from "./insight-detail-charts";
import { InsightDataTable } from "./insight-detail-data-table";
import {
  InsightWidgetDetailView,
  type DetailCanvas,
  type DetailViz,
  type InsightDetailArea,
  type InsightWidgetDetailViewProps,
} from "./InsightWidgetDetailView";
import {
  MARKETING_ATTRIBUTION_PAIR_CAPTION,
  MARKETING_BAR_WIDGET_IDS,
  MARKETING_CTA_EMPTY_CAPTION,
  MARKETING_DAILY_LEADS_CAPTION,
  MARKETING_DUAL_SERIES_IDS,
  MARKETING_FIXED_WINDOW_CAPTION,
  MARKETING_INSIGHT_MONEY_KPI_IDS,
  MARKETING_INSIGHT_PERCENT_KPI_IDS,
  MARKETING_TABLE_WIDGET_IDS,
  marketingStatusTone,
  marketingWidgetEmptyCopy,
} from "./marketing-insight-meta";

const MARKETING_FORMS_HREF = "/admin/marketing/forms/contacts";
const FORMS_ACTION = { href: MARKETING_FORMS_HREF, label: "Marketing forms" };

const LEAD_SERIES: ChartSeries[] = [
  { key: "contacts", label: "Contacts", color: "var(--admin-primary-container)", strokeWidth: 2 },
  { key: "submissions", label: "Submissions", color: "var(--admin-primary)" },
];

const SEARCH_PLACEHOLDERS: Record<string, string> = {
  "top-forms": "Search forms...",
  "top-ctas": "Search CTAs...",
  "top-coupons": "Search coupons...",
  "recent-workflow-runs": "Search workflow runs...",
  "marketing-inventory": "Search assets...",
  "top-sources": "Search sources...",
  "top-campaigns-utm": "Search campaigns...",
};

const PAIRED_SWAP_LABELS: Record<string, string> = {
  "attribution-by-source": "Show medium",
  "attribution-by-medium": "Show source",
};

function measureKey(widget: InsightWidget): string {
  if (MARKETING_DUAL_SERIES_IDS.has(widget.id)) return "submissions";
  if (widget.id === "top-sources" || widget.id === "top-campaigns-utm") return "events";
  if (widget.id === "top-forms") return "submissions";
  if (widget.id === "top-coupons") return "redemptions";
  return widget.data.measures?.[0] ?? "value";
}

function tableHasMoney(widgetId: string): boolean {
  return (
    widgetId === "top-sources" || widgetId === "top-campaigns-utm" || widgetId === "top-coupons"
  );
}

function moneyColumn(key: string): boolean {
  return key === "revenue" || key === "discount" || key === "amount";
}

function widgetHasNoEvents(widget: InsightWidget): boolean {
  if (widget.data.rows.length === 0) return true;
  if (MARKETING_DUAL_SERIES_IDS.has(widget.id)) {
    return widget.data.rows.every(
      (row) =>
        numericValue(cell(row, "submissions")) <= 0 && numericValue(cell(row, "contacts")) <= 0,
    );
  }
  if (MARKETING_TABLE_WIDGET_IDS.has(widget.id)) return false;
  if (isKpiWidget(widget)) {
    if (
      MARKETING_INSIGHT_PERCENT_KPI_IDS.has(widget.id) &&
      (widget.footnote === MARKETING_CTA_EMPTY_CAPTION ||
        widget.footnote?.toLowerCase().includes("no cta views"))
    ) {
      return true;
    }
    return numericValue(cell(widget.data.rows[0], "value")) <= 0;
  }
  const key = measureKey(widget);
  return widget.data.rows.every((row) => numericValue(cell(row, key)) === 0);
}

function formatMetric(value: number, widgetId: string, currency?: string): string {
  if (MARKETING_INSIGHT_PERCENT_KPI_IDS.has(widgetId)) return `${formatInsightNumber(value)}%`;
  if (MARKETING_INSIGHT_MONEY_KPI_IDS.has(widgetId)) {
    return formatInsightMoneyWithCode(value, currency);
  }
  return formatAmount(value);
}

function vizOptions(widget: InsightWidget): DetailViz[] {
  if (MARKETING_TABLE_WIDGET_IDS.has(widget.id) || isKpiWidget(widget)) return ["table"];
  if (MARKETING_BAR_WIDGET_IDS.has(widget.id)) return ["bar", "table"];
  return ["line", "area", "bar", "table"];
}

function DailyLeads({ canvas }: { canvas: DetailCanvas }) {
  const { detail, widget, viz, empty, range, copyCsv } = canvas;
  const points = seriesPoints(widget, range, ["submissions", "contacts"]);
  const submissions = points.reduce((sum, point) => sum + (point.values["submissions"] ?? 0), 0);
  const contacts =
    detail.secondaryTotal ??
    points.reduce((sum, point) => sum + (point.values["contacts"] ?? 0), 0);
  const contactsAverage =
    detail.secondaryAverage ?? (points.length > 0 ? contacts / points.length : null);
  const copy = marketingWidgetEmptyCopy(widget.id);
  const comparison = detail.comparison;

  return (
    <>
      <HeadlineStrip>
        <HeadlineCell label="Submissions">
          <div className={insightKpiValueClassName}>
            {empty ? "-" : formatInsightNumber(submissions)}
          </div>
        </HeadlineCell>
        <HeadlineDivider from="md" />
        <HeadlineCell label="Contacts">
          <div className={insightKpiValueClassName}>
            {empty ? "-" : formatInsightNumber(contacts)}
          </div>
        </HeadlineCell>
        {comparison ? (
          <>
            <HeadlineDivider />
            <HeadlineCell label="Abs delta">
              <DeltaReading
                delta={comparison.deltaAbs}
                text={formatInsightNumber(comparison.deltaAbs)}
              />
            </HeadlineCell>
            <HeadlineDivider />
            <PctDeltaCell pct={comparison.deltaPct} trendIcon />
          </>
        ) : null}
        <HeadlineDivider />
        <HeadlineCell label="30d average">
          <span className="font-data text-sm text-[var(--admin-on-surface)]">
            {empty || detail.average == null ? "-" : formatAmount(detail.average)}
          </span>
          {contactsAverage != null && !empty ? (
            <p className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
              {`Contacts avg ${formatAmount(contactsAverage)}`}
            </p>
          ) : null}
        </HeadlineCell>
      </HeadlineStrip>
      <DetailPanel
        title={viz === "table" ? "Records" : "Daily leads"}
        aside={
          viz !== "table" ? (
            <ChartLegend
              items={[
                {
                  label: "Contacts",
                  swatch: "h-3 w-3 rounded-full bg-[var(--admin-primary-container)]",
                },
                { label: "Submissions", swatch: "h-3 w-3 rounded-full bg-[var(--admin-primary)]" },
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
            <EmptyCanvas
              title={copy.title}
              body={copy.body}
              icon={<Activity className="h-12 w-12" aria-hidden="true" />}
            />
          ) : viz === "table" ? (
            <SeriesTable points={points} series={LEAD_SERIES} />
          ) : (
            <SeriesChart
              points={points}
              series={LEAD_SERIES}
              mainKey="submissions"
              viz={viz === "bar" ? "bar" : viz === "area" ? "area" : "line"}
              average={detail.average}
              widgetTitle={widget.title}
              tooltip={(point) => [
                { text: point.longLabel, size: 10 },
                { text: `Contacts ${formatInsightNumber(point.values["contacts"] ?? 0)}` },
                {
                  text: `Submissions ${formatInsightNumber(point.values["submissions"] ?? 0)}`,
                  strong: true,
                },
              ]}
            />
          )}
        </div>
        {!empty ? <PanelCaption>{MARKETING_DAILY_LEADS_CAPTION}</PanelCaption> : null}
        {detail.insightNote && !empty ? <InsightNote note={detail.insightNote} /> : null}
      </DetailPanel>
      <SplitBreakdown detail={detail} />
      {!empty && viz !== "table" ? (
        <UnderlyingDataToggle onCopyCsv={copyCsv}>
          <SeriesTable points={points} series={LEAD_SERIES} />
        </UnderlyingDataToggle>
      ) : null}
    </>
  );
}

function MarketingMain({ canvas }: { canvas: DetailCanvas }) {
  const { detail, widget, viz, empty, range, copyCsv } = canvas;
  const currency = detail.currency;
  const copy = marketingWidgetEmptyCopy(widget.id);
  const money = tableHasMoney(widget.id) || MARKETING_INSIGHT_MONEY_KPI_IDS.has(widget.id);
  const moneyColumns = tableHasMoney(widget.id) ? moneyColumn : undefined;

  if (MARKETING_DUAL_SERIES_IDS.has(widget.id)) return <DailyLeads canvas={canvas} />;

  if (isKpiWidget(widget)) {
    const value = numericValue(cell(widget.data.rows[0], "value"));
    return (
      <>
        <HeadlineStrip>
          <HeadlineCell label={widget.title}>
            <div className={insightKpiValueClassName}>
              {empty ? "-" : formatMetric(value, widget.id, currency)}
            </div>
          </HeadlineCell>
          {detail.comparison ? (
            <>
              <HeadlineDivider from="md" />
              <HeadlineCell label="Vs previous">
                <DeltaReading
                  delta={detail.comparison.deltaAbs}
                  text={formatMetric(detail.comparison.deltaAbs, widget.id, currency)}
                />
              </HeadlineCell>
            </>
          ) : null}
        </HeadlineStrip>
        <DetailPanel title="Value">
          {empty ? (
            <EmptyCanvas title={copy.title} body={copy.body} />
          ) : (
            <KpiValueTable label={widget.title} value={formatMetric(value, widget.id, currency)} />
          )}
        </DetailPanel>
        {!empty ? <SplitBreakdown detail={detail} money={money} currency={currency} /> : null}
      </>
    );
  }

  if (MARKETING_TABLE_WIDGET_IDS.has(widget.id)) {
    const key = measureKey(widget);
    return (
      <>
        <DetailPanel title={widget.title}>
          {empty ? (
            <EmptyCanvas
              title={copy.title}
              body={copy.body}
              icon={
                widget.id === "recent-workflow-runs" ? (
                  <Workflow className="h-12 w-12" aria-hidden="true" />
                ) : (
                  <Table2 className="h-12 w-12" aria-hidden="true" />
                )
              }
            />
          ) : (
            <InsightDataTable
              widget={widget}
              currency={currency}
              isMoneyColumn={moneyColumns}
              shareKey={key}
              initialSortKey={key}
              searchPlaceholder={SEARCH_PLACEHOLDERS[widget.id]}
              statusTone={marketingStatusTone}
              chipColumns={["type"]}
              leadEmphasis={
                widget.id === "top-forms" ||
                widget.id === "top-ctas" ||
                widget.id === "recent-workflow-runs"
              }
              isDangerRow={
                widget.id === "recent-workflow-runs"
                  ? (row) => marketingStatusTone(stringValue(cell(row, "status"))) === "danger"
                  : undefined
              }
            />
          )}
        </DetailPanel>
        {!empty ? <SplitBreakdown detail={detail} money={money} currency={currency} /> : null}
      </>
    );
  }

  return (
    <>
      <DetailPanel title={viz === "table" ? "Records" : widget.title}>
        {empty ? (
          <EmptyCanvas
            title={copy.title}
            body={copy.body}
            icon={<Share2 className="h-12 w-12" aria-hidden="true" />}
          />
        ) : viz === "table" ? (
          <div className="p-5">
            <UnderlyingTable
              widget={widget}
              range={range}
              isMoneyColumn={moneyColumns}
              currency={currency}
              statusTone={marketingStatusTone}
            />
          </div>
        ) : (
          <RankedBarChart rows={rankedBars(widget)} />
        )}
        {!empty ? <PanelCaption>{MARKETING_ATTRIBUTION_PAIR_CAPTION}</PanelCaption> : null}
      </DetailPanel>
      {!empty ? <SplitBreakdown detail={detail} money={money} currency={currency} /> : null}
      {!empty && viz !== "table" ? (
        <UnderlyingDataToggle onCopyCsv={copyCsv}>
          <UnderlyingTable
            widget={widget}
            range={range}
            isMoneyColumn={moneyColumns}
            currency={currency}
            statusTone={marketingStatusTone}
          />
        </UnderlyingDataToggle>
      ) : null}
    </>
  );
}

function PairedSwapLink({
  slug,
  detail,
  overlay,
}: {
  slug: string;
  detail: InsightWidgetDetail | null;
  overlay: boolean;
}) {
  const label = detail ? PAIRED_SWAP_LABELS[detail.widget.id] : undefined;
  if (!detail?.pairedWidget || !label) return null;
  const href = adminInsightWidgetHref(slug, detail.pairedWidget.id);
  return (
    <Link
      href={overlay ? `${href}?overlay=1` : href}
      prefetch={false}
      className={insightGhostButtonClassName}
    >
      <Share2 className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

export function MarketingInsightWidgetDetailView(props: InsightWidgetDetailViewProps) {
  const area: InsightDetailArea = {
    vizOptions,
    isEmpty: widgetHasNoEvents,
    primaryAction: () => FORMS_ACTION,
    skeletonHeadlines: props.detail?.widget.id === "daily-leads" || !props.detail ? 5 : 4,
    toolbarExtras: (
      <PairedSwapLink slug={props.slug} detail={props.detail} overlay={props.overlay} />
    ),
    renderMain: (canvas) => <MarketingMain canvas={canvas} />,
    renderRail: ({ detail }) => (
      <RelatedRail
        related={detail.related}
        emptyAction={FORMS_ACTION}
        metadata={widgetMetadata(detail, MARKETING_FIXED_WINDOW_CAPTION, detail.currency)}
      />
    ),
  };
  return <InsightWidgetDetailView {...props} area={area} />;
}
