"use client";

import Link from "next/link";
import { MessageCircle, Share2, Table2 } from "lucide-react";
import { adminInsightWidgetHref } from "./admin-insights-catalog";
import type { InsightWidget, InsightWidgetDetail } from "./admin-insights-api";
import { formatInsightNumber } from "./admin-insights-format";
import { insightGhostButtonClassName, insightKpiValueClassName } from "./admin-insights-shared";
import {
  cell,
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
  NoComparison,
  numericValue,
  PanelCaption,
  PctDeltaCell,
  RelatedRail,
  SeriesTable,
  SplitBreakdown,
  stringValue,
  UnderlyingDataToggle,
  UnderlyingTable,
  useWidgetState,
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
  MESSENGER_BAR_WIDGET_IDS,
  MESSENGER_CHANNEL_PAIR_CAPTION,
  MESSENGER_DAILY_VOLUME_CAPTION,
  MESSENGER_DUAL_SERIES_IDS,
  MESSENGER_FAILED_CAPTION,
  MESSENGER_FIXED_WINDOW_CAPTION,
  MESSENGER_INSIGHT_INVERTED_KPI_IDS,
  MESSENGER_INSIGHT_PERCENT_KPI_IDS,
  MESSENGER_TABLE_WIDGET_IDS,
  MESSENGER_WA_EMPTY_CAPTION,
  messengerStatusTone,
  messengerWidgetEmptyCopy,
} from "./messenger-insight-meta";

const MESSENGER_INBOX_HREF = "/admin/insights/messenger-insight/inbox";
const INBOX_ACTION = { href: MESSENGER_INBOX_HREF, label: "Messenger inbox" };

type ChannelKey = "email" | "push" | "whatsapp" | "inbox";
type ChannelVisibility = Record<ChannelKey, boolean>;

const ALL_CHANNELS_ON: ChannelVisibility = { email: true, push: true, whatsapp: true, inbox: true };
const OUTBOUND_CHANNELS: ChannelKey[] = ["email", "push", "whatsapp"];

const CHANNEL_SERIES: Record<ChannelKey, ChartSeries> = {
  email: { key: "email", label: "Email", color: "var(--admin-primary)", strokeWidth: 2.5 },
  push: {
    key: "push",
    label: "Push",
    color: "color-mix(in srgb, var(--admin-primary) 60%, var(--admin-surface))",
    strokeWidth: 1.75,
  },
  whatsapp: {
    key: "whatsapp",
    label: "WhatsApp",
    color: "color-mix(in srgb, var(--admin-primary) 35%, var(--admin-outline))",
    strokeWidth: 1.5,
  },
  inbox: {
    key: "inbox",
    label: "Inbox",
    color: "var(--admin-on-surface-variant)",
    strokeWidth: 1.75,
    dashed: true,
    axis: "right",
    barOpacity: 0.55,
  },
};

const CHANNEL_SWATCH: Record<ChannelKey, string> = {
  email: "h-0.5 w-3 bg-[var(--admin-primary)]",
  push: "h-0.5 w-3 bg-[color-mix(in_srgb,var(--admin-primary)_60%,var(--admin-surface))]",
  whatsapp: "h-0.5 w-3 bg-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-outline))]",
  inbox: "inline-block w-3 border-t border-dashed border-[var(--admin-on-surface-variant)]",
};

const SEARCH_PLACEHOLDERS: Record<string, string> = {
  "recent-email": "Search emails...",
  "recent-push": "Search push...",
  "recent-whatsapp": "Search WhatsApp...",
  "recent-announcements": "Search announcements...",
};

const PAIRED_SWAP_LABELS: Record<string, string> = {
  "channel-mix-sends": "Show reach",
  "channel-mix-reach": "Show sends",
};

const emptyIcon = <MessageCircle className="h-12 w-12" aria-hidden="true" />;

function measureKey(widget: InsightWidget): string {
  if (MESSENGER_DUAL_SERIES_IDS.has(widget.id)) return "email";
  return widget.data.measures?.[0] ?? "value";
}

