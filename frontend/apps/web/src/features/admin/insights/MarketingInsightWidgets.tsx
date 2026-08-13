"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  Inbox,
  Maximize2,
  MousePointerClick,
  Share2,
  Table2,
  Workflow,
} from "lucide-react";
import { adminInsightWidgetHref } from "./admin-insights-catalog";
import type { InsightWidget } from "./admin-insights-api";
import {
  formatInsightMoney,
  formatInsightNumber,
  formatPeriodLabel,
} from "./admin-insights-format";
import {
  insightGroupTitleClassName,
  insightKpiLabelClassName,
  insightKpiValueClassName,
  insightPanelClassName,
  insightShimmerClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";
import {
  MARKETING_ATTRIBUTION_PAIR_CAPTION,
  MARKETING_BAR_WIDGET_IDS,
  MARKETING_CTA_EMPTY_CAPTION,
  MARKETING_DAILY_LEADS_CAPTION,
  MARKETING_FIXED_WINDOW_CAPTION,
  MARKETING_INSIGHT_ATTRIBUTION_KPI_IDS,
  MARKETING_INSIGHT_AUTOMATION_KPI_IDS,
  MARKETING_INSIGHT_CAPTURE_KPI_IDS,
  MARKETING_INSIGHT_CHART_WIDGET_IDS,
  MARKETING_INSIGHT_ENGAGEMENT_KPI_IDS,
  MARKETING_INSIGHT_MONEY_KPI_IDS,
  MARKETING_INSIGHT_PERCENT_KPI_IDS,
  MARKETING_LIVE_COUNTS_CAPTION,
  marketingStatusTone,
  marketingWidgetEmptyCopy,
  type MarketingStatusTone,
} from "./marketing-insight-meta";

function numericValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: string | number | null | undefined, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function cell(
  row: Record<string, string | number | null> | undefined,
  key: string,
): string | number | null {
  return row?.[key] ?? null;
}

function statusPillClass(tone: MarketingStatusTone): string {
  if (tone === "success") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (tone === "danger") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (tone === "warning") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
}

function ShareBar({ share }: { share: number }) {
  return (
    <div className="mt-1 h-[3px] w-full max-w-[7rem] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--admin-outline)_30%,transparent)] ml-auto">
      <div
        className="h-full bg-[var(--admin-primary)]"
        style={{ width: `${String(Math.min(Math.max(share, 0), 100))}%` }}
      />
    </div>
  );
}

function WidgetEmpty({ title, body, icon }: { title: string; body: string; icon: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-6 py-10 text-center">
      <div className="mb-4 text-[var(--admin-outline)]">{icon}</div>
      <h4 className="text-sm font-medium text-[var(--admin-on-surface)]">{title}</h4>
      <p className="mt-1 max-w-xs text-xs text-[var(--admin-on-surface-variant)]">{body}</p>
    </div>
  );
}

function MarketingKpiCell({
  widget,
  currency,
  href,
}: {
  widget: InsightWidget;
  currency?: string | undefined;
  href: string;
}) {
  const value = numericValue(cell(widget.data.rows[0], "value"));
  const percent = MARKETING_INSIGHT_PERCENT_KPI_IDS.has(widget.id);
  const money = MARKETING_INSIGHT_MONEY_KPI_IDS.has(widget.id);
  const emptyCta =
    percent &&
    (widget.footnote === MARKETING_CTA_EMPTY_CAPTION ||
      widget.footnote?.toLowerCase().includes("no cta views"));

  let valueLabel: string;
  if (emptyCta) valueLabel = "-";
  else if (percent) valueLabel = `${formatInsightNumber(value)}%`;
  else if (money) valueLabel = formatInsightMoney(value);
  else valueLabel = formatInsightNumber(value);

  return (
    <div className="flex flex-col gap-1">
      <p className={insightKpiLabelClassName}>{widget.title}</p>
      <div className="flex flex-wrap items-baseline gap-2">
        <Link
          href={widget.href ?? href}
          prefetch={false}
          className={`${insightKpiValueClassName} outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30`}
        >
          {valueLabel}
        </Link>
        {money && currency && !emptyCta ? (
          <span className="font-data text-[11px] text-[var(--admin-on-surface-variant)]">
            {currency}
          </span>
        ) : null}
      </div>
      {emptyCta ? (
        <p className="text-[10px] text-[var(--admin-on-surface-variant)]">
          {widget.footnote ?? MARKETING_CTA_EMPTY_CAPTION}
        </p>
      ) : widget.footnote ? (
        <p className="text-[10px] text-[var(--admin-on-surface-variant)]">{widget.footnote}</p>
      ) : null}
      {percent && !emptyCta ? (
        <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--admin-outline)_35%,transparent)]">
          <div
            className="h-full bg-[var(--admin-primary)]"
            style={{ width: `${String(Math.min(Math.max(value, 0), 100))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function MarketingInsightKpiGroups({
  widgets,
  slug,
  currency,
}: {
  widgets: InsightWidget[];
  slug: string;
  currency?: string | undefined;
}) {
  const byId = useMemo(() => new Map(widgets.map((widget) => [widget.id, widget])), [widgets]);

  const renderGroup = (title: string, ids: readonly string[]) => {
    const items = ids
      .map((id) => byId.get(id))
      .filter((widget): widget is InsightWidget => Boolean(widget));
    if (items.length === 0) return null;
    return (
      <section
        className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
        aria-label={title}
      >
        <h2 className={insightGroupTitleClassName}>{title}</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {items.map((widget) => (
            <MarketingKpiCell
              key={widget.id}
              widget={widget}
              currency={currency}
              href={adminInsightWidgetHref(slug, widget.id)}
            />
          ))}
        </div>
      </section>
    );
  };

  const hasAny =
    MARKETING_INSIGHT_ATTRIBUTION_KPI_IDS.some((id) => byId.has(id)) ||
    MARKETING_INSIGHT_CAPTURE_KPI_IDS.some((id) => byId.has(id)) ||
    MARKETING_INSIGHT_ENGAGEMENT_KPI_IDS.some((id) => byId.has(id)) ||
    MARKETING_INSIGHT_AUTOMATION_KPI_IDS.some((id) => byId.has(id));
  if (!hasAny) return null;

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {renderGroup("Attribution", MARKETING_INSIGHT_ATTRIBUTION_KPI_IDS)}
        {renderGroup("Capture", MARKETING_INSIGHT_CAPTURE_KPI_IDS)}
        {renderGroup("Engagement", MARKETING_INSIGHT_ENGAGEMENT_KPI_IDS)}
        {renderGroup("Automation and offers", MARKETING_INSIGHT_AUTOMATION_KPI_IDS)}
      </div>
      <div className="mt-4 flex flex-col gap-1 text-center text-xs text-[var(--admin-on-surface-variant)]">
        <p>{MARKETING_FIXED_WINDOW_CAPTION}</p>
        <p>{MARKETING_LIVE_COUNTS_CAPTION}</p>
      </div>
    </div>
  );
}

function WidgetFrame({
  widget,
  slug,
  children,
  caption,
  trailing,
}: {
  widget: InsightWidget;
  slug: string;
  children: ReactNode;
  caption?: string | undefined;
  trailing?: ReactNode;
}) {
  return (
    <section className={`${insightPanelClassName} min-h-[280px]`} aria-label={widget.title}>
      <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] p-5">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-[var(--admin-on-surface)]">
            <Link
              href={adminInsightWidgetHref(slug, widget.id)}
              prefetch={false}
              className="outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            >
              {widget.title}
            </Link>
          </h3>
          {caption ? (
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">{caption}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {trailing}
          <Link
            href={`${adminInsightWidgetHref(slug, widget.id)}?overlay=1`}
            prefetch={false}
            className="rounded p-1.5 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label={`Expand ${widget.title}`}
          >
            <Maximize2 className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-5">{children}</div>
    </section>
  );
}

function AttributionBars({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = marketingWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<Share2 className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }

  const total = rows.reduce((sum, row) => sum + numericValue(cell(row, "value")), 0) || 1;
  const maxIndex = rows.reduce((best, row, index) => {
    return numericValue(cell(row, "value")) > numericValue(cell(rows[best], "value"))
      ? index
      : best;
  }, 0);

  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      {rows.map((row, index) => {
        const label = stringValue(cell(row, "label"), "Unknown");
        const value = numericValue(cell(row, "value"));
        const share = Math.round((value / total) * 100);
        const width = `${String(Math.max((value / Math.max(...rows.map((r) => numericValue(cell(r, "value"))), 1)) * 100, value > 0 ? 4 : 0))}%`;
        const barClass =
          index === maxIndex
            ? "bg-[var(--admin-primary)]"
            : "bg-[color-mix(in_srgb,var(--admin-primary)_60%,var(--admin-surface))]";
        return (
          <div key={`${label}-${String(index)}`}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
                {label}
              </span>
              <span className="font-data text-sm text-[var(--admin-on-surface)]">
                {formatInsightNumber(share)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
              <div className={`h-full rounded-full ${barClass}`} style={{ width }} />
            </div>
            <p className="mt-1 text-right font-data text-[11px] text-[var(--admin-on-surface-variant)]">
              {formatInsightNumber(value)} events
            </p>
          </div>
        );
      })}
    </div>
  );
}

function DailyLeadsChart({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = marketingWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<MousePointerClick className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }

  const points = rows.map((row) => {
    const period = stringValue(cell(row, "period"));
    return {
      label: formatPeriodLabel(period, "30d"),
      submissions: numericValue(cell(row, "submissions")),
      contacts: numericValue(cell(row, "contacts")),
    };
  });

  const max = Math.max(...points.flatMap((point) => [point.submissions, point.contacts]), 1);
  const mean =
    points.reduce((sum, point) => sum + point.submissions, 0) / Math.max(points.length, 1);

  const width = 720;
  const height = 220;
  const padX = 28;
  const padY = 20;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const toX = (index: number) =>
    padX + (points.length <= 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const toY = (value: number) => padY + plotH - (value / max) * plotH;

  const buildPath = (key: "submissions" | "contacts") =>
    points
      .map((point, index) => {
        const command = index === 0 ? "M" : "L";
        return `${command} ${String(toX(index))} ${String(toY(point[key]))}`;
      })
      .join(" ");

  const meanY = toY(mean);

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[var(--admin-primary)]" />
          <span className="text-xs text-[var(--admin-on-surface-variant)]">Submissions</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-surface))]" />
          <span className="text-xs text-[var(--admin-on-surface-variant)]">Contacts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-px w-5 border-t border-dashed border-[var(--admin-outline)]" />
          <span className="text-xs text-[var(--admin-on-surface-variant)]">
            Mean submissions ({formatInsightNumber(mean, 1)})
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="h-56 w-full"
        role="img"
        aria-label="Daily leads: submissions and contacts over 30 days"
      >
        <line
          x1={padX}
          y1={meanY}
          x2={width - padX}
          y2={meanY}
          stroke="var(--admin-outline)"
          strokeDasharray="4 4"
          strokeWidth={1.5}
        />
        <path
          d={buildPath("contacts")}
          fill="none"
          stroke="color-mix(in srgb, var(--admin-primary) 45%, var(--admin-surface))"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <path
          d={buildPath("submissions")}
          fill="none"
          stroke="var(--admin-primary)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {points.map((point, index) =>
          index === 0 || index === points.length - 1 || index % 5 === 0 ? (
            <text
              key={point.label + String(index)}
              x={toX(index)}
              y={height - 4}
              textAnchor="middle"
              fill="var(--admin-on-surface-variant)"
              fontSize={10}
              fontFamily="var(--font-data, ui-monospace)"
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>
      <p className="text-xs text-[var(--admin-on-surface-variant)]">
        {MARKETING_DAILY_LEADS_CAPTION}
      </p>
    </div>
  );
}

function TopSourcesTable({
  widget,
  currency,
}: {
  widget: InsightWidget;
  currency?: string | undefined;
}) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = marketingWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<Share2 className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }
  const maxEvents = Math.max(...rows.map((row) => numericValue(cell(row, "events"))), 1);
  const maxRevenue = Math.max(...rows.map((row) => numericValue(cell(row, "revenue"))), 1);

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Source</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Events</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>
              Attributed revenue
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const events = numericValue(cell(row, "events"));
            const revenue = numericValue(cell(row, "revenue"));
            return (
              <tr
                key={`${stringValue(cell(row, "source"))}-${String(index)}`}
                className={insightTableRowClassName}
              >
                <td className="px-5 py-2 font-data text-sm text-[var(--admin-on-surface)]">
                  {stringValue(cell(row, "source"), "(direct)")}
                </td>
                <td className="px-5 py-2 text-right">
                  <span className="font-data text-sm text-[var(--admin-on-surface)]">
                    {formatInsightNumber(events)}
                  </span>
                  <ShareBar share={Math.round((events / maxEvents) * 100)} />
                </td>
                <td className="px-5 py-2 text-right">
                  <span className="font-data text-sm text-[var(--admin-on-surface)]">
                    {formatInsightMoney(revenue)}
                    {currency ? (
                      <span className="ml-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                        {currency}
                      </span>
                    ) : null}
                  </span>
                  <ShareBar share={Math.round((revenue / maxRevenue) * 100)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TopCampaignsTable({
  widget,
  currency,
}: {
  widget: InsightWidget;
  currency?: string | undefined;
}) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = marketingWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<Share2 className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Campaign</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Events</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>
              Attributed revenue
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${stringValue(cell(row, "campaign"))}-${String(index)}`}
              className={insightTableRowClassName}
            >
              <td className="px-5 py-2 font-data text-sm text-[var(--admin-on-surface)]">
                {stringValue(cell(row, "campaign"), "(not set)")}
              </td>
              <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface)]">
                {formatInsightNumber(numericValue(cell(row, "events")))}
              </td>
              <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface)]">
                {formatInsightMoney(numericValue(cell(row, "revenue")))}
                {currency ? (
                  <span className="ml-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                    {currency}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopFormsTable({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = marketingWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<Inbox className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }
  const maxSubs = Math.max(...rows.map((row) => numericValue(cell(row, "submissions"))), 1);

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Form</th>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Status</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Submissions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const status = stringValue(cell(row, "status"), "-");
            const submissions = numericValue(cell(row, "submissions"));
            const tone = marketingStatusTone(status);
            return (
              <tr
                key={`${stringValue(cell(row, "title"))}-${String(index)}`}
                className={insightTableRowClassName}
              >
                <td className="px-5 py-2 text-sm font-medium text-[var(--admin-primary)]">
                  {stringValue(cell(row, "title"), "Untitled form")}
                </td>
                <td className="px-5 py-2">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 font-data text-[11px] uppercase tracking-wide ${statusPillClass(tone)}`}
                  >
                    {status}
                  </span>
                </td>
                <td className="px-5 py-2 text-right">
                  <span className="font-data text-sm text-[var(--admin-on-surface)]">
                    {formatInsightNumber(submissions)}
                  </span>
                  <ShareBar share={Math.round((submissions / maxSubs) * 100)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TopCtasTable({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = marketingWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<MousePointerClick className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>CTA</th>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Type</th>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Status</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Views</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Clicks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const views = numericValue(cell(row, "views"));
            const clicks = numericValue(cell(row, "clicks"));
            const rate = views > 0 ? Math.round((clicks / views) * 100) : null;
            const status = stringValue(cell(row, "status"), "-");
            return (
              <tr
                key={`${stringValue(cell(row, "title"))}-${String(index)}`}
                className={insightTableRowClassName}
              >
                <td className="px-5 py-2 text-sm font-medium text-[var(--admin-primary)]">
                  {stringValue(cell(row, "title"), "Untitled CTA")}
                </td>
                <td className="px-5 py-2">
                  <span className="inline-flex rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                    {stringValue(cell(row, "type"), "-")}
                  </span>
                </td>
                <td className="px-5 py-2">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 font-data text-[11px] uppercase tracking-wide ${statusPillClass(marketingStatusTone(status))}`}
                  >
                    {status}
                  </span>
                </td>
                <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface)]">
                  {formatInsightNumber(views)}
                </td>
                <td className="px-5 py-2 text-right">
                  <span className="font-data text-sm text-[var(--admin-on-surface)]">
                    {formatInsightNumber(clicks)}
                  </span>
                  {rate != null ? (
                    <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                      {formatInsightNumber(rate)}% click rate
                    </p>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
      aria-label={copied ? "Copied" : `Copy ${code}`}
      onClick={() => {
        void navigator.clipboard.writeText(code).then(() => {
          setCopied(true);
          window.setTimeout(() => {
            setCopied(false);
          }, 1500);
        });
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-[var(--admin-success)]" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

function TopCouponsTable({
  widget,
  currency,
}: {
  widget: InsightWidget;
  currency?: string | undefined;
}) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = marketingWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<Table2 className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Code</th>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Name</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Redemptions</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Discount given</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const code = stringValue(cell(row, "code"), "-").toUpperCase();
            return (
              <tr key={`${code}-${String(index)}`} className={insightTableRowClassName}>
                <td className="px-5 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-data text-sm text-[var(--admin-on-surface)]">{code}</span>
                    {code !== "-" ? <CopyCodeButton code={code} /> : null}
                  </div>
                </td>
                <td className="px-5 py-2 text-sm text-[var(--admin-on-surface)]">
                  {stringValue(cell(row, "name"), "-")}
                </td>
                <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface)]">
                  {formatInsightNumber(numericValue(cell(row, "redemptions")))}
                </td>
                <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface)]">
                  {formatInsightMoney(numericValue(cell(row, "discount")))}
                  {currency ? (
                    <span className="ml-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                      {currency}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MarketingInventoryTable({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = marketingWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<Inbox className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }

  const pairBreakAfter = new Set([
    "Forms (live)",
    "CTAs (live)",
    "Workflows (published)",
    "Campaigns (launched)",
    "Email campaigns sent",
    "Active coupons",
    "Events",
  ]);

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[320px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Asset</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const asset = stringValue(cell(row, "asset"), "-");
            const pairBreak = pairBreakAfter.has(asset);
            return (
              <tr
                key={`${asset}-${String(index)}`}
                className={`${insightTableRowClassName} ${
                  pairBreak ? "border-b-2 border-[var(--admin-border)]" : ""
                }`}
              >
                <td className="px-5 py-2 text-sm text-[var(--admin-on-surface)]">{asset}</td>
                <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface)]">
                  {formatInsightNumber(numericValue(cell(row, "count")))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecentWorkflowRunsTable({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = marketingWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<Workflow className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} w-2 px-0 py-3`} aria-hidden="true" />
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Workflow</th>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Status</th>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Trigger</th>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const status = stringValue(cell(row, "status"), "-");
            const tone = marketingStatusTone(status);
            const failed = tone === "danger";
            return (
              <tr
                key={`${stringValue(cell(row, "workflow"))}-${String(index)}`}
                className={`${insightTableRowClassName} ${
                  failed
                    ? "bg-[color-mix(in_srgb,var(--admin-danger)_5%,var(--admin-surface))]"
                    : ""
                }`}
              >
                <td className="relative w-2 p-0">
                  {failed ? (
                    <div
                      className="absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--admin-danger)]"
                      aria-hidden="true"
                    />
                  ) : null}
                </td>
                <td className="px-5 py-2 text-sm font-medium text-[var(--admin-primary)]">
                  {stringValue(cell(row, "workflow"), "Untitled workflow")}
                </td>
                <td className="px-5 py-2">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 font-data text-[11px] uppercase tracking-wide ${statusPillClass(tone)}`}
                  >
                    {status}
                  </span>
                </td>
                <td className="px-5 py-2 font-data text-sm text-[var(--admin-on-surface-variant)]">
                  {stringValue(cell(row, "trigger"), "-")}
                </td>
                <td className="px-5 py-2 font-data text-sm text-[var(--admin-on-surface-variant)]">
                  {stringValue(cell(row, "created"), "-")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MarketingChartWidget({
  widget,
  slug,
  currency,
}: {
  widget: InsightWidget;
  slug: string;
  currency?: string | undefined;
}) {
  if (MARKETING_BAR_WIDGET_IDS.has(widget.id)) {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <AttributionBars widget={widget} />
      </WidgetFrame>
    );
  }

  if (widget.id === "daily-leads") {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <DailyLeadsChart widget={widget} />
      </WidgetFrame>
    );
  }

  if (widget.id === "top-sources") {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <TopSourcesTable widget={widget} currency={currency} />
      </WidgetFrame>
    );
  }

  if (widget.id === "top-campaigns-utm") {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <TopCampaignsTable widget={widget} currency={currency} />
      </WidgetFrame>
    );
  }

  if (widget.id === "top-forms") {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <TopFormsTable widget={widget} />
      </WidgetFrame>
    );
  }

  if (widget.id === "top-ctas") {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <TopCtasTable widget={widget} />
      </WidgetFrame>
    );
  }

  if (widget.id === "top-coupons") {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <TopCouponsTable widget={widget} currency={currency} />
      </WidgetFrame>
    );
  }

  if (widget.id === "marketing-inventory") {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <MarketingInventoryTable widget={widget} />
      </WidgetFrame>
    );
  }

  if (widget.id === "recent-workflow-runs") {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <RecentWorkflowRunsTable widget={widget} />
      </WidgetFrame>
    );
  }

  const empty = marketingWidgetEmptyCopy(widget.id);
  return (
    <WidgetFrame widget={widget} slug={slug}>
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<Table2 className="h-8 w-8" aria-hidden="true" />}
      />
    </WidgetFrame>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="col-span-12 text-lg font-semibold tracking-tight text-[var(--admin-on-surface)]">
      {children}
    </h3>
  );
}

