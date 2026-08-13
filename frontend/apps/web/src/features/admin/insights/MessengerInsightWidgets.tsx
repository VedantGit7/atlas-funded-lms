"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import {
  BarChart3,
  Inbox,
  Mail,
  Maximize2,
  MessageCircle,
  Megaphone,
  BellRing,
} from "lucide-react";
import { adminInsightWidgetHref } from "./admin-insights-catalog";
import type { InsightAlert, InsightWidget } from "./admin-insights-api";
import { formatInsightNumber, formatPeriodLabel } from "./admin-insights-format";
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
  MESSENGER_ALERT_COVERAGE_CAPTION,
  MESSENGER_BAR_WIDGET_IDS,
  MESSENGER_DAILY_VOLUME_CAPTION,
  MESSENGER_DIRECTION_CAPTION,
  MESSENGER_FAILED_CAPTION,
  MESSENGER_FIXED_WINDOW_CAPTION,
  MESSENGER_INSIGHT_EMAIL_PUSH_KPI_IDS,
  MESSENGER_INSIGHT_INBOUND_KPI_IDS,
  MESSENGER_INSIGHT_INVERTED_KPI_IDS,
  MESSENGER_INSIGHT_NON_LINKABLE_KPI_IDS,
  MESSENGER_INSIGHT_OUTBOUND_KPI_IDS,
  MESSENGER_INSIGHT_PERCENT_KPI_IDS,
  MESSENGER_INSIGHT_WHATSAPP_KPI_IDS,
  MESSENGER_TABLE_WIDGET_IDS,
  MESSENGER_WA_EMPTY_CAPTION,
  MESSENGER_WHATSAPP_KPI_MUTE_IDS,
  messengerChannelBarTone,
  messengerChannelMixCaption,
  messengerStatusTone,
  messengerWidgetEmptyCopy,
  type MessengerStatusTone,
} from "./messenger-insight-meta";

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

function compactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return formatInsightNumber(value);
}