function widgetHasNoEvents(widget: InsightWidget): boolean {
  if (widget.data.rows.length === 0) return true;
  if (MESSENGER_DUAL_SERIES_IDS.has(widget.id)) {
    return widget.data.rows.every((row) =>
      (["email", "push", "whatsapp", "inbox"] as const).every(
        (key) => numericValue(cell(row, key)) <= 0,
      ),
    );
  }
  if (MESSENGER_TABLE_WIDGET_IDS.has(widget.id)) return false;
  if (isKpiWidget(widget)) {
    if (
      MESSENGER_INSIGHT_PERCENT_KPI_IDS.has(widget.id) &&
      (widget.footnote === MESSENGER_WA_EMPTY_CAPTION ||
        widget.footnote?.toLowerCase().includes("no whatsapp"))
    ) {
      return true;
    }
    return numericValue(cell(widget.data.rows[0], "value")) <= 0;
  }
  const key = measureKey(widget);
  return widget.data.rows.every((row) => numericValue(cell(row, key)) === 0);
}

function formatMetric(value: number, widgetId: string): string {
  if (MESSENGER_INSIGHT_PERCENT_KPI_IDS.has(widgetId)) return `${formatInsightNumber(value)}%`;
  return formatAmount(value);
}

function vizOptions(widget: InsightWidget): DetailViz[] {
  if (MESSENGER_TABLE_WIDGET_IDS.has(widget.id) || isKpiWidget(widget)) return ["table"];
  if (MESSENGER_BAR_WIDGET_IDS.has(widget.id)) return ["bar", "table"];
  return ["line", "area", "bar", "table"];
}

type MessengerState = {
  comparePaired: boolean;
  channels: ChannelVisibility;
  onChannels: (value: ChannelVisibility) => void;
  outboundOnly: boolean;
  onOutboundOnly: (value: boolean) => void;
};