export function MarketingInsightChartGrid({
  widgets,
  slug,
  currency,
}: {
  widgets: InsightWidget[];
  slug: string;
  currency?: string | undefined;
}) {
  const byId = useMemo(() => new Map(widgets.map((widget) => [widget.id, widget])), [widgets]);
  const ordered = MARKETING_INSIGHT_CHART_WIDGET_IDS.map((id) => byId.get(id)).filter(
    (widget): widget is InsightWidget => Boolean(widget),
  );
  if (ordered.length === 0) return null;

  const nodes: ReactNode[] = [];
  const source = byId.get("attribution-by-source");
  const medium = byId.get("attribution-by-medium");
  const daily = byId.get("daily-leads");
  const topSources = byId.get("top-sources");
  const topCampaigns = byId.get("top-campaigns-utm");
  const topForms = byId.get("top-forms");
  const topCtas = byId.get("top-ctas");
  const topCoupons = byId.get("top-coupons");
  const inventory = byId.get("marketing-inventory");
  const runs = byId.get("recent-workflow-runs");

  if (source || medium) {
    if (source) {
      nodes.push(
        <div key={source.id} className="col-span-12 md:col-span-6">
          <MarketingChartWidget widget={source} slug={slug} currency={currency} />
        </div>,
      );
    }
    if (medium) {
      nodes.push(
        <div key={medium.id} className="col-span-12 md:col-span-6">
          <MarketingChartWidget widget={medium} slug={slug} currency={currency} />
        </div>,
      );
    }
    nodes.push(
      <p
        key="attr-pair-caption"
        className="col-span-12 -mt-2 text-center text-xs text-[var(--admin-on-surface-variant)]"
      >
        {MARKETING_ATTRIBUTION_PAIR_CAPTION}
      </p>,
    );
  }

  if (daily) {
    nodes.push(
      <div key={daily.id} className="col-span-12">
        <MarketingChartWidget widget={daily} slug={slug} currency={currency} />
      </div>,
    );
  }

  if (topSources || topCampaigns) {
    nodes.push(<GroupLabel key="traffic-label">Where traffic came from</GroupLabel>);
    if (topSources) {
      nodes.push(
        <div key={topSources.id} className="col-span-12 md:col-span-6">
          <MarketingChartWidget widget={topSources} slug={slug} currency={currency} />
        </div>,
      );
    }
    if (topCampaigns) {
      nodes.push(
        <div key={topCampaigns.id} className="col-span-12 md:col-span-6">
          <MarketingChartWidget widget={topCampaigns} slug={slug} currency={currency} />
        </div>,
      );
    }
  }

  if (topForms || topCtas) {
    nodes.push(<GroupLabel key="capture-label">What captured it</GroupLabel>);
    if (topForms) {
      nodes.push(
        <div key={topForms.id} className="col-span-12 md:col-span-6">
          <MarketingChartWidget widget={topForms} slug={slug} currency={currency} />
        </div>,
      );
    }
    if (topCtas) {
      nodes.push(
        <div key={topCtas.id} className="col-span-12 md:col-span-6">
          <MarketingChartWidget widget={topCtas} slug={slug} currency={currency} />
        </div>,
      );
    }
  }

  if (topCoupons || inventory) {
    nodes.push(<GroupLabel key="offers-label">What was offered</GroupLabel>);
    if (topCoupons) {
      nodes.push(
        <div key={topCoupons.id} className="col-span-12 md:col-span-6">
          <MarketingChartWidget widget={topCoupons} slug={slug} currency={currency} />
        </div>,
      );
    }
    if (inventory) {
      nodes.push(
        <div key={inventory.id} className="col-span-12 md:col-span-6">
          <MarketingChartWidget widget={inventory} slug={slug} currency={currency} />
        </div>,
      );
    }
  }

  if (runs) {
    nodes.push(
      <div key={runs.id} className="col-span-12">
        <MarketingChartWidget widget={runs} slug={slug} currency={currency} />
      </div>,
    );
  }

  return <div className="grid grid-cols-12 gap-6">{nodes}</div>;
}