function statusPillClass(tone: MessengerStatusTone): string {
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

function WidgetEmpty({ title, body, icon }: { title: string; body: string; icon: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-6 py-10 text-center">
      <div className="mb-4 text-[var(--admin-outline)]">{icon}</div>
      <h4 className="text-sm font-medium text-[var(--admin-on-surface)]">{title}</h4>
      <p className="mt-1 max-w-xs text-xs text-[var(--admin-on-surface-variant)]">{body}</p>
    </div>
  );
}

function MessengerKpiCell({
  widget,
  href,
  muted,
}: {
  widget: InsightWidget;
  href: string;
  muted?: boolean;
}) {
  const value = numericValue(cell(widget.data.rows[0], "value"));
  const percent = MESSENGER_INSIGHT_PERCENT_KPI_IDS.has(widget.id);
  const inverted = MESSENGER_INSIGHT_INVERTED_KPI_IDS.has(widget.id);
  const nonLinkable = MESSENGER_INSIGHT_NON_LINKABLE_KPI_IDS.has(widget.id);
  const emptyWa =
    percent &&
    (widget.footnote === MESSENGER_WA_EMPTY_CAPTION ||
      widget.footnote?.toLowerCase().includes("no whatsapp"));

  let valueLabel: string;
  if (emptyWa) valueLabel = "-";
  else if (percent) valueLabel = `${formatInsightNumber(value)}%`;
  else valueLabel = formatInsightNumber(value);

  const valueClass = inverted
    ? `${insightKpiValueClassName} text-[var(--admin-warning)]`
    : muted
      ? `${insightKpiValueClassName} text-[var(--admin-on-surface-variant)]`
      : insightKpiValueClassName;

  const labelClass = inverted
    ? `${insightKpiLabelClassName} text-[var(--admin-warning)]`
    : insightKpiLabelClassName;

  const valueNode = nonLinkable ? (
    <span className={valueClass}>{valueLabel}</span>
  ) : (
    <Link
      href={widget.href ?? href}
      prefetch={false}
      className={`${valueClass} outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30`}
    >
      {valueLabel}
    </Link>
  );

  return (
    <div
      className={`flex flex-col gap-1 ${muted ? "opacity-70" : ""} ${
        inverted
          ? "rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-3"
          : ""
      }`}
    >
      <p className={labelClass}>
        {inverted ? (
          <span className="inline-flex items-center gap-1">
            {widget.title}
            <span className="sr-only">({MESSENGER_FAILED_CAPTION})</span>
          </span>
        ) : (
          widget.title
        )}
        {muted ? (
          <span className="ml-1 font-normal normal-case tracking-normal text-[var(--admin-on-surface-variant)]">
            (historical)
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap items-baseline gap-2">{valueNode}</div>
      {emptyWa ? (
        <p className="text-[10px] text-[var(--admin-on-surface-variant)]">
          {widget.footnote ?? MESSENGER_WA_EMPTY_CAPTION}
        </p>
      ) : widget.footnote ? (
        <p className="text-[10px] text-[var(--admin-on-surface-variant)]">{widget.footnote}</p>
      ) : inverted ? (
        <p className="text-[10px] text-[var(--admin-warning)]">{MESSENGER_FAILED_CAPTION}</p>
      ) : null}
      {percent && !emptyWa ? (
        <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--admin-outline)_35%,transparent)]">
          <div
            className="h-full bg-[var(--admin-success)]"
            style={{ width: `${String(Math.min(Math.max(value, 0), 100))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function MessengerInsightKpiGroups({
  widgets,
  slug,
  alerts = [],
}: {
  widgets: InsightWidget[];
  slug: string;
  alerts?: InsightAlert[];
}) {
  const byId = useMemo(() => new Map(widgets.map((widget) => [widget.id, widget])), [widgets]);
  const muteWhatsapp = alerts.some((alert) => alert.id === "whatsapp-disconnected");

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
            <MessengerKpiCell
              key={widget.id}
              widget={widget}
              href={adminInsightWidgetHref(slug, widget.id)}
              muted={muteWhatsapp && MESSENGER_WHATSAPP_KPI_MUTE_IDS.has(widget.id)}
            />
          ))}
        </div>
      </section>
    );
  };

  const hasAny =
    MESSENGER_INSIGHT_OUTBOUND_KPI_IDS.some((id) => byId.has(id)) ||
    MESSENGER_INSIGHT_EMAIL_PUSH_KPI_IDS.some((id) => byId.has(id)) ||
    MESSENGER_INSIGHT_WHATSAPP_KPI_IDS.some((id) => byId.has(id)) ||
    MESSENGER_INSIGHT_INBOUND_KPI_IDS.some((id) => byId.has(id));
  if (!hasAny) return null;

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {renderGroup("Outbound totals", MESSENGER_INSIGHT_OUTBOUND_KPI_IDS)}
        {renderGroup("Email and push", MESSENGER_INSIGHT_EMAIL_PUSH_KPI_IDS)}
        {renderGroup("WhatsApp delivery", MESSENGER_INSIGHT_WHATSAPP_KPI_IDS)}
        {renderGroup("Inbound and scheduled", MESSENGER_INSIGHT_INBOUND_KPI_IDS)}
      </div>
      <div className="mt-4 flex flex-col gap-1 text-center text-xs text-[var(--admin-on-surface-variant)]">
        <p>{MESSENGER_FIXED_WINDOW_CAPTION}</p>
        <p>{MESSENGER_DIRECTION_CAPTION}</p>
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
  const titleHref = widget.href ?? adminInsightWidgetHref(slug, widget.id);
  const expandHref = adminInsightWidgetHref(slug, widget.id);
  return (
    <section className={`${insightPanelClassName} min-h-[280px]`} aria-label={widget.title}>
      <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_70%,transparent)] p-5">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-[var(--admin-on-surface)]">
            <Link
              href={titleHref}
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
        <div className="flex shrink-0 items-center gap-1">
          {trailing}
          <Link
            href={expandHref}
            prefetch={false}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] outline-none transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label={`Open ${widget.title}`}
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-5">{children}</div>
    </section>
  );
}

function ChannelBarChart({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = messengerWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<BarChart3 className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }
  const max = Math.max(...rows.map((row) => numericValue(cell(row, "value"))), 1);

  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      {rows.map((row, index) => {
        const label = stringValue(cell(row, "label"), "Channel");
        const value = numericValue(cell(row, "value"));
        const width = Math.max(Math.round((value / max) * 100), value > 0 ? 2 : 0);
        return (
          <div key={`${label}-${String(index)}`} className="flex items-center gap-4">
            <span className="w-20 shrink-0 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
              {label}
            </span>
            <div className="relative h-6 flex-1 overflow-hidden rounded-sm bg-[var(--admin-surface-high)]">
              <div
                className={`absolute inset-y-0 left-0 rounded-sm ${messengerChannelBarTone(index)}`}
                style={{ width: `${String(width)}%` }}
              />
            </div>
            <span className="w-16 shrink-0 font-data text-sm text-[var(--admin-on-surface)]">
              {compactNumber(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DualAxisDailyVolume({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = messengerWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<MessageCircle className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }

  const width = 720;
  const height = 260;
  const padL = 44;
  const padR = 44;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const outboundMax = Math.max(
    ...rows.flatMap((row) => [
      numericValue(cell(row, "email")),
      numericValue(cell(row, "push")),
      numericValue(cell(row, "whatsapp")),
    ]),
    1,
  );
  const inboundMax = Math.max(...rows.map((row) => numericValue(cell(row, "inbox"))), 1);

  const toX = (index: number) =>
    padL + (rows.length <= 1 ? plotW / 2 : (index / (rows.length - 1)) * plotW);
  const toYLeft = (value: number) => padT + plotH - (value / outboundMax) * plotH;
  const toYRight = (value: number) => padT + plotH - (value / inboundMax) * plotH;

  const buildPath = (key: "email" | "push" | "whatsapp", axis: "left" | "right") => {
    return rows
      .map((row, index) => {
        const value = numericValue(cell(row, key));
        const x = toX(index);
        const y = axis === "left" ? toYLeft(value) : toYRight(value);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const inboxPath = rows
    .map((row, index) => {
      const value = numericValue(cell(row, "inbox"));
      const x = toX(index);
      const y = toYRight(value);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const leftTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: padT + plotH - ratio * plotH,
    label: compactNumber(Math.round(outboundMax * ratio)),
  }));
  const rightTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: padT + plotH - ratio * plotH,
    label: compactNumber(Math.round(inboundMax * ratio)),
  }));

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[var(--admin-on-surface-variant)]">
        <span className="font-semibold text-[var(--admin-on-surface)]">Outbound reach</span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-3 bg-[var(--admin-primary)]" />
          Email
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-3 bg-[color-mix(in_srgb,var(--admin-primary)_60%,var(--admin-surface))]" />
          Push
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-3 bg-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-outline))]" />
          WhatsApp
        </span>
        <span
          className="mx-1 hidden h-3 w-px bg-[var(--admin-border)] sm:inline-block"
          aria-hidden="true"
        />
        <span className="font-semibold text-[var(--admin-on-surface)]">Inbound</span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0 w-3 border-t border-dashed border-[var(--admin-on-surface-variant)]" />
          Inbox messages
        </span>
      </div>
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="h-[260px] w-full"
        role="img"
        aria-label="Daily messaging volume: outbound reach on left axis, inbox messages on right axis"
      >
        {leftTicks.map((tick) => (
          <g key={`grid-${tick.label}-${tick.y}`}>
            <line
              x1={padL}
              y1={tick.y}
              x2={width - padR}
              y2={tick.y}
              stroke="color-mix(in srgb, var(--admin-border) 70%, transparent)"
              strokeWidth={1}
            />
            <text
              x={padL - 8}
              y={tick.y + 3}
              textAnchor="end"
              fill="var(--admin-on-surface-variant)"
              fontSize={10}
              fontFamily="var(--font-data, ui-monospace)"
            >
              {tick.label}
            </text>
          </g>
        ))}
        {rightTicks.map((tick) => (
          <text
            key={`right-${tick.label}-${tick.y}`}
            x={width - padR + 8}
            y={tick.y + 3}
            textAnchor="start"
            fill="var(--admin-on-surface-variant)"
            fontSize={10}
            fontFamily="var(--font-data, ui-monospace)"
          >
            {tick.label}
          </text>
        ))}
        <line
          x1={padL}
          y1={padT + plotH}
          x2={width - padR}
          y2={padT + plotH}
          stroke="var(--admin-border)"
          strokeWidth={1}
        />
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + plotH}
          stroke="var(--admin-border)"
          strokeWidth={1}
        />
        <line
          x1={width - padR}
          y1={padT}
          x2={width - padR}
          y2={padT + plotH}
          stroke="var(--admin-border)"
          strokeWidth={1}
        />
        <path
          d={buildPath("email", "left")}
          fill="none"
          stroke="var(--admin-primary)"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={buildPath("push", "left")}
          fill="none"
          stroke="color-mix(in srgb, var(--admin-primary) 60%, var(--admin-surface))"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
        <path
          d={buildPath("whatsapp", "left")}
          fill="none"
          stroke="color-mix(in srgb, var(--admin-primary) 35%, var(--admin-outline))"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
        <path
          d={inboxPath}
          fill="none"
          stroke="var(--admin-on-surface-variant)"
          strokeWidth={1.75}
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {rows.map((row, index) =>
          index === 0 ||
          index === rows.length - 1 ||
          index % Math.max(1, Math.floor(rows.length / 4)) === 0 ? (
            <text
              key={`${stringValue(cell(row, "period"))}-${String(index)}`}
              x={toX(index)}
              y={height - 6}
              textAnchor="middle"
              fill="var(--admin-on-surface-variant)"
              fontSize={10}
              fontFamily="var(--font-data, ui-monospace)"
            >
              {formatPeriodLabel(stringValue(cell(row, "period")), "30d")}
            </text>
          ) : null,
        )}
      </svg>
      <p className="text-center text-xs text-[var(--admin-on-surface-variant)]">
        {MESSENGER_DAILY_VOLUME_CAPTION}
      </p>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const tone = messengerStatusTone(value);
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 font-data text-[10px] font-semibold uppercase tracking-wide ${statusPillClass(tone)}`}
    >
      {value || "-"}
    </span>
  );
}

function ChannelChips({ raw }: { raw: string }) {
  const parts = raw
    .split(/[,|/]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return <span className="text-[var(--admin-on-surface-variant)]">-</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((part) => (
        <span
          key={part}
          className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-1.5 py-0.5 font-data text-[10px] text-[var(--admin-on-surface-variant)]"
        >
          {part}
        </span>
      ))}
    </div>
  );
}

function RecentEmailTable({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = messengerWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<Mail className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Campaign</th>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Status</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Recipients</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Sent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${stringValue(cell(row, "title"))}-${String(index)}`}
              className={insightTableRowClassName}
            >
              <td className="max-w-[180px] truncate px-5 py-2 text-sm text-[var(--admin-on-surface)]">
                {stringValue(cell(row, "title"), "-")}
              </td>
              <td className="px-5 py-2">
                <StatusPill value={stringValue(cell(row, "status"), "-")} />
              </td>
              <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface)]">
                {formatInsightNumber(numericValue(cell(row, "recipients")))}
              </td>
              <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                {stringValue(cell(row, "sent"), "-")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentPushTable({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = messengerWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<BellRing className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[460px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Message</th>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Status</th>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Channels</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Recipients</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Sent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${stringValue(cell(row, "title"))}-${String(index)}`}
              className={insightTableRowClassName}
            >
              <td className="max-w-[160px] truncate px-5 py-2 text-sm text-[var(--admin-on-surface)]">
                {stringValue(cell(row, "title"), "-")}
              </td>
              <td className="px-5 py-2">
                <StatusPill value={stringValue(cell(row, "status"), "-")} />
              </td>
              <td className="px-5 py-2">
                <ChannelChips raw={stringValue(cell(row, "channels"))} />
              </td>
              <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface)]">
                {formatInsightNumber(numericValue(cell(row, "recipients")))}
              </td>
              <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                {stringValue(cell(row, "sent"), "-")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentWhatsappTable({ widget, muted }: { widget: InsightWidget; muted?: boolean }) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = messengerWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<MessageCircle className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }
  return (
    <div className={`-mx-5 overflow-x-auto ${muted ? "opacity-70" : ""}`}>
      <table className="w-full min-w-[520px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Campaign</th>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Status</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Recipients</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Delivered</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Failed</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Sent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const failed = numericValue(cell(row, "failed"));
            const rowTone =
              failed > 0
                ? `${insightTableRowClassName} bg-[color-mix(in_srgb,var(--admin-warning)_8%,transparent)]`
                : insightTableRowClassName;
            return (
              <tr key={`${stringValue(cell(row, "title"))}-${String(index)}`} className={rowTone}>
                <td className="max-w-[160px] truncate px-5 py-2 text-sm text-[var(--admin-on-surface)]">
                  {stringValue(cell(row, "title"), "-")}
                </td>
                <td className="px-5 py-2">
                  <StatusPill value={stringValue(cell(row, "status"), "-")} />
                </td>
                <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface)]">
                  {formatInsightNumber(numericValue(cell(row, "recipients")))}
                </td>
                <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-success)]">
                  {formatInsightNumber(numericValue(cell(row, "delivered")))}
                </td>
                <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-warning)]">
                  {formatInsightNumber(failed)}
                </td>
                <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                  {stringValue(cell(row, "sent"), "-")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecentAnnouncementsTable({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    const empty = messengerWidgetEmptyCopy(widget.id);
    return (
      <WidgetEmpty
        title={empty.title}
        body={empty.body}
        icon={<Megaphone className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Title</th>
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Type</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Recipients</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Sent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${stringValue(cell(row, "title"))}-${String(index)}`}
              className={insightTableRowClassName}
            >
              <td className="max-w-[180px] truncate px-5 py-2 text-sm text-[var(--admin-on-surface)]">
                {stringValue(cell(row, "title"), "-")}
              </td>
              <td className="px-5 py-2">
                <StatusPill value={stringValue(cell(row, "type"), "-")} />
              </td>
              <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface)]">
                {formatInsightNumber(numericValue(cell(row, "recipients")))}
              </td>
              <td className="px-5 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                {stringValue(cell(row, "sent"), "-")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessengerChartWidget({
  widget,
  slug,
  mutedWhatsapp,
}: {
  widget: InsightWidget;
  slug: string;
  mutedWhatsapp?: boolean;
}) {
  if (MESSENGER_BAR_WIDGET_IDS.has(widget.id)) {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <ChannelBarChart widget={widget} />
      </WidgetFrame>
    );
  }
  if (widget.id === "daily-volume") {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <DualAxisDailyVolume widget={widget} />
      </WidgetFrame>
    );
  }
  if (widget.id === "recent-email") {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <RecentEmailTable widget={widget} />
      </WidgetFrame>
    );
  }
  if (widget.id === "recent-push") {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <RecentPushTable widget={widget} />
      </WidgetFrame>
    );
  }
  if (widget.id === "recent-whatsapp") {
    return (
      <WidgetFrame
        widget={widget}
        slug={slug}
        caption={mutedWhatsapp ? "Integration not connected - figures are historical" : undefined}
      >
        <RecentWhatsappTable
          widget={widget}
          {...(mutedWhatsapp != null ? { muted: mutedWhatsapp } : {})}
        />
      </WidgetFrame>
    );
  }
  if (widget.id === "recent-announcements") {
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <RecentAnnouncementsTable widget={widget} />
      </WidgetFrame>
    );
  }
  if (MESSENGER_TABLE_WIDGET_IDS.has(widget.id)) {
    const empty = messengerWidgetEmptyCopy(widget.id);
    return (
      <WidgetFrame widget={widget} slug={slug}>
        <WidgetEmpty
          title={empty.title}
          body={empty.body}
          icon={<Inbox className="h-8 w-8" aria-hidden="true" />}
        />
      </WidgetFrame>
    );
  }
  return null;
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="col-span-12 text-base font-semibold text-[var(--admin-on-surface)]">
      {children}
    </h3>
  );
}

export function MessengerInsightChartGrid({
  widgets,
  slug,
  alerts = [],
}: {
  widgets: InsightWidget[];
  slug: string;
  alerts?: InsightAlert[];
}) {
  const byId = useMemo(() => new Map(widgets.map((widget) => [widget.id, widget])), [widgets]);
  const mutedWhatsapp = alerts.some((alert) => alert.id === "whatsapp-disconnected");

  const sends = byId.get("channel-mix-sends");
  const reach = byId.get("channel-mix-reach");
  const daily = byId.get("daily-volume");
  const recentEmail = byId.get("recent-email");
  const recentPush = byId.get("recent-push");
  const recentWhatsapp = byId.get("recent-whatsapp");
  const recentAnnouncements = byId.get("recent-announcements");

  if (
    !sends &&
    !reach &&
    !daily &&
    !recentEmail &&
    !recentPush &&
    !recentWhatsapp &&
    !recentAnnouncements
  ) {
    return null;
  }

  const mixCaption =
    sends && reach
      ? messengerChannelMixCaption(
          sends.data.rows.map((row) => ({
            label: stringValue(cell(row, "label")),
            value: numericValue(cell(row, "value")),
          })),
          reach.data.rows.map((row) => ({
            label: stringValue(cell(row, "label")),
            value: numericValue(cell(row, "value")),
          })),
        )
      : null;

  const nodes: ReactNode[] = [];

  if (sends || reach) {
    if (sends) {
      nodes.push(
        <div key={sends.id} className="col-span-12 md:col-span-6">
          <MessengerChartWidget widget={sends} slug={slug} />
        </div>,
      );
    }
    if (reach) {
      nodes.push(
        <div key={reach.id} className="col-span-12 md:col-span-6">
          <MessengerChartWidget widget={reach} slug={slug} />
        </div>,
      );
    }
    nodes.push(
      <p
        key="channel-mix-caption"
        className="col-span-12 -mt-2 text-center text-xs text-[var(--admin-on-surface-variant)]"
      >
        {mixCaption ?? "Sends and reach use the same channel order and colours. Units differ."}
      </p>,
    );
  }

  if (daily) {
    nodes.push(
      <div key={daily.id} className="col-span-12">
        <MessengerChartWidget widget={daily} slug={slug} />
      </div>,
    );
  }

  if (recentEmail || recentPush || recentWhatsapp || recentAnnouncements) {
    nodes.push(<GroupLabel key="recent-label">Recent sends by channel</GroupLabel>);
    if (recentEmail) {
      nodes.push(
        <div key={recentEmail.id} className="col-span-12 md:col-span-6">
          <MessengerChartWidget widget={recentEmail} slug={slug} />
        </div>,
      );
    }
    if (recentPush) {
      nodes.push(
        <div key={recentPush.id} className="col-span-12 md:col-span-6">
          <MessengerChartWidget widget={recentPush} slug={slug} />
        </div>,
      );
    }
    if (recentWhatsapp) {
      nodes.push(
        <div key={recentWhatsapp.id} className="col-span-12 md:col-span-6">
          <MessengerChartWidget widget={recentWhatsapp} slug={slug} mutedWhatsapp={mutedWhatsapp} />
        </div>,
      );
    }
    if (recentAnnouncements) {
      nodes.push(
        <div key={recentAnnouncements.id} className="col-span-12 md:col-span-6">
          <MessengerChartWidget widget={recentAnnouncements} slug={slug} />
        </div>,
      );
    }
  }

  nodes.push(
    <p
      key="alert-coverage"
      className="col-span-12 text-center text-xs text-[var(--admin-on-surface-variant)]"
    >
      {MESSENGER_ALERT_COVERAGE_CAPTION}
    </p>,
  );

  return <div className="grid grid-cols-12 gap-6">{nodes}</div>;
}

export function MessengerInsightSkeleton() {
  const groups = [
    "Outbound totals",
    "Email and push",
    "WhatsApp delivery",
    "Inbound and scheduled",
  ];
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading messenger insight">
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
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="mb-4 flex items-center gap-3">
              <div className={`${insightShimmerClassName} h-3 w-14 rounded`} />
              <div className={`${insightShimmerClassName} h-6 flex-1 rounded`} />
              <div className={`${insightShimmerClassName} h-3 w-10 rounded`} />
            </div>
          ))}
        </div>
        <div className={`${insightPanelClassName} col-span-12 min-h-[240px] p-5 md:col-span-6`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-40 rounded`} />
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="mb-4 flex items-center gap-3">
              <div className={`${insightShimmerClassName} h-3 w-14 rounded`} />
              <div className={`${insightShimmerClassName} h-6 flex-1 rounded`} />
              <div className={`${insightShimmerClassName} h-3 w-10 rounded`} />
            </div>
          ))}
        </div>
        <div className={`${insightPanelClassName} col-span-12 min-h-[280px] p-5`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-52 rounded`} />
          <div className={`${insightShimmerClassName} h-56 w-full rounded`} />
        </div>
        {Array.from({ length: 4 }, (_, index) => (
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
      </div>
    </div>
  );
}