function DailyVolume({ canvas, state }: { canvas: DetailCanvas; state: MessengerState }) {
  const { detail, widget, viz, empty, range, copyCsv } = canvas;
  const points = seriesPoints(widget, range, ["email", "push", "whatsapp", "inbox"]);
  const outboundOf = (values: Record<string, number>) =>
    OUTBOUND_CHANNELS.reduce((sum, key) => sum + (values[key] ?? 0), 0);
  const outboundTotal = points.reduce((sum, point) => sum + outboundOf(point.values), 0);
  const outboundAverage = points.length > 0 ? outboundTotal / points.length : null;
  const inboxTotal =
    detail.secondaryTotal ?? points.reduce((sum, point) => sum + (point.values["inbox"] ?? 0), 0);
  const inboxAverage =
    detail.secondaryAverage ?? (points.length > 0 ? inboxTotal / points.length : null);
  const showInbox = state.channels.inbox && !state.outboundOnly;
  const visibleSeries = [
    ...OUTBOUND_CHANNELS.filter((key) => state.channels[key]).map((key) => CHANNEL_SERIES[key]),
    ...(showInbox ? [CHANNEL_SERIES.inbox] : []),
  ];
  const tableSeries = (["email", "push", "whatsapp", "inbox"] as const).map(
    (key) => CHANNEL_SERIES[key],
  );
  const copy = messengerWidgetEmptyCopy(widget.id);
  const comparison = detail.comparison;

  return (
    <>
      <HeadlineStrip>
        <HeadlineCell label={comparison?.currentLabel ?? "Current outbound"}>
          <div className={insightKpiValueClassName}>
            {empty ? "-" : formatInsightNumber(outboundTotal)}
          </div>
          {!empty ? (
            <p className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
              {`Inbox total ${formatInsightNumber(inboxTotal)}`}
            </p>
          ) : null}
        </HeadlineCell>
        <HeadlineDivider from="md" />
        {comparison ? (
          <>
            <HeadlineCell label={comparison.previousLabel}>
              <div className={insightKpiValueClassName}>
                {empty ? "-" : formatInsightNumber(comparison.previous)}
              </div>
            </HeadlineCell>
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
        ) : (
          <HeadlineCell label="Previous period">
            <NoComparison />
          </HeadlineCell>
        )}
        <HeadlineDivider />
        <HeadlineCell label="Average outbound / day">
          <span className="font-data text-sm text-[var(--admin-on-surface)]">
            {empty || outboundAverage == null ? "-" : formatAmount(outboundAverage)}
          </span>
          {inboxAverage != null && !empty ? (
            <p className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
              {`Inbox avg ${formatAmount(inboxAverage)}`}
            </p>
          ) : null}
        </HeadlineCell>
      </HeadlineStrip>
      <DetailPanel
        title={viz === "table" ? "Records" : "Daily messaging volume"}
        aside={
          viz !== "table" ? (
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--admin-on-surface-variant)]">
              <span className="font-semibold text-[var(--admin-on-surface)]">Outbound reach</span>
              {OUTBOUND_CHANNELS.map((key) => (
                <label key={key} className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[var(--admin-primary)]"
                    checked={state.channels[key]}
                    onChange={() => {
                      state.onChannels({ ...state.channels, [key]: !state.channels[key] });
                    }}
                  />
                  <span className={CHANNEL_SWATCH[key]} aria-hidden="true" />
                  {CHANNEL_SERIES[key].label}
                </label>
              ))}
              <span
                className="mx-1 hidden h-3 w-px bg-[var(--admin-border)] sm:inline-block"
                aria-hidden="true"
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[var(--admin-primary)]"
                  checked={showInbox}
                  disabled={state.outboundOnly}
                  onChange={() => {
                    state.onChannels({ ...state.channels, inbox: !state.channels.inbox });
                  }}
                />
                <span className={CHANNEL_SWATCH.inbox} aria-hidden="true" />
                Inbox
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[var(--admin-primary)]"
                  checked={state.outboundOnly}
                  onChange={(event) => {
                    state.onOutboundOnly(event.target.checked);
                  }}
                />
                Show outbound only
              </label>
            </div>
          ) : null
        }
      >
        <div className="p-5">
          {empty ? (
            <EmptyCanvas
              title={copy.title}
              body={copy.body}
              href={INBOX_ACTION.href}
              hrefLabel={INBOX_ACTION.label}
              icon={emptyIcon}
            />
          ) : viz === "table" ? (
            <SeriesTable points={points} series={tableSeries} />
          ) : (
            <SeriesChart
              points={points}
              series={visibleSeries}
              mainKey="email"
              viz={viz === "bar" ? "bar" : viz === "area" ? "area" : "line"}
              average={outboundAverage}
              averageLabel="Avg outbound"
              widgetTitle={widget.title}
              tooltipWidth={180}
              tooltip={(point) => [
                { text: point.longLabel, size: 10 },
                ...[...OUTBOUND_CHANNELS, ...(showInbox ? (["inbox"] as const) : [])].map(
                  (key) => ({
                    text: `${CHANNEL_SERIES[key].label} ${formatInsightNumber(point.values[key] ?? 0)}`,
                    strong: true,
                  }),
                ),
              ]}
            />
          )}
        </div>
        {!empty ? <PanelCaption>{MESSENGER_DAILY_VOLUME_CAPTION}</PanelCaption> : null}
        {detail.insightNote && !empty ? <InsightNote note={detail.insightNote} /> : null}
      </DetailPanel>
      {!empty ? <SplitBreakdown detail={detail} /> : null}
      {!empty && viz !== "table" ? (
        <UnderlyingDataToggle onCopyCsv={copyCsv}>
          <SeriesTable points={points} series={tableSeries} />
        </UnderlyingDataToggle>
      ) : null}
    </>
  );
}