export function MarketingInsightSkeleton() {
  const groups = ["Attribution", "Capture", "Engagement", "Automation and offers"];
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading marketing insight">
      <div className="flex flex-col gap-2">
        <div className={`${insightShimmerClassName} h-14 w-full rounded-lg`} />
        <div className={`${insightShimmerClassName} h-14 w-full rounded-lg`} />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => (
          <div
            key={group}
            className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
          >
            <div className={`${insightShimmerClassName} mb-4 h-4 w-28 rounded`} />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index}>
                  <div className={`${insightShimmerClassName} mb-2 h-3 w-24 rounded`} />
                  <div className={`${insightShimmerClassName} h-8 w-28 rounded`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className={`${insightPanelClassName} col-span-12 min-h-[240px] p-5 md:col-span-6`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-44 rounded`} />
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="mb-4">
              <div className={`${insightShimmerClassName} mb-2 h-3 w-full rounded`} />
              <div className={`${insightShimmerClassName} h-2 w-full rounded`} />
            </div>
          ))}
        </div>
        <div className={`${insightPanelClassName} col-span-12 min-h-[240px] p-5 md:col-span-6`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-40 rounded`} />
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="mb-4">
              <div className={`${insightShimmerClassName} mb-2 h-3 w-full rounded`} />
              <div className={`${insightShimmerClassName} h-2 w-full rounded`} />
            </div>
          ))}
        </div>
        <div className={`${insightPanelClassName} col-span-12 min-h-[280px] p-5`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-40 rounded`} />
          <div className={`${insightShimmerClassName} h-56 w-full rounded`} />
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className={`${insightPanelClassName} col-span-12 min-h-[220px] overflow-hidden md:col-span-6`}
          >
            <div className="border-b border-[var(--admin-border)] p-5">
              <div className={`${insightShimmerClassName} h-5 w-36 rounded`} />
            </div>
            {Array.from({ length: 4 }, (_, rowIndex) => (
              <div
                key={rowIndex}
                className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-3 last:border-b-0"
              >
                <div className={`${insightShimmerClassName} h-4 w-1/3 rounded`} />
                <div className={`${insightShimmerClassName} h-4 w-16 rounded`} />
              </div>
            ))}
          </div>
        ))}
        <div className={`${insightPanelClassName} col-span-12 overflow-hidden`}>
          <div className="border-b border-[var(--admin-border)] p-5">
            <div className={`${insightShimmerClassName} h-5 w-48 rounded`} />
          </div>
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="grid grid-cols-4 gap-4 border-b border-[var(--admin-border)] px-5 py-3 last:border-b-0"
            >
              <div className={`${insightShimmerClassName} h-4 w-3/4 rounded`} />
              <div className={`${insightShimmerClassName} h-4 w-1/2 rounded`} />
              <div className={`${insightShimmerClassName} h-4 w-2/3 rounded`} />
              <div className={`${insightShimmerClassName} h-4 w-1/3 rounded`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