function MessengerKpi({ canvas }: { canvas: DetailCanvas }) {
  const { detail, widget, empty } = canvas;
  const value = numericValue(cell(widget.data.rows[0], "value"));
  const inverted = MESSENGER_INSIGHT_INVERTED_KPI_IDS.has(widget.id);
  const percent = MESSENGER_INSIGHT_PERCENT_KPI_IDS.has(widget.id);
  const copy = messengerWidgetEmptyCopy(widget.id);
  const comparison = detail.comparison;
  const dangerText = inverted ? "text-[var(--admin-danger)]" : "";

  return (
    <>
      <HeadlineStrip>
        <HeadlineCell label={widget.title}>
          <div className={`${insightKpiValueClassName} ${dangerText}`}>
            {empty ? "-" : formatMetric(value, widget.id)}
          </div>
          {inverted ? (
            <p className="mt-1 text-[10px] text-[var(--admin-danger)]">
              {MESSENGER_FAILED_CAPTION}
            </p>
          ) : null}
          {empty && percent ? (
            <p className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
              {widget.footnote ?? MESSENGER_WA_EMPTY_CAPTION}
            </p>
          ) : null}
        </HeadlineCell>
        <HeadlineDivider from="md" />
        {comparison ? (
          <>
            <HeadlineCell label={comparison.previousLabel}>
              <DeltaReading
                delta={comparison.deltaAbs}
                text={formatMetric(comparison.deltaAbs, widget.id)}
                polarity={inverted ? "inverted-danger" : "normal"}
              />
            </HeadlineCell>
            {comparison.deltaPct != null ? (
              <>
                <HeadlineDivider />
                <PctDeltaCell
                  pct={comparison.deltaPct}
                  polarity={inverted ? "inverted-danger" : "normal"}
                />
              </>
            ) : null}
          </>
        ) : (
          <HeadlineCell label="Previous period">
            <NoComparison />
          </HeadlineCell>
        )}
        {detail.average != null && !empty ? (
          <>
            <HeadlineDivider />
            <HeadlineCell label="Average">
              <span className="font-data text-sm text-[var(--admin-on-surface)]">
                {formatMetric(detail.average, widget.id)}
              </span>
            </HeadlineCell>
          </>
        ) : null}
        {detail.failureRate ? (
          <>
            <HeadlineDivider />
            <HeadlineCell label="Failure rate">
              <span className="font-data text-sm text-[var(--admin-on-surface)]">
                {`${formatInsightNumber(detail.failureRate.currentPct, 1)}%`}
              </span>
              {detail.failureRate.note ? (
                <p className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                  {detail.failureRate.note}
                </p>
              ) : null}
            </HeadlineCell>
          </>
        ) : null}
      </HeadlineStrip>
      <DetailPanel title="Value">
        {empty ? (
          <EmptyCanvas
            title={copy.title}
            body={copy.body}
            href={INBOX_ACTION.href}
            hrefLabel={INBOX_ACTION.label}
            icon={emptyIcon}
          />
        ) : (
          <KpiValueTable
            label={widget.title}
            value={formatMetric(value, widget.id)}
            valueClassName={dangerText}
          />
        )}
      </DetailPanel>
      {!empty ? <SplitBreakdown detail={detail} /> : null}
    </>
  );
}

function MessengerMain({ canvas, state }: { canvas: DetailCanvas; state: MessengerState }) {
  const { detail, widget, viz, empty, range, copyCsv } = canvas;
  const copy = messengerWidgetEmptyCopy(widget.id);

  if (MESSENGER_DUAL_SERIES_IDS.has(widget.id)) {
    return <DailyVolume canvas={canvas} state={state} />;
  }
  if (isKpiWidget(widget)) return <MessengerKpi canvas={canvas} />;

  if (MESSENGER_TABLE_WIDGET_IDS.has(widget.id)) {
    const key = measureKey(widget);
    return (
      <>
        <DetailPanel title={widget.title}>
          {empty ? (
            <EmptyCanvas
              title={copy.title}
              body={copy.body}
              href={INBOX_ACTION.href}
              hrefLabel={INBOX_ACTION.label}
              icon={<Table2 className="h-12 w-12" aria-hidden="true" />}
            />
          ) : (
            <InsightDataTable
              widget={widget}
              shareKey={key}
              initialSortKey={key}
              searchPlaceholder={SEARCH_PLACEHOLDERS[widget.id]}
              statusTone={messengerStatusTone}
              chipColumns={["type", "channel"]}
              leadEmphasis
            />
          )}
        </DetailPanel>
        {!empty ? <SplitBreakdown detail={detail} /> : null}
      </>
    );
  }

  const paired = state.comparePaired ? detail.pairedWidget : null;
  return (
    <>
      <DetailPanel title={viz === "table" ? "Records" : widget.title}>
        {empty ? (
          <EmptyCanvas
            title={copy.title}
            body={copy.body}
            href={INBOX_ACTION.href}
            hrefLabel={INBOX_ACTION.label}
            icon={<Share2 className="h-12 w-12" aria-hidden="true" />}
          />
        ) : viz === "table" ? (
          <div className="p-5">
            <UnderlyingTable widget={widget} range={range} statusTone={messengerStatusTone} />
          </div>
        ) : (
          <RankedBarChart
            rows={rankedBars(widget)}
            compare={
              paired
                ? {
                    values: new Map(
                      paired.data.rows.map((row) => [
                        stringValue(cell(row, "label")).toLowerCase(),
                        numericValue(cell(row, "value")),
                      ]),
                    ),
                    primaryLabel: widget.id === "channel-mix-reach" ? "Reach" : "Sends",
                    pairedLabel: widget.id === "channel-mix-reach" ? "Sends" : "Reach",
                  }
                : null
            }
          />
        )}
        {!empty ? <PanelCaption>{MESSENGER_CHANNEL_PAIR_CAPTION}</PanelCaption> : null}
      </DetailPanel>
      {!empty ? <SplitBreakdown detail={detail} /> : null}
      {!empty && viz !== "table" ? (
        <UnderlyingDataToggle onCopyCsv={copyCsv}>
          <UnderlyingTable widget={widget} range={range} statusTone={messengerStatusTone} />
        </UnderlyingDataToggle>
      ) : null}
    </>
  );
}

function MessengerToolbar({
  slug,
  detail,
  overlay,
  comparePaired,
  onComparePaired,
}: {
  slug: string;
  detail: InsightWidgetDetail | null;
  overlay: boolean;
  comparePaired: boolean;
  onComparePaired: (value: boolean) => void;
}) {
  if (!detail?.pairedWidget) return null;
  const swapLabel = PAIRED_SWAP_LABELS[detail.widget.id];
  const pairedHref = adminInsightWidgetHref(slug, detail.pairedWidget.id);
  return (
    <>
      {swapLabel ? (
        <Link
          href={overlay ? `${pairedHref}?overlay=1` : pairedHref}
          prefetch={false}
          className={insightGhostButtonClassName}
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          {swapLabel}
        </Link>
      ) : null}
      {MESSENGER_BAR_WIDGET_IDS.has(detail.widget.id) ? (
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--admin-primary)]"
            checked={comparePaired}
            onChange={(event) => {
              onComparePaired(event.target.checked);
            }}
          />
          Compare with paired widget
        </label>
      ) : null}
    </>
  );
}

export function MessengerInsightWidgetDetailView(props: InsightWidgetDetailViewProps) {
  const widget = props.detail?.widget ?? null;
  const [comparePaired, setComparePaired] = useWidgetState(widget, false);
  const [outboundOnly, setOutboundOnly] = useWidgetState(widget, false);
  const [channels, setChannels] = useWidgetState(widget, ALL_CHANNELS_ON);
  const state: MessengerState = {
    comparePaired,
    channels,
    onChannels: setChannels,
    outboundOnly,
    onOutboundOnly: setOutboundOnly,
  };

  const area: InsightDetailArea = {
    vizOptions,
    isEmpty: widgetHasNoEvents,
    windowCaption: MESSENGER_FIXED_WINDOW_CAPTION,
    primaryAction: (detail) => {
      const first = detail?.related[0];
      return first ? { href: first.href, label: first.title } : INBOX_ACTION;
    },
    skeletonHeadlines: widget?.id === "daily-volume" || !widget ? 5 : 4,
    toolbarExtras: (
      <MessengerToolbar
        slug={props.slug}
        detail={props.detail}
        overlay={props.overlay}
        comparePaired={comparePaired}
        onComparePaired={setComparePaired}
      />
    ),
    renderMain: (canvas) => <MessengerMain canvas={canvas} state={state} />,
    renderRail: ({ detail }) => (
      <RelatedRail
        related={detail.related}
        emptyAction={INBOX_ACTION}
        metadata={widgetMetadata(detail, MESSENGER_FIXED_WINDOW_CAPTION)}
      />
    ),
  };
  return <InsightWidgetDetailView {...props} area={area} />;
}
